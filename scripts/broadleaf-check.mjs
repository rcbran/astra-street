import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

// Frozen real-world comparisons retain the normal presentation pipeline.
// Baseline is optional; it must be an exported tree_small_02 GLB.
const output = process.env.ASTRA_OUTPUT ?? 'artifacts/broadleaf-check';
const origin = process.env.ASTRA_BASE_URL ?? 'http://localhost:3000';
const candidate =
  process.env.ASTRA_CANDIDATE_GLB ??
  'public/assets/models/trees/tree_small_02.glb';
const bytes = await readFile(candidate);
function leafPng(raw) {
  const jsonLength = raw.readUInt32LE(12);
  const doc = JSON.parse(raw.subarray(20, 20 + jsonLength));
  const image = doc.images.find(
    (image) => image.name === 'tree_small_02_leaves_diff',
  );
  const view = doc.bufferViews[image.bufferView];
  const start = 28 + jsonLength + view.byteOffset;
  return raw.subarray(start, start + view.byteLength);
}
const baseline =
  process.env.ASTRA_BASELINE_GLB &&
  (await readFile(process.env.ASTRA_BASELINE_GLB));
await mkdir(output, { recursive: true });
const browser = await chromium.connectOverCDP(
  process.env.ASTRA_CDP ?? 'http://localhost:9224',
);
const report = {
  at: new Date().toISOString(),
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  sourceDirty: !!execFileSync('git', ['status', '--porcelain'], {
    encoding: 'utf8',
  }).trim(),
  assetSha256: createHash('sha256').update(bytes).digest('hex'),
  baselineSha256:
    baseline && createHash('sha256').update(baseline).digest('hex'),
  purpose: 'Frozen driving/weather texture comparison; not a timing benchmark.',
  captures: [],
  errors: [],
};
try {
  for (const [id, label] of [
    ['forest', 'Pinecrest'],
    ['riviera', 'Canyon Run'],
  ]) {
    for (const [weather, weatherLabel] of [
      ['clear', 'Clear sky'],
      ['sunset', 'Golden hour'],
      ['rain', 'Wet night'],
    ]) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 2,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(120000);
      page.on('pageerror', (error) => report.errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') report.errors.push(message.text());
      });
      try {
        await page.route('**/assets/models/trees/tree_small_02.glb', (route) =>
          route.fulfill({ body: bytes, contentType: 'model/gltf-binary' }),
        );
        if (baseline)
          await page.route('**/__baseline_leaf.png', (route) =>
            route.fulfill({
              body: leafPng(baseline),
              contentType: 'image/png',
            }),
          );
        await page.goto(`${origin}/?debug=1`);
        await page.waitForFunction(() => window.__ASTRA__?.phase === 'menu');
        await page
          .locator('.circuit-option')
          .filter({ hasText: label })
          .click();
        await page
          .locator('.weather-option')
          .filter({ hasText: weatherLabel })
          .click();
        await page.waitForFunction(
          ({ id, weather }) =>
            window.__ASTRA__.options.circuit === id &&
            window.__ASTRA__.options.weather === weather,
          { id, weather },
        );
        await page
          .getByRole('button', { name: 'GO RACING', exact: true })
          .click();
        await page.evaluate(() => {
          window.__pilot = setInterval(
            () => window.__ASTRA__.debugDrive(true),
            25,
          );
        });
        await page.waitForFunction(
          () => window.__ASTRA__.telemetry.raceTime >= 5,
        );
        const capture = await page.evaluate(async (withBaseline) => {
          const e = window.__ASTRA__;
          clearInterval(window.__pilot);
          e.debugDrive(false);
          e.input.clear();
          cancelAnimationFrame(e.animation);
          const T = await import('/node_modules/.vite/deps/three.js');
          const materials = [...e.treeAssets.materials].filter(
            (m) => m.name === 'tree_small_02_leaves_game',
          );
          const maps = materials.map((m) => m.map);
          const baselineMap = withBaseline
            ? await new T.TextureLoader().loadAsync('/__baseline_leaf.png')
            : null;
          if (baselineMap) {
            baselineMap.flipY = false;
            baselineMap.colorSpace = T.SRGBColorSpace;
            baselineMap.anisotropy = maps[0].anisotropy;
            baselineMap.needsUpdate = true;
          }
          window.__BROADLEAF_QA__ = { materials, maps, baselineMap };
          const gl = e.renderer.getContext(),
            ext = gl.getExtension('WEBGL_debug_renderer_info');
          return {
            at: new Date().toISOString(),
            raceTime: e.telemetry.raceTime,
            distance: e.player.distance,
            framebuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
            renderer: ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL),
            headless: /HeadlessChrome/.test(navigator.userAgent),
            mapSettings: maps.map((m) => ({
              minFilter: m.minFilter,
              magFilter: m.magFilter,
              anisotropy: m.anisotropy,
              generateMipmaps: m.generateMipmaps,
            })),
          };
        }, !!baseline);
        assert.equal(capture.headless, true);
        assert.ok(!/swiftshader|llvmpipe/i.test(capture.renderer));
        assert.ok(capture.mapSettings.length);
        for (const map of capture.mapSettings) {
          assert.equal(map.minFilter, 1008); // LinearMipmapLinearFilter
          assert.equal(map.magFilter, 1006); // LinearFilter
          assert.equal(map.generateMipmaps, true);
          assert.equal(map.anisotropy, 8);
        }
        for (const mode of baseline ? ['baseline', 'padded'] : ['padded']) {
          await page.evaluate((mode) => {
            const e = window.__ASTRA__,
              qa = window.__BROADLEAF_QA__;
            qa.materials.forEach((m, i) => {
              m.map = mode === 'baseline' ? qa.baselineMap : qa.maps[i];
            });
            e.presentation.render(e.scene, e.camera, e.settings.quality);
          }, mode);
          await page.screenshot({
            path: `${output}/${id}-${weather}-${mode}.png`,
          });
        }
        report.captures.push({ circuit: id, weather, ...capture });
        console.log(
          `${id}/${weather}: filtered atlas captured at ${capture.framebuffer.join('×')}`,
        );
      } finally {
        await page
          .evaluate(() => {
            clearInterval(window.__pilot);
            window.__ASTRA__?.debugDrive(false);
            const qa = window.__BROADLEAF_QA__;
            qa?.materials.forEach((m, i) => {
              m.map = qa.maps[i];
            });
            qa?.baselineMap?.dispose();
          })
          .catch(() => {});
        await context.close();
      }
      await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
      assert.deepEqual(report.errors, []);
    }
  }
} finally {
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
