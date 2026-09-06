import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { chromium } from '@playwright/test';

// Functional render checks. Timing from headless/software rendering is not a
// hardware performance benchmark; use benchmark.mjs in a visible GPU browser.
const browser = await chromium.connectOverCDP(
  process.env.ASTRA_CDP ?? 'http://localhost:9224',
);
const context =
  browser.contexts().find((c) => c.pages().length) ?? browser.contexts()[0];
const page = context.pages()[0] ?? (await context.newPage());
page.setDefaultTimeout(120_000);
const cdp = await page.context().newCDPSession(page);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
const report = {
  date: new Date().toISOString(),
  host: hostname(),
  browser: await browser.version(),
  resolution: [],
  worlds: [],
  memory: [],
  errors,
};
await mkdir('artifacts', { recursive: true });
const metrics = async (width, height, dpr) => {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: dpr,
    mobile: false,
  });
  await page.waitForFunction(
    ([w, h, d]) =>
      innerWidth === w && innerHeight === h && devicePixelRatio === d,
    [width, height, dpr],
  );
};
const resolution = async (label, quality) => {
  await page.evaluate(
    (quality) =>
      window.__ASTRA__.updateSettings({
        ...window.__ASTRA__.settings,
        quality,
      }),
    quality,
  );
  await page.waitForFunction(() => {
    const e = window.__ASTRA__;
    const budget =
      e.settings.quality === 'eco'
        ? 1280 * 720
        : e.settings.quality === 'ultra'
          ? 2560 * 1440
          : 1920 * 1080;
    const cap = e.settings.quality === 'ultra' ? 2 : 1.5;
    const expected = Math.min(
      devicePixelRatio,
      cap,
      Math.sqrt(budget / (innerWidth * innerHeight)),
    );
    return Math.abs(e.renderer.getPixelRatio() - expected) < 0.00001;
  });
  const row = await page.evaluate((label) => {
    const e = window.__ASTRA__,
      gl = e.renderer.getContext();
    return {
      label,
      ...e.diagnostics().renderer,
      quality: e.settings.quality,
      drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
    };
  }, label);
  assert.deepEqual(row.size, row.drawingBuffer);
  const ceiling =
    quality === 'eco'
      ? 1280 * 720
      : quality === 'ultra'
        ? 2560 * 1440
        : 1920 * 1080;
  assert.ok(row.size[0] * row.size[1] <= ceiling);
  report.resolution.push(row);
};
try {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(
    `${process.env.ASTRA_BASE_URL ?? 'http://localhost:8788'}/?debug=1`,
  );
  await page.bringToFront();
  await page.waitForFunction(() => window.__ASTRA__?.phase === 'menu');
  report.graphics = await page.evaluate(() => {
    const gl = window.__ASTRA__.renderer.getContext(),
      ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : gl.getParameter(gl.RENDERER),
      userAgent: navigator.userAgent,
    };
  });
  await page.evaluate(() =>
    window.__ASTRA__.updateSettings({
      quality: 'balanced',
      camera: 'chase',
      assists: true,
      sound: false,
    }),
  );
  await metrics(1440, 900, 1);
  await resolution('DPR 1', 'balanced');
  await metrics(1440, 900, 2);
  await resolution('DPR-only change to 2', 'balanced');
  await resolution('DPR 2 Eco', 'eco');
  await resolution('DPR 2 Ultra', 'ultra');
  await metrics(1920, 1080, 2);
  await resolution('1080p CSS at DPR 2', 'balanced');
  await metrics(2560, 1440, 2);
  await resolution('1440p CSS at DPR 2', 'ultra');
  await metrics(1440, 900, 1);
  await resolution('Return to DPR 1', 'balanced');
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
  await page.waitForFunction(() => !!document.fullscreenElement);
  await resolution('Fullscreen entry', 'balanced');
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForFunction(() => !document.fullscreenElement);
  await resolution('Fullscreen exit', 'balanced');
  console.log('PASS: DPR transitions, quality ceilings and fullscreen.');

  await page.evaluate(async () => {
    await window.__ASTRA__.configure({
      circuit: 'riviera',
      weather: 'sunset',
      mode: 'race',
    });
    await window.__ASTRA__.start();
    window.__pilot = setInterval(() => window.__ASTRA__.debugDrive(true), 25);
  });
  await page.waitForFunction(() => window.__ASTRA__.telemetry.raceTime > 8);
  await page.screenshot({ path: 'artifacts/chase-render-check.png' });
  report.chase = await page.evaluate(() => {
    clearInterval(window.__pilot);
    window.__ASTRA__.debugDrive(false);
    const e = window.__ASTRA__,
      f = e.track.sample(e.player.distance);
    const origin = {
      x: f.x + f.nx * e.player.offset,
      y: f.y + 0.04,
      z: f.z + f.nz * e.player.offset,
    };
    const distance = Math.hypot(
      e.camera.position.x - origin.x,
      e.camera.position.z - origin.z,
    );
    const result = {
      ...e.diagnostics(),
      cameraHorizontalDistance: distance,
      cameraHeight: e.camera.position.y - origin.y,
    };
    e.pause();
    return result;
  });
  assert.ok(report.chase.telemetry.speed > 130);
  assert.ok(
    report.chase.cameraHorizontalDistance > 8 &&
      report.chase.cameraHorizontalDistance < 13,
  );
  console.log(
    'PASS: moving chase camera distance at',
    report.chase.telemetry.speed,
    'km/h.',
  );

  await page.setViewportSize({ width: 960, height: 540 });
  await page.evaluate(() =>
    window.__ASTRA__.updateSettings({
      ...window.__ASTRA__.settings,
      quality: 'eco',
    }),
  );
  for (const circuit of ['riviera', 'forest', 'marina']) {
    for (const weather of ['clear', 'sunset', 'rain']) {
      await page.evaluate(
        async ([circuit, weather]) =>
          window.__ASTRA__.configure({ circuit, weather, mode: 'race' }),
        [circuit, weather],
      );
      const d = await page.evaluate(() => window.__ASTRA__.diagnostics());
      assert.equal(d.telemetry.phase, 'menu');
      assert.ok(d.carLoaded && d.renderer.render.calls > 0);
      report.worlds.push({ circuit, weather, renderer: d.renderer });
      if (
        (circuit === 'riviera' && weather === 'sunset') ||
        (circuit === 'forest' && weather === 'clear') ||
        (circuit === 'marina' && weather === 'rain')
      ) {
        await page.screenshot({ path: `artifacts/${circuit}-gengar.png` });
      }
    }
  }
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const [circuit, weather] of [
      ['riviera', 'sunset'],
      ['forest', 'clear'],
      ['marina', 'rain'],
    ]) {
      await page.evaluate(
        async ([circuit, weather]) =>
          window.__ASTRA__.configure({ circuit, weather, mode: 'race' }),
        [circuit, weather],
      );
      const memory = await page.evaluate(
        () => window.__ASTRA__.diagnostics().renderer.memory,
      );
      report.memory.push({ cycle, circuit, ...memory });
    }
  }
  for (const circuit of ['riviera', 'forest', 'marina']) {
    const rows = report.memory.filter((row) => row.circuit === circuit);
    assert.equal(rows[1].geometries, rows[2].geometries);
    assert.equal(rows[1].textures, rows[2].textures);
  }
  assert.deepEqual(errors, []);
  report.status = 'passed';
  console.log(
    'PASS: nine circuit/weather worlds, resource cycles and no browser errors.',
  );
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  report.failureRenderer = await page
    .evaluate(() => window.__ASTRA__?.diagnostics().renderer)
    .catch(() => null);
  throw error;
} finally {
  await page
    .evaluate(() => {
      clearInterval(window.__pilot);
      window.__ASTRA__?.debugDrive(false);
      window.__ASTRA__?.pause();
    })
    .catch(() => {});
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await writeFile(
    'artifacts/render-check.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  await page.close();
  await browser.close();
}
