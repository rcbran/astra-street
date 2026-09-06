import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

// A dedicated context, no live race, and no requestAnimationFrame loop. Captures
// assess shape and materials; they intentionally make no FPS or display claims.
const output = resolve(
  process.env.ASTRA_OUTPUT ?? 'artifacts/tree-angle-check',
);
await mkdir(output, { recursive: true });
const browser = await chromium.connectOverCDP(
  process.env.ASTRA_CDP ?? 'http://localhost:9224',
);
const context = await browser.newContext({
  viewport: { width: 900, height: 1050 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.setDefaultTimeout(120_000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
const report = {
  at: new Date().toISOString(),
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  sourceDirty: !!execFileSync('git', ['status', '--porcelain'], {
    encoding: 'utf8',
  }).trim(),
  browser: browser.version(),
  purpose: 'Static all-angle shape/material QA. Not a performance benchmark.',
  specimens: [],
  captures: [],
  errors,
};
const escape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;');
try {
  report.assetHashes = await Promise.all(
    ['fir_tree_01', 'pine_tree_01', 'tree_small_02'].map(async (name) => {
      const path = `public/assets/models/trees/${name}.glb`;
      const bytes = await readFile(path);
      return {
        path,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      };
    }),
  );
  const galleryKind = process.env.ASTRA_GALLERY ?? 'tree';
  assert.ok(
    ['tree', 'undergrowth'].includes(galleryKind),
    'ASTRA_GALLERY must be tree or undergrowth',
  );
  const galleryFilename = `${galleryKind}-gallery.html`;
  const galleryUrl =
    process.env.ASTRA_GALLERY_URL ??
    new URL(
      `/scripts/fixtures/tree-gallery/${galleryFilename}`,
      process.env.ASTRA_BASE_URL ?? 'http://localhost:3000',
    ).href;
  // The HTML fixture is tracked beside this script. Vinext redirects .html
  // routes, so fulfill only the document; its JS and runtime TS imports still
  // pass through the actual dev-server Vite module pipeline.
  const galleryFile =
    process.env.ASTRA_GALLERY_HTML ??
    fileURLToPath(
      new URL(`./fixtures/tree-gallery/${galleryFilename}`, import.meta.url),
    );
  await page.route(galleryUrl, (route) =>
    route.fulfill({ path: galleryFile, contentType: 'text/html' }),
  );
  await page.goto(galleryUrl);
  if (errors.length) throw new Error(errors.join('\n'));
  await Promise.race([
    page.waitForFunction(() => window.__TREE_QA__?.species.length),
    new Promise((_, reject) =>
      page.once('pageerror', (error) => reject(error)),
    ),
  ]);
  const { graphics, species } = await page.evaluate(() => ({
    graphics: window.__TREE_QA__.graphics,
    species: window.__TREE_QA__.species,
  }));
  report.graphics = graphics;
  assert.equal(
    graphics.captureMode,
    'headless',
    'Tree QA must stay off the user screen',
  );
  assert.ok(
    !/swiftshader|llvmpipe/i.test(graphics.renderer),
    'Use the actual GPU',
  );
  const requested = process.env.ASTRA_TREE_SPECIES?.split(',');
  const targets = requested
    ? species.filter((s) => requested.includes(s.id))
    : species;
  assert.ok(targets.length, 'At least one requested species must exist');
  const allLods = process.env.ASTRA_ALL_LODS === '1';
  const requestedLods = process.env.ASTRA_LODS?.split(',').map(Number);
  for (const species of targets) {
    for (let lod = 0; lod < (allLods ? species.lods : 1); lod++) {
      if (requestedLods && !requestedLods.includes(lod)) continue;
      const specimen = await page.evaluate(
        ({ id, lod }) => window.__TREE_QA__.select(id, lod),
        { id: species.id, lod },
      );
      assert.ok(
        specimen.bounds.size.every((n) => n > 0),
        'Tree volume must span all three axes',
      );
      report.specimens.push(specimen);
      const views =
        lod === 0
          ? [
              ...Array.from({ length: 12 }, (_, i) => ({
                azimuth: i * 30,
                elevation: 0,
              })),
              ...[0, 90, 180, 270].flatMap((azimuth) => [
                { azimuth, elevation: -12 },
                { azimuth, elevation: 32 },
              ]),
              ...[0, 45, 90, 135, 180, 225, 270, 315].map((azimuth) => ({
                azimuth,
                elevation: 0,
                silhouette: true,
              })),
              { azimuth: 45, elevation: 8, light: 'sunset' },
              { azimuth: 225, elevation: 8, light: 'rain' },
            ]
          : [false, true].flatMap((silhouette) =>
              [0, 45, 90, 135, 180, 225, 270, 315].map((azimuth) => ({
                azimuth,
                elevation: 0,
                silhouette,
              })),
            );
      for (const view of views) {
        const safeId = species.id.replace(/[^a-zA-Z0-9_-]/g, '-');
        const filename = `${safeId}-lod${lod}-a${view.azimuth}-e${view.elevation}${view.silhouette ? '-silhouette' : view.light ? `-${view.light}` : ''}.png`;
        const info = await page.evaluate(
          (v) =>
            window.__TREE_QA__.frame(
              v.azimuth,
              v.elevation,
              v.silhouette ?? false,
              v.light ?? 'clear',
            ),
          view,
        );
        await page.screenshot({ path: `${output}/${filename}` });
        report.captures.push({
          species: species.id,
          lod,
          filename,
          ...info,
          captureEndedAt: new Date().toISOString(),
        });
      }
      const masks = report.captures.filter(
        (c) =>
          c.species === species.id && c.lod === lod && c.silhouetteCoverage,
      );
      if (masks.length) {
        const areas = masks.map((c) => c.silhouetteCoverage.pixels);
        specimen.silhouetteMinMaxAreaRatio =
          Math.min(...areas) / Math.max(...areas);
        specimen.silhouetteAveragePixels =
          areas.reduce((a, b) => a + b, 0) / areas.length;
        const near = report.specimens.find(
          (s) => s.id === species.id && s.lod === 0,
        );
        if (lod > 0 && near?.silhouetteAveragePixels)
          specimen.coverageRelativeToNear =
            specimen.silhouetteAveragePixels / near.silhouetteAveragePixels;
        specimen.silhouetteAssessment =
          'Descriptive only: low ratios flag an angle for visual review; natural asymmetric crowns can legitimately differ.';
      }
      console.log(JSON.stringify({ specimen, views: views.length }));
    }
  }
  // Compact, inspectable contact sheets use a 2D page after 3D captures finish.
  // Inline images avoid file-URL permissions and introduce no package dependency.
  const sheet = await context.newPage();
  await sheet.setViewportSize({ width: 1200, height: 1000 });
  report.contactSheets = [];
  for (const specimen of report.specimens) {
    const captures = report.captures.filter(
      (c) => c.species === specimen.id && c.lod === specimen.lod,
    );
    for (const [suffix, views] of [
      ['eye-level', captures.filter((c) => c.elevation === 0 && !c.silhouette)],
      ['silhouettes', captures.filter((c) => c.silhouette)],
      ['elevations-weather', captures.filter((c) => c.elevation !== 0)],
    ]) {
      if (!views.length) continue;
      const cards = await Promise.all(
        views.map(
          async (c) =>
            `<figure><img src="data:image/png;base64,${(await readFile(`${output}/${c.filename}`)).toString('base64')}"><figcaption>${c.azimuth}° / ${c.elevation}° · ${c.silhouette ? 'silhouette' : c.light}</figcaption></figure>`,
        ),
      );
      await sheet.setContent(
        `<style>body{margin:0;background:#202629;color:white;font:14px system-ui}h1{font-size:22px;padding:12px;margin:0}.grid{display:grid;grid-template-columns:repeat(4,1fr)}figure{margin:4px}img{width:100%;display:block}figcaption{padding:5px}</style><h1>${escape(specimen.id)} · LOD ${specimen.lod} · ${suffix}</h1><div class="grid">${cards.join('')}</div>`,
      );
      await sheet
        .locator('img')
        .evaluateAll((images) =>
          Promise.all(images.map((image) => image.decode())),
        );
      const filename = `${specimen.id.replace(/[^a-zA-Z0-9_-]/g, '-')}-lod${specimen.lod}-${suffix}-sheet.png`;
      await sheet.screenshot({ path: `${output}/${filename}`, fullPage: true });
      report.contactSheets.push(filename);
    }
  }
  await sheet.close();
  assert.deepEqual(errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  throw error;
} finally {
  await writeFile(
    `${output}/report.json`,
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const sections = report.specimens
    .map(
      (s) =>
        `<section><h2>${escape(s.id)} · LOD ${s.lod}</h2><p>${Math.round(s.triangles).toLocaleString()} source triangles; bounds ${s.bounds.size.map((n) => n.toFixed(2)).join(' × ')} m</p><div class="grid">${report.captures
          .filter((c) => c.species === s.id && c.lod === s.lod)
          .map(
            (c) =>
              `<figure><a href="${escape(c.filename)}"><img src="${escape(c.filename)}" loading="lazy"></a><figcaption>${c.azimuth}° azimuth / ${c.elevation}° elevation · ${c.silhouette ? 'silhouette' : c.light}</figcaption></figure>`,
          )
          .join('')}</div></section>`,
    )
    .join('');
  await writeFile(
    `${output}/index.html`,
    `<!doctype html><meta charset="utf-8"><title>Astra tree angle inspection</title><style>body{margin:30px;background:#171b1d;color:#eee;font:16px system-ui}h2{margin-top:45px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}figure{margin:0}img{width:100%;display:block}figcaption{padding:8px 0;font-size:13px;color:#bfc9cd}a{color:inherit}</style><h1>Tree geometry and material inspection</h1><p>${escape(report.at)} · ${escape(report.graphics?.renderer ?? '')}</p><p>Original runtime tree assets under controlled lighting. Click a frame for full resolution. This is static visual QA, not an FPS measurement.</p>${sections}`,
  );
  await page.evaluate(() => window.__TREE_QA__?.dispose()).catch(() => {});
  await context.close();
  await browser.close();
}
