import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { chromium } from '@playwright/test';

// Functional render checks; use benchmark.mjs for headless full-race timing.
const browser = await chromium.connectOverCDP(
  process.env.ASTRA_CDP ?? 'http://localhost:9224',
);
const context = await browser.newContext();
const page = await context.newPage();
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
      presentation: {
        beauty: [e.presentation.beauty.width, e.presentation.beauty.height],
        contact: [e.presentation.ao.width, e.presentation.ao.height],
        returnedToCanvas: e.renderer.getRenderTarget() === null,
      },
    };
  }, label);
  assert.deepEqual(row.size, row.drawingBuffer);
  assert.deepEqual(row.presentation.beauty, row.drawingBuffer);
  assert.deepEqual(
    row.presentation.contact,
    row.drawingBuffer.map((n) => Math.ceil(n / 2)),
  );
  assert.equal(row.presentation.returnedToCanvas, true);
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
  await page.evaluate(() => {
    const e = window.__ASTRA__;
    window.__ownership = {
      trees: 0,
      scans: 0,
      surfaces: 0,
      environment: 0,
      beauty: 0,
      contact: 0,
    };
    for (const collection of [
      e.treeAssets.geometries,
      e.treeAssets.materials,
      e.treeAssets.textures,
    ])
      for (const resource of collection)
        resource.addEventListener('dispose', () => window.__ownership.trees++);
    for (const collection of [
      e.canyonScans.geometries,
      e.canyonScans.materials,
      e.canyonScans.textures,
    ])
      for (const resource of collection)
        resource.addEventListener('dispose', () => window.__ownership.scans++);
    for (const texture of Object.values(e.surfaces))
      texture.addEventListener('dispose', () => window.__ownership.surfaces++);
    e.environment.addEventListener(
      'dispose',
      () => window.__ownership.environment++,
    );
    e.presentation.beauty.addEventListener(
      'dispose',
      () => window.__ownership.beauty++,
    );
    e.presentation.ao.addEventListener(
      'dispose',
      () => window.__ownership.contact++,
    );
  });
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
    report.chase.cameraHorizontalDistance > 20 &&
      report.chase.cameraHorizontalDistance < 26,
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
  report.ownership = await page.evaluate(() => {
    const e = window.__ASTRA__,
      before = { ...window.__ownership };
    const expectedTrees =
      e.treeAssets.geometries.size +
      e.treeAssets.materials.size +
      e.treeAssets.textures.size;
    const expectedSurfaces = Object.values(e.surfaces).length;
    const expectedScans =
      e.canyonScans.geometries.size +
      e.canyonScans.materials.size +
      e.canyonScans.textures.size;
    e.dispose();
    const after = { ...window.__ownership };
    e.dispose();
    return {
      before,
      after,
      repeated: { ...window.__ownership },
      expectedTrees,
      expectedSurfaces,
      expectedScans,
    };
  });
  assert.equal(report.ownership.before.trees, 0);
  assert.equal(report.ownership.before.scans, 0);
  assert.equal(report.ownership.before.surfaces, 0);
  assert.equal(report.ownership.before.environment, 0);
  assert.equal(report.ownership.after.trees, report.ownership.expectedTrees);
  assert.equal(report.ownership.after.scans, report.ownership.expectedScans);
  assert.equal(
    report.ownership.after.surfaces,
    report.ownership.expectedSurfaces,
  );
  assert.equal(report.ownership.after.environment, 1);
  assert.equal(
    report.ownership.after.beauty,
    report.ownership.before.beauty + 1,
  );
  assert.equal(
    report.ownership.after.contact,
    report.ownership.before.contact + 1,
  );
  assert.deepEqual(report.ownership.repeated, report.ownership.after);
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
  await context.close();
  await browser.close();
}
