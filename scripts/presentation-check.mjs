import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Cost comparison at identical frozen geometry, shadows, framebuffer and camera.
// This is not a moving-race FPS test. GPU queries are collected asynchronously.
const output = process.env.ASTRA_OUTPUT ?? 'artifacts/presentation-check';
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
  purpose:
    'Frozen production presentation cost A/B; shared GPU, not full-race or display pacing.',
  runs: [],
  errors: [],
};
page.on('pageerror', (e) => report.errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') report.errors.push(m.text());
});
try {
  for (const weather of ['clear', 'rain']) {
    await page.goto(
      `${process.env.ASTRA_BASE_URL ?? 'http://localhost:8788'}/?debug=1`,
    );
    await page.waitForFunction(() => window.__ASTRA__?.phase === 'menu');
    await page.evaluate(async (weather) => {
      const e = window.__ASTRA__;
      await e.configure({ circuit: 'forest', weather, mode: 'race' });
      await e.start();
      window.__pilot = setInterval(() => e.debugDrive(true), 25);
    }, weather);
    await page.waitForFunction(() => window.__ASTRA__.telemetry.raceTime >= 5);
    const run = await page.evaluate(async () => {
      const e = window.__ASTRA__;
      clearInterval(window.__pilot);
      e.debugDrive(false);
      e.input.clear();
      cancelAnimationFrame(e.animation);
      e.budget.reset();
      e.resize();
      const r = e.renderer,
        gl = r.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (!ext) throw new Error('GPU timer queries unavailable');
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      const result = {
        renderer: gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
        framebuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
        samples: [],
      };
      for (let i = 0; i < 24; i++) {
        // Alternate order to avoid attributing a gradual load change to one mode.
        for (const mode of i % 2
          ? ['contact', 'direct']
          : ['direct', 'contact']) {
          const query = gl.createQuery();
          try {
            r.info.reset();
            const start = performance.now();
            gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
            e.presentation.render(
              e.scene,
              e.camera,
              mode === 'contact' ? 'balanced' : 'eco',
            );
            gl.endQuery(ext.TIME_ELAPSED_EXT);
            const cpuMs = performance.now() - start;
            const deadline = performance.now() + 5000;
            while (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
              if (performance.now() > deadline)
                throw new Error('GPU query timeout');
              await new Promise((resolve) => setTimeout(resolve, 10));
            }
            if (gl.getParameter(ext.GPU_DISJOINT_EXT))
              throw new Error('Disjoint GPU timer sample');
            const gpuMs =
              Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1e6;
            if (i >= 4)
              result.samples.push({
                mode,
                cpuMs,
                gpuMs,
                drawCalls: r.info.render.calls,
                triangles: r.info.render.triangles,
              });
          } finally {
            gl.deleteQuery(query);
          }
        }
      }
      return result;
    });
    for (const mode of ['contact', 'direct']) {
      const values = run.samples
        .filter((s) => s.mode === mode)
        .map((s) => s.gpuMs)
        .sort((a, b) => a - b);
      run[mode] = {
        gpuMedianMs: values[Math.floor(values.length / 2)],
        gpuP95Ms: values[Math.floor(values.length * 0.95)],
      };
      await page.evaluate((mode) => {
        const e = window.__ASTRA__;
        e.presentation.render(
          e.scene,
          e.camera,
          mode === 'contact' ? 'balanced' : 'eco',
        );
      }, mode);
      await page.screenshot({
        path: `${output}/forest-${weather}-${mode}.png`,
      });
    }
    report.runs.push({ weather, ...run });
    console.log(
      JSON.stringify({
        weather,
        framebuffer: run.framebuffer,
        contact: run.contact,
        direct: run.direct,
      }),
    );
    assert.deepEqual(report.errors, []);
  }
} finally {
  await page
    .evaluate(() => {
      clearInterval(window.__pilot);
      window.__ASTRA__?.debugDrive(false);
    })
    .catch(() => {});
  await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
  await context.close();
  await browser.close();
}
