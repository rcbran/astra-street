import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

// Real fixed-step driving using the test pilot plus keyboard drift/boost inputs.
// Video encoding and screenshots affect pacing; this is not an FPS benchmark.
const output = process.env.ASTRA_OUTPUT ?? 'artifacts/driving-capture';
await mkdir(output, { recursive: true });
const browser = await chromium.connectOverCDP(
  process.env.ASTRA_CDP ?? 'http://localhost:9224',
);
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  recordVideo: { dir: `${output}/video`, size: { width: 1920, height: 1080 } },
});
const page = await context.newPage();
page.setDefaultTimeout(120000);
const report = {
  at: new Date().toISOString(),
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  sourceDirty: !!execFileSync('git', ['status', '--porcelain'], {
    encoding: 'utf8',
  }).trim(),
  purpose:
    'Actual simulated race with pilot steering and keyboard drift/boost, opponents active. Capture timing is not a performance benchmark.',
  captures: [],
  errors: [],
};
page.on('pageerror', (e) => report.errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') report.errors.push(m.text());
});
const until = async (time) =>
  page.waitForFunction(
    (time) => window.__ASTRA__.telemetry.raceTime >= time,
    time,
  );
const driveFor = async (seconds) =>
  until(
    await page.evaluate(
      (seconds) => window.__ASTRA__.telemetry.raceTime + seconds,
      seconds,
    ),
  );
const capture = async (name) => {
  const state = await page.evaluate(() => {
    const e = window.__ASTRA__;
    return {
      telemetry: e.telemetry,
      position: e.diagnostics().position,
      renderer: e.diagnostics().renderer,
      input: e.input.read(),
      opponents: e.opponents.map((d) => ({
        distance: d.distance,
        offset: d.offset,
        speed: d.speed,
      })),
      slipAngle: e.player.slipAngle,
    };
  });
  assert.equal(state.telemetry.phase, 'racing');
  assert.deepEqual(report.errors, []);
  await page.screenshot({ path: `${output}/${name}.png` });
  report.captures.push({ name, ...state });
};
try {
  await page.goto(
    `${process.env.ASTRA_BASE_URL ?? 'http://localhost:3000'}/?debug=1`,
  );
  await page.waitForFunction(() => window.__ASTRA__?.phase === 'menu');
  report.graphics = await page.evaluate(() => {
    const gl = window.__ASTRA__.renderer.getContext(),
      ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
      userAgent: navigator.userAgent,
    };
  });
  assert.match(report.graphics.userAgent, /HeadlessChrome/);
  assert.ok(
    report.graphics.renderer &&
      !/swiftshader|llvmpipe|software/i.test(report.graphics.renderer),
  );
  await page
    .locator('.circuit-option')
    .filter({ hasText: 'Canyon Run' })
    .click();
  await page.waitForFunction(
    () =>
      window.__ASTRA__?.phase === 'menu' &&
      window.__ASTRA__.options.circuit === 'riviera',
  );
  await page
    .locator('.weather-option')
    .filter({ hasText: 'Golden hour' })
    .click();
  await page.waitForFunction(
    () =>
      window.__ASTRA__?.phase === 'menu' &&
      window.__ASTRA__.options.weather === 'sunset',
  );
  await page.getByRole('tab', { name: 'Quick race', exact: true }).click();
  await page.evaluate(() =>
    window.__ASTRA__.updateSettings({
      quality: 'balanced',
      camera: 'chase',
      assists: true,
      sound: false,
    }),
  );
  await page.getByRole('button', { name: 'GO RACING', exact: true }).click();
  await page.evaluate(() => {
    window.__pilot = setInterval(() => window.__ASTRA__.debugDrive(true), 25);
  });
  await until(5);
  await capture('01-race');
  await page.keyboard.down('Space');
  await page.keyboard.down('d');
  await driveFor(0.45);
  await capture('02-drift');
  assert.ok(
    Math.abs(report.captures.at(-1).slipAngle) > 0.12,
    'Actual drift required',
  );
  await page.keyboard.up('d');
  await page.keyboard.up('Space');
  await driveFor(0.5);
  await capture('03-smoke');
  await driveFor(1.5);
  await page.keyboard.down('Shift');
  await page.keyboard.down('w');
  await driveFor(1.1);
  await capture('04-boost');
  assert.equal(
    report.captures.at(-1).telemetry.boosting,
    true,
    'Actual boost required',
  );
  await driveFor(1.5);
  await page.keyboard.up('Shift');
  await page.keyboard.up('w');
  await until(18);
  await capture('05-canyon');
  await until(25);
  await capture('06-rivals');
  await until(32);
  await capture('07-sweeper');
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  console.log(
    'Captured seven actual driving views and a continuous headless video.',
  );
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  throw error;
} finally {
  await page
    .evaluate(() => {
      clearInterval(window.__pilot);
      window.__ASTRA__?.debugDrive(false);
      window.__ASTRA__?.input.clear();
    })
    .catch(() => {});
  report.video = await page.video()?.path();
  await context.close();
  await writeFile(
    `${output}/report.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await browser.close();
}
