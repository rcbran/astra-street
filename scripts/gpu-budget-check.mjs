import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const output = process.env.ASTRA_OUTPUT ?? 'artifacts/gpu-budget-check';
await mkdir(output, { recursive: true });
const browser = await chromium.connectOverCDP(
  process.env.ASTRA_CDP ?? 'http://localhost:9224',
);
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
page.setDefaultTimeout(120000);
const report = {
  at: new Date().toISOString(),
  build: process.env.ASTRA_BUILD_LABEL ?? 'unlabeled',
  buildSource: process.env.ASTRA_SOURCE_MANIFEST
    ? JSON.parse(await readFile(process.env.ASTRA_SOURCE_MANIFEST, 'utf8'))
    : null,
  purpose:
    'Frozen GPU ablations at identical pixels and pose, recording off. Shared hardware; not a race benchmark or visual equivalence claim.',
  runs: [],
  errors: [],
};
page.on('pageerror', (e) => report.errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') report.errors.push(m.text());
});
try {
  await page.goto(
    `${process.env.ASTRA_BASE_URL ?? 'http://localhost:8788'}/?debug=1`,
  );
  await page.waitForFunction(() => window.__ASTRA__?.phase === 'menu');
  for (const [circuit, weather] of [
    ['riviera', 'sunset'],
    ['forest', 'rain'],
  ]) {
    await page.evaluate(
      async ({ circuit, weather }) => {
        const e = window.__ASTRA__;
        await e.configure({ circuit, weather, mode: 'race' });
        e.updateSettings({
          quality: 'balanced',
          camera: 'chase',
          sound: false,
          assists: true,
        });
        await e.start();
        cancelAnimationFrame(e.animation);
        e.phase = e.session.phase = 'racing';
        e.session.countdown = 0;
        Object.assign(e.player, {
          distance: e.track.length * 0.06,
          speed: 65,
          offset: 0,
          headingError: 0,
          slipAngle: 0,
        });
        e.cameraRig.reset();
        e.budget.reset();
        e.resize();
        e.draw(0);
      },
      { circuit, weather },
    );
    const run = await page.evaluate(async () => {
      const e = window.__ASTRA__,
        r = e.renderer,
        gl = r.getContext(),
        ext = gl.getExtension('EXT_disjoint_timer_query_webgl2'),
        debug = gl.getExtension('WEBGL_debug_renderer_info');
      if (!ext || !debug) throw Error('Hardware GPU timers unavailable');
      const result = {
        renderer: gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
        userAgent: navigator.userAgent,
        framebuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
        samples: [],
        categories: {},
        world: e.world.root.userData,
      };
      const forest = e.world.root.getObjectByName('volumetric forest'),
        trees = [];
      forest.traverse((o) => {
        if (o.isMesh) trees.push({ object: o, cast: o.castShadow });
      });
      const cover = [];
      e.world.root.traverse((o) => {
        if (
          /curved roadside|forest floor ferns|branched understory/.test(o.name)
        )
          cover.push(o);
      });
      // Attribute submitted primitives once, separately for beauty and shadow.
      const callbacks = [];
      e.scene.traverse((o) => {
        if (!o.isMesh) return;
        const name =
          o.userData.treeDetail !== undefined
            ? `tree LOD${o.userData.treeDetail}`
            : o.name || 'other';
        const add = (pass) => {
          const key = `${pass}: ${name}`,
            v = result.categories[key] ?? { calls: 0, triangles: 0 };
          v.calls++;
          v.triangles +=
            ((o.geometry.index?.count ?? o.geometry.attributes.position.count) /
              3) *
            (o.isInstancedMesh ? o.count : 1);
          result.categories[key] = v;
        };
        const before = o.onBeforeRender,
          shadow = o.onBeforeShadow;
        callbacks.push([o, before, shadow]);
        o.onBeforeRender = function (...args) {
          add('beauty');
          before.apply(this, args);
        };
        o.onBeforeShadow = function (...args) {
          add('shadow');
          shadow.apply(this, args);
        };
      });
      r.info.reset();
      e.presentation.render(e.scene, e.camera, 'balanced');
      result.baselineDraw = { ...r.info.render };
      callbacks.forEach(([o, before, shadow]) => {
        o.onBeforeRender = before;
        o.onBeforeShadow = shadow;
      });
      const modes = [
        'baseline',
        'cached-shadow',
        'no-tree-shadows',
        'no-trees',
        'no-groundcover',
        'direct',
      ];
      for (let cycle = 0; cycle < 12; cycle++)
        for (const mode of cycle % 2 ? [...modes].reverse() : modes) {
          forest.visible = mode !== 'no-trees';
          cover.forEach((o) => (o.visible = mode !== 'no-groundcover'));
          trees.forEach(
            ({ object, cast }) =>
              (object.castShadow = cast && mode !== 'no-tree-shadows'),
          );
          r.shadowMap.autoUpdate = mode !== 'cached-shadow';
          // Warm each newly encountered shader path outside timed query on first cycle.
          if (!cycle) {
            r.info.reset();
            e.presentation.render(
              e.scene,
              e.camera,
              mode === 'direct' ? 'eco' : 'balanced',
            );
          }
          r.info.reset();
          const q = gl.createQuery();
          const start = performance.now();
          try {
            gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
            e.presentation.render(
              e.scene,
              e.camera,
              mode === 'direct' ? 'eco' : 'balanced',
            );
            gl.endQuery(ext.TIME_ELAPSED_EXT);
            const cpuMs = performance.now() - start,
              draw = { ...r.info.render },
              deadline = performance.now() + 10000;
            while (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) {
              if (performance.now() > deadline)
                throw Error('GPU query timeout');
              await new Promise((resolve) => setTimeout(resolve, 10));
            }
            if (gl.getParameter(ext.GPU_DISJOINT_EXT))
              throw Error('Disjoint GPU timer');
            if (cycle >= 2)
              result.samples.push({
                mode,
                gpuMs: Number(gl.getQueryParameter(q, gl.QUERY_RESULT)) / 1e6,
                cpuMs,
                ...draw,
              });
          } finally {
            gl.deleteQuery(q);
          }
        }
      forest.visible = true;
      cover.forEach((o) => (o.visible = true));
      trees.forEach(({ object, cast }) => (object.castShadow = cast));
      r.shadowMap.autoUpdate = true;
      r.info.reset();
      e.presentation.render(e.scene, e.camera, 'balanced');
      return result;
    });
    assert.match(run.userAgent, /HeadlessChrome/);
    assert.ok(!/swiftshader|llvmpipe|software/i.test(run.renderer));
    assert.deepEqual(report.errors, []);
    run.summary = Object.fromEntries(
      [...new Set(run.samples.map((s) => s.mode))].map((mode) => {
        const samples = run.samples.filter((s) => s.mode === mode),
          gpu = samples.map((s) => s.gpuMs).sort((a, b) => a - b),
          cpu = samples.map((s) => s.cpuMs).sort((a, b) => a - b);
        return [
          mode,
          {
            medianGpuMs: gpu[5],
            medianCpuMs: cpu[5],
            triangles: samples[0].triangles,
            calls: samples[0].calls,
          },
        ];
      }),
    );
    report.runs.push({ circuit, weather, ...run });
    await page
      .locator('canvas')
      .first()
      .screenshot({ path: `${output}/${circuit}-${weather}.png` });
    console.log(
      JSON.stringify({
        circuit,
        weather,
        framebuffer: run.framebuffer,
        summary: run.summary,
      }),
    );
  }
  report.status = 'passed';
} catch (e) {
  report.status = 'failed';
  report.failure = e.message;
  throw e;
} finally {
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(report, null, 2) + '\n',
  );
  await context.close();
  await browser.close();
}
