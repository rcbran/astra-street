import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

// Repeatable visual poses through the real game camera, world and presentation.
// These frozen diagnostic poses are not human driving or FPS evidence.
const output = process.env.ASTRA_OUTPUT ?? 'artifacts/reference-check';
const origin = process.env.ASTRA_BASE_URL ?? 'http://localhost:3000';
await mkdir(output, { recursive: true });
const browser = await chromium.connectOverCDP(
  process.env.ASTRA_CDP ?? 'http://localhost:9224',
);
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
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
    'Frozen authored poses through actual rendering; visual comparison only, not performance or driving evidence.',
  poses: [],
  errors: [],
};
page.on('pageerror', (error) => report.errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') report.errors.push(message.text());
});
try {
  await page.goto(`${origin}/?debug=1`);
  await page.waitForFunction(() => window.__ASTRA__?.phase === 'menu');
  report.graphics = await page.evaluate(() => {
    const e = window.__ASTRA__,
      gl = e.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
      headless: /HeadlessChrome/.test(navigator.userAgent),
    };
  });
  assert.equal(report.graphics.headless, true);
  assert.ok(!/swiftshader|llvmpipe|software/i.test(report.graphics.renderer));
  for (const circuit of (process.env.ASTRA_CIRCUITS ?? 'riviera').split(',')) {
    const label = {
      riviera: 'Canyon Run',
      forest: 'Pinecrest',
      marina: 'Harbor City',
    }[circuit];
    // Configure through the product controls so React's options match the engine.
    await page.locator('.circuit-option').filter({ hasText: label }).click();
    await page.waitForFunction(
      (circuit) =>
        window.__ASTRA__?.phase === 'menu' &&
        window.__ASTRA__.options.circuit === circuit,
      circuit,
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
    await page.getByRole('tab', { name: 'Time trial', exact: true }).click();
    await page.evaluate(() => {
      const e = window.__ASTRA__;
      e.updateSettings({
        quality: 'balanced',
        camera: 'chase',
        sound: false,
        assists: true,
      });
    });
    await page.getByRole('button', { name: 'GO RACING', exact: true }).click();
    await page.waitForFunction(() => window.__ASTRA__?.phase === 'countdown');
    await page.evaluate(() => {
      const e = window.__ASTRA__;
      cancelAnimationFrame(e.animation);
      e.phase = e.session.phase = 'racing';
      e.session.countdown = 0;
      e.input.clear();
    });
    for (const [index, fraction] of [
      0.06, 0.18, 0.36, 0.58, 0.78, 0.93,
    ].entries()) {
      const pose = await page.evaluate(
        ({ fraction, index }) => {
          const e = window.__ASTRA__;
          Object.assign(e.player, {
            distance: e.track.length * fraction,
            speed: 65,
            offset: index % 2 ? 1.5 : 0,
            headingError: index % 2 ? 0.2 : 0,
            slipAngle: 0,
            steer: 0,
          });
          e.session.raceTime = 18 + index * 4;
          e.budget.reset();
          e.resize();
          e.cameraRig.reset();
          e.draw(0);
          e.renderer.info.reset();
          e.presentation.render(e.scene, e.camera, e.settings.quality);
          e.emit();
          const d = e.diagnostics();
          return {
            fraction,
            position: d.position,
            renderer: d.renderer,
            camera: e.camera.position.toArray(),
            car: e.playerVisual.group.position.toArray(),
            scenery: e.world.root.userData,
          };
        },
        { fraction, index },
      );
      // Allow React to present the same snapshot as the frozen canvas.
      await page.waitForTimeout(150);
      assert.deepEqual(
        report.errors,
        [],
        'No shader or browser errors in comparison pose',
      );
      const filename = `${circuit}-${index}.png`;
      await page.screenshot({ path: `${output}/${filename}` });
      report.poses.push({ circuit, filename, ...pose });
    }
    await page.evaluate(() => window.__ASTRA__.menu());
    await page.waitForFunction(() => window.__ASTRA__?.phase === 'menu');
  }
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
  console.log(
    `Captured ${report.poses.length} frozen reference-comparison poses.`,
  );
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  throw error;
} finally {
  await writeFile(
    `${output}/report.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  await context.close();
  await browser.close();
}
