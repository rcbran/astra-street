import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { hostname } from 'node:os';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

// Dedicated headless context only. These are automated full-race workload
// measurements, not visible-display pacing, human handling or thermal evidence.
const origin = process.env.ASTRA_BASE_URL ?? 'http://localhost:8788';
const output = resolve(process.env.ASTRA_OUTPUT ?? 'artifacts/full-race-check');
const allWeather = process.env.ASTRA_ALL_WEATHER === '1';
const timeoutSeconds = Number(process.env.ASTRA_RACE_TIMEOUT ?? 240);
assert.ok(Number.isFinite(timeoutSeconds) && timeoutSeconds >= 60);
const circuits = [
  { id: 'riviera', label: 'Canyon Run', weather: 'sunset' },
  { id: 'forest', label: 'Pinecrest', weather: 'clear' },
  { id: 'marina', label: 'Harbor City', weather: 'rain' },
];
const weatherLabels = {
  sunset: 'Golden hour',
  clear: 'Clear sky',
  rain: 'Wet night',
};
const combinations = circuits.flatMap((circuit) =>
  (allWeather ? Object.keys(weatherLabels) : [circuit.weather]).map(
    (weather) => ({ ...circuit, weather }),
  ),
);
const errors = [];
const report = {
  startedAt: new Date().toISOString(),
  host: hostname(),
  origin,
  build: process.env.ASTRA_BUILD_LABEL ?? 'production',
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim(),
  sourceDirty: !!execFileSync('git', ['status', '--porcelain'], {
    encoding: 'utf8',
  }).trim(),
  targetFps: 30,
  allWeather,
  purpose:
    'Headless full-race workload, finish and resource-lifecycle validation. No visible-display, human-handling or thermal claims.',
  races: [],
  memory: [],
  captures: [],
  errors,
};
await mkdir(output, { recursive: true });
const writeReport = () =>
  writeFile(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
let browser, context, page;
const stopPilot = async () => {
  if (!page || page.isClosed()) return;
  await page
    .evaluate(() => {
      clearInterval(window.__pilot);
      delete window.__pilot;
      window.__ASTRA__?.debugDrive(false);
      window.__ASTRA__?.input.clear();
    })
    .catch(() => {});
  for (const key of [
    'w',
    'a',
    's',
    'd',
    'ArrowUp',
    'ArrowLeft',
    'ArrowDown',
    'ArrowRight',
    'Space',
    'ShiftLeft',
    'ShiftRight',
  ]) {
    await page.keyboard.up(key).catch(() => {});
  }
};
const capture = async (filename) => {
  const before = await page.evaluate(() => ({
    at: new Date().toISOString(),
    monotonicMs: performance.now(),
    phase: window.__ASTRA__.phase,
    raceTime: window.__ASTRA__.telemetry.raceTime,
    distance: window.__ASTRA__.player.distance,
  }));
  await page.screenshot({ path: `${output}/${filename}` });
  report.captures.push({
    filename,
    ...before,
    endedAt: new Date().toISOString(),
  });
};
const selectCircuit = async ({ id, label, weather }) => {
  await page.locator('.circuit-option').filter({ hasText: label }).click();
  await page.waitForFunction(
    (id) =>
      window.__ASTRA__?.phase === 'menu' &&
      window.__ASTRA__.options.circuit === id,
    id,
  );
  // Use the product controls so labels and runtime configuration stay in sync.
  await page
    .locator('.weather-option')
    .filter({ hasText: weatherLabels[weather] })
    .click();
  await page.waitForFunction(
    ({ id, weather }) => {
      const e = window.__ASTRA__;
      return (
        e?.phase === 'menu' &&
        e.options.circuit === id &&
        e.options.weather === weather
      );
    },
    { id, weather },
  );
  await page
    .getByRole('radio', { name: weatherLabels[weather], exact: true })
    .isChecked()
    .then((checked) => assert.ok(checked));
};
const percentile = (values, fraction) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))
  ];
};
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
  // CDP attaches only to the explicit dedicated launcher. Otherwise launch a
  // separate headless browser; never reuse any launcher/user page or context.
  browser = process.env.ASTRA_CDP
    ? await chromium.connectOverCDP(process.env.ASTRA_CDP)
    : await chromium.launch({
        channel:
          process.env.ASTRA_BROWSER_CHANNEL ||
          (process.platform === 'darwin' ? 'chrome' : undefined),
        headless: true,
      });
  report.browser = browser.version();
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  page = await context.newPage();
  page.setDefaultTimeout(120_000);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(`${origin}/?debug=1`);
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
      cssSize: [innerWidth, innerHeight],
      devicePixelRatio,
      framebuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
    };
  });
  assert.equal(
    report.graphics.captureMode,
    'headless',
    'Keep checks off the user screen',
  );
  assert.ok(
    !/swiftshader|llvmpipe|software|basic render/i.test(
      report.graphics.renderer,
    ),
    'Hardware WebGL renderer required',
  );
  assert.equal(report.graphics.visible, 'visible');
  assert.equal(report.graphics.focused, true);
  assert.equal(report.graphics.devicePixelRatio, 2);
  await page.evaluate(() =>
    window.__ASTRA__.updateSettings({
      quality: 'balanced',
      camera: 'chase',
      sound: false,
      assists: true,
    }),
  );
  await capture('menu.png');
  for (const combination of combinations) {
    const { id: circuit, label, weather } = combination;
    const key = `${circuit}-${weather}`;
    await selectCircuit(combination);
    const historyWatermark = await page.evaluate(
      () => window.__ASTRA__.diagnostics().history.at(-1)?.time ?? -1,
    );
    await page.getByRole('button', { name: 'GO RACING', exact: true }).click();
    const startedAt = new Date().toISOString(),
      started = performance.now();
    await page.evaluate(() => {
      clearInterval(window.__pilot);
      window.__pilot = setInterval(() => window.__ASTRA__.debugDrive(true), 25);
    });
    const snapshots = [];
    report.activeRun = { circuit, weather, startedAt, snapshots };
    let captured = false,
      lastLog = 0,
      final;
    while (true) {
      const snapshot = await page.evaluate(() => {
        const e = window.__ASTRA__,
          d = e.diagnostics();
        return {
          at: new Date().toISOString(),
          monotonicMs: performance.now(),
          telemetry: d.telemetry,
          position: d.position,
          renderer: d.renderer,
          rollingGpuP95: d.gpuMs,
          latestFrameSample: d.history.at(-1),
          visible: document.visibilityState,
          focused: document.hasFocus(),
        };
      });
      snapshot.elapsedWallSeconds = (performance.now() - started) / 1000;
      snapshots.push(snapshot);
      assert.equal(snapshot.visible, 'visible');
      assert.equal(snapshot.focused, true);
      assert.equal(snapshot.renderer.devicePixelRatio, 2);
      assert.deepEqual(snapshot.renderer.cssSize, [1440, 900]);
      assert.ok(
        snapshot.renderer.size[0] * snapshot.renderer.size[1] <= 1920 * 1080,
        'Balanced pixel cap',
      );
      assert.deepEqual(errors, [], 'No runtime or shader errors');
      if (snapshot.telemetry.phase === 'finished') {
        final = await page.evaluate(() => window.__ASTRA__.diagnostics());
        break;
      }
      assert.ok(
        snapshot.elapsedWallSeconds < timeoutSeconds,
        `${key} did not finish within ${timeoutSeconds}s`,
      );
      if (!captured && snapshot.telemetry.raceTime >= 18) {
        await capture(`${key}-racing.png`);
        captured = true;
      }
      if (snapshot.elapsedWallSeconds - lastLog >= 25) {
        console.log(
          JSON.stringify({
            circuit,
            weather,
            elapsed: snapshot.elapsedWallSeconds,
            lap: snapshot.telemetry.lap,
            speed: snapshot.telemetry.speed,
            fps: snapshot.telemetry.fps,
          }),
        );
        lastLog = snapshot.elapsedWallSeconds;
      }
      await page.waitForTimeout(1000);
    }
    await stopPilot();
    const allSamples = final.history.filter(
      (s) => s.phase === 'racing' && s.time > historyWatermark,
    );
    // Omit six initial racing metric windows, not an arbitrary tail belonging
    // to a previous run. Keep every raw sample alongside the steady summary.
    const samples = allSamples.slice(6);
    assert.ok(
      samples.length >= 10,
      'Enough racing samples for useful percentiles',
    );
    const racingSnapshots = snapshots.filter(
      (s) => s.telemetry.phase === 'racing',
    );
    const fps = samples.map((s) => s.fps);
    assert.ok(fps.every(Number.isFinite));
    const race = {
      circuit,
      circuitLabel: label,
      weather,
      weatherLabel: weatherLabels[weather],
      startedAt,
      endedAt: new Date().toISOString(),
      elapsedWallSeconds: snapshots.at(-1).elapsedWallSeconds,
      simulatedRaceSeconds: final.telemetry.raceTime,
      targetFps: 30,
      fpsMedian: percentile(fps, 0.5),
      fpsP10: percentile(fps, 0.1),
      metricWindow:
        'All racing windows except the first six; FPS values are one-second frame samples.',
      endingRollingGpuP95: racingSnapshots.at(-1)?.rollingGpuP95 ?? null,
      highestRollingGpuP95: racingSnapshots.some(
        (s) => typeof s.rollingGpuP95 === 'number',
      )
        ? Math.max(
            ...racingSnapshots
              .map((s) => s.rollingGpuP95)
              .filter((n) => typeof n === 'number'),
          )
        : null,
      highestCpuSubmitP95: Math.max(...samples.map((s) => s.renderP95)),
      // The final result frame is capped at 20 FPS, so retain the last racing
      // framebuffer separately from the finished-state snapshot.
      framebuffer: racingSnapshots.at(-1)?.renderer.size,
      result: final.telemetry,
      finalRenderer: final.renderer,
      scenery: await page.evaluate(() => window.__ASTRA__.world.root.userData),
      samples,
      allRacingSamples: allSamples,
      snapshots,
    };
    report.races.push(race);
    delete report.activeRun;
    assert.equal(final.telemetry.phase, 'finished');
    assert.ok(final.telemetry.bestLap > 20);
    await capture(`${key}-results.png`);
    await page.waitForTimeout(1100);
    const frozen = await page.evaluate(() => window.__ASTRA__.diagnostics());
    assert.equal(
      frozen.position.distance,
      final.position.distance,
      'Finished car must stay frozen',
    );
    assert.equal(
      frozen.telemetry.raceTime,
      final.telemetry.raceTime,
      'Finished clock must stay frozen',
    );
    assert.equal(
      frozen.telemetry.finishedPosition,
      final.telemetry.finishedPosition,
    );
    race.frozenResultVerified = true;
    await page
      .getByRole('button', { name: 'Back to circuits', exact: true })
      .click();
    await page.waitForFunction(() => window.__ASTRA__?.phase === 'menu');
    await writeReport();
    console.log(
      'FINISH',
      JSON.stringify({
        circuit,
        weather,
        seconds: race.elapsedWallSeconds,
        fpsMedian: race.fpsMedian,
        fpsP10: race.fpsP10,
        gpuP95: race.endingRollingGpuP95,
      }),
    );
  }
  // Repeat identical complete world configurations through the UI; compare
  // cycles 1 and 2 after one warm-up pass to detect retained GPU resources.
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const combination of combinations) {
      await selectCircuit(combination);
      await page.waitForTimeout(400);
      const renderer = await page.evaluate(
        () => window.__ASTRA__.diagnostics().renderer,
      );
      report.memory.push({
        cycle,
        circuit: combination.id,
        weather: combination.weather,
        ...renderer.memory,
        programs: renderer.programs,
      });
    }
  }
  for (const { id, weather } of combinations) {
    const rows = report.memory.filter(
      (row) => row.circuit === id && row.weather === weather,
    );
    assert.equal(
      rows[1].geometries,
      rows[2].geometries,
      `${id}/${weather} geometry leak`,
    );
    assert.equal(
      rows[1].textures,
      rows[2].textures,
      `${id}/${weather} texture leak`,
    );
  }
  assert.equal(report.races.length, combinations.length);
  assert.deepEqual(
    errors,
    [],
    'Browser must have no runtime or hydration errors',
  );
  report.status = 'passed';
  console.log(
    `PASS: ${report.races.length} headless full races, frozen results, resource cycles, and browser errors.`,
  );
} catch (error) {
  report.status = 'failed';
  report.failure = error.message;
  throw error;
} finally {
  await stopPilot();
  if (page && !page.isClosed())
    await page.evaluate(() => window.__ASTRA__?.pause()).catch(() => {});
  report.endedAt = new Date().toISOString();
  // Cleanup must still run if writing the report fails.
  try {
    await writeReport();
  } finally {
    try {
      await context?.close();
    } finally {
      await browser?.close();
    }
  }
}
