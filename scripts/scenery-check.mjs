import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { hostname } from 'node:os';
import { chromium } from '@playwright/test';

// Short, visible hardware run after a rendering change. This does not claim
// full-race coverage. Keep this browser foreground and the build unchanged.
const browser = await chromium.connectOverCDP(
  process.env.ASTRA_CDP ?? 'http://localhost:9224',
);
// Own the context DPR so navigation and Playwright screenshots preserve it.
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
page.setDefaultTimeout(90_000);
const output = process.env.ASTRA_OUTPUT ?? 'artifacts/scenery-check';
const seconds = Number(process.env.ASTRA_SAMPLE_SECONDS ?? 25);
assert.ok(seconds >= 15 && seconds <= 90);
await mkdir(output, { recursive: true });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const report = {
  date: new Date().toISOString(),
  host: hostname(),
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  sourceDirty: !!execFileSync('git', ['status', '--porcelain'], {
    encoding: 'utf8',
  }).trim(),
  browser: browser.version(),
  build: 'production',
  secondsPerCircuit: seconds,
  runs: [],
  errors,
};
try {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(
    `${process.env.ASTRA_BASE_URL ?? 'http://localhost:8788'}/?debug=1`,
  );
  await page.bringToFront();
  await page.waitForFunction(() => window.__ASTRA__?.phase === 'menu');
  report.graphics = await page.evaluate(() => {
    const gl = window.__ASTRA__.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      visible: document.visibilityState,
      focused: document.hasFocus(),
    };
  });
  assert.ok(!/swiftshader|llvmpipe/i.test(report.graphics.renderer));
  assert.equal(report.graphics.visible, 'visible');
  assert.equal(report.graphics.focused, true);
  await page.evaluate(() =>
    window.__ASTRA__.updateSettings({
      quality: 'balanced',
      camera: 'chase',
      sound: false,
      assists: true,
    }),
  );
  for (const [circuit, weather] of [
    ['riviera', 'sunset'],
    ['forest', 'clear'],
    ['marina', 'rain'],
  ]) {
    await page.evaluate(
      async ([circuit, weather]) => {
        await window.__ASTRA__.configure({ circuit, weather, mode: 'race' });
        await window.__ASTRA__.start();
        window.__pilot = setInterval(
          () => window.__ASTRA__.debugDrive(true),
          25,
        );
      },
      [circuit, weather],
    );
    await page.waitForFunction(() => window.__ASTRA__.telemetry.raceTime >= 8);
    await page.screenshot({ path: `${output}/${circuit}-8s.png` });
    await page.waitForFunction(
      (seconds) => window.__ASTRA__.telemetry.raceTime >= seconds,
      seconds,
    );
    await page.screenshot({ path: `${output}/${circuit}-moving.png` });
    const d = await page.evaluate(() => {
      const e = window.__ASTRA__;
      clearInterval(window.__pilot);
      e.debugDrive(false);
      const result = e.diagnostics();
      result.visible = document.visibilityState;
      result.focused = document.hasFocus();
      e.pause();
      return result;
    });
    // Use only the tail of this race, omitting startup and the first capture.
    const samples = d.history
      .filter((s) => s.phase === 'racing')
      .slice(-Math.floor(seconds - 9));
    assert.ok(samples.length >= 5);
    assert.equal(d.visible, 'visible');
    assert.equal(d.focused, true);
    assert.equal(d.telemetry.phase, 'racing');
    assert.equal(
      d.renderer.devicePixelRatio,
      2,
      'Context DPR must survive navigation and screenshots',
    );
    assert.ok(d.renderer.size[0] * d.renderer.size[1] <= 1920 * 1080);
    const fps = samples.map((s) => s.fps).sort((a, b) => a - b);
    report.runs.push({
      circuit,
      weather,
      raceTime: d.telemetry.raceTime,
      speed: d.telemetry.speed,
      fpsMedian: fps[Math.floor(fps.length / 2)],
      fpsP10: fps[Math.floor(fps.length * 0.1)],
      endingRollingGpuP95: d.gpuMs,
      highestCpuSubmitP95: Math.max(...samples.map((s) => s.renderP95)),
      renderer: d.renderer,
      samples,
    });
    console.log(
      circuit,
      JSON.stringify(report.runs.at(-1), (k, v) =>
        k === 'samples' ? undefined : v,
      ),
    );
  }
  assert.deepEqual(errors, []);
  report.status = 'passed';
} catch (e) {
  report.status = 'failed';
  report.failure = e.message;
  throw e;
} finally {
  await page
    .evaluate(() => {
      clearInterval(window.__pilot);
      window.__ASTRA__?.debugDrive(false);
      window.__ASTRA__?.pause();
    })
    .catch(() => {});
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  await context.close();
  await browser.close();
}
