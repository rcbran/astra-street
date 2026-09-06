import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { hostname } from 'node:os';
import { chromium } from '@playwright/test';

// Short hardware sample after a rendering change. Record headless/visible mode
// explicitly; this does not establish full-race coverage or display pacing.
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
  captures: [],
  errors,
};
const capture = async (filename) => {
  const start = await page.evaluate(() => ({
    at: new Date().toISOString(),
    monotonicMs: performance.now(),
    raceTime: window.__ASTRA__.telemetry.raceTime,
    distance: window.__ASTRA__.player.distance,
  }));
  await page.screenshot({ path: `${output}/${filename}` });
  report.captures.push({
    filename,
    ...start,
    endedAt: new Date().toISOString(),
  });
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
      captureMode: /HeadlessChrome/.test(navigator.userAgent)
        ? 'headless'
        : 'visible',
      userAgent: navigator.userAgent,
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
    const label = {
      riviera: 'Canyon Run',
      forest: 'Pinecrest',
      marina: 'Harbor City',
    }[circuit];
    await page.locator('.circuit-option').filter({ hasText: label }).click();
    await page.waitForFunction(
      (circuit) =>
        window.__ASTRA__.options.circuit === circuit &&
        window.__ASTRA__.phase === 'menu',
      circuit,
    );
    await page.getByRole('button', { name: 'GO RACING', exact: true }).click();
    await page.evaluate(() => {
      window.__pilot = setInterval(() => window.__ASTRA__.debugDrive(true), 25);
    });
    await page.waitForFunction(() => window.__ASTRA__.telemetry.raceTime >= 8);
    await capture(`${circuit}-8s.png`);
    await page.waitForFunction(
      (seconds) => window.__ASTRA__.telemetry.raceTime >= seconds,
      seconds,
    );
    await capture(`${circuit}-moving.png`);
    const d = await page.evaluate(() => {
      const e = window.__ASTRA__;
      clearInterval(window.__pilot);
      e.debugDrive(false);
      const result = e.diagnostics();
      result.scenery = e.world.root.userData;
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
      scenery: d.scenery,
      samples,
    });
    await page
      .getByRole('button', { name: 'Back to circuits', exact: true })
      .click();
    await page.waitForFunction(() => window.__ASTRA__.phase === 'menu');
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
