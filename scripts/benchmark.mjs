import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

// Use an actual visible browser for timing; headless/background frame pacing differs.
const origin = process.env.ASTRA_BASE_URL ?? 'http://localhost:3000';
const browser = process.env.ASTRA_CDP
  ? await chromium.connectOverCDP(process.env.ASTRA_CDP)
  : await chromium.launch({ channel: 'chrome', headless: false });
const context =
  browser.contexts()[0] ??
  (await browser.newContext({ viewport: { width: 1440, height: 900 } }));
const page = context.pages()[0] ?? (await context.newPage());
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
await mkdir('artifacts', { recursive: true });
await page.goto(`${origin}/?debug=1`);
await page.bringToFront();
await page.waitForFunction(() => window.__ASTRA__?.telemetry.phase === 'menu');
await page.evaluate(() =>
  window.__ASTRA__.updateSettings({
    quality: 'balanced',
    camera: 'chase',
    sound: false,
    assists: true,
  }),
);
await page.screenshot({ path: 'artifacts/menu-validated.png' });

const report = {
  timestamp: new Date().toISOString(),
  browser: await browser.version(),
  origin,
  viewport: await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    dpr: devicePixelRatio,
  })),
  races: [],
  memory: [],
  errors,
};
for (const [circuit, name, weather] of [
  ['riviera', 'Riviera', 'sunset'],
  ['forest', 'Black Forest', 'clear'],
  ['marina', 'Marina Bay', 'rain'],
]) {
  await page.getByText(name, { exact: true }).click();
  await page.waitForFunction(
    ([c, w]) =>
      window.__ASTRA__?.telemetry.phase === 'menu' &&
      window.__ASTRA__.options.circuit === c &&
      window.__ASTRA__.options.weather === w,
    [circuit, weather],
  );
  await page.getByRole('button', { name: 'GO RACING', exact: true }).click();
  await page.evaluate(() => {
    window.__pilot = setInterval(() => window.__ASTRA__.debugDrive(true), 25);
  });
  const started = Date.now();
  let elapsed = 0,
    screenshot = false,
    previousLog = 0;
  while (
    await page.evaluate(() => window.__ASTRA__.telemetry.phase !== 'finished')
  ) {
    await page.waitForTimeout(1000);
    elapsed = (Date.now() - started) / 1000;
    assert.ok(elapsed < 240, `${circuit} did not finish within four minutes`);
    if (elapsed > 18 && !screenshot) {
      await page.screenshot({ path: `artifacts/${circuit}-validated.png` });
      screenshot = true;
    }
    if (elapsed - previousLog > 25) {
      console.log(
        circuit,
        await page.evaluate(() => {
          const t = window.__ASTRA__.telemetry;
          return { lap: t.lap, speed: t.speed, fps: t.fps, gpuMs: t.gpuMs };
        }),
      );
      previousLog = elapsed;
    }
  }
  const result = await page.evaluate(() => {
    clearInterval(window.__pilot);
    window.__ASTRA__.debugDrive(false);
    return window.__ASTRA__.diagnostics();
  });
  const history = result.history
    .filter((s) => s.phase === 'racing')
    .slice(-Math.floor(elapsed - 6));
  const sortedFps = history.map((s) => s.fps).sort((a, b) => a - b);
  const race = {
    circuit,
    seconds: elapsed,
    fpsMedian: sortedFps[Math.floor(sortedFps.length / 2)],
    fpsP10: sortedFps[Math.floor(sortedFps.length * 0.1)],
    gpuP95: result.gpuMs,
    cpuSubmitP95Max: Math.max(...history.map((s) => s.renderP95)),
    framebuffer: result.renderer.size,
    result: result.telemetry,
    samples: history,
  };
  report.races.push(race);
  assert.equal(result.telemetry.phase, 'finished');
  assert.ok(result.telemetry.bestLap > 20);
  await page.screenshot({ path: `artifacts/${circuit}-results.png` });
  console.log('FINISH', {
    circuit,
    position: result.telemetry.finishedPosition,
    fpsMedian: race.fpsMedian,
    fpsP10: race.fpsP10,
    gpuMs: race.gpuP95,
  });
  const distance = result.position.distance;
  await page.waitForTimeout(1100);
  assert.equal(
    await page.evaluate(() => window.__ASTRA__.player.distance),
    distance,
  );
  await page.getByRole('button', { name: 'Back to circuits' }).click();
  await page.waitForFunction(
    () => window.__ASTRA__?.telemetry.phase === 'menu',
  );
  await writeFile('artifacts/benchmark.json', JSON.stringify(report, null, 2));
}

// Cycling the same scenes twice must return to the same resource counts.
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
    await page.waitForTimeout(400);
    const memory = await page.evaluate(
      () => window.__ASTRA__.diagnostics().renderer.memory,
    );
    report.memory.push({ cycle, circuit, ...memory });
  }
}
for (const circuit of ['riviera', 'forest', 'marina']) {
  const rows = report.memory.filter((m) => m.circuit === circuit);
  assert.equal(
    rows[1].geometries,
    rows[2].geometries,
    `${circuit} geometry leak`,
  );
  assert.equal(rows[1].textures, rows[2].textures, `${circuit} texture leak`);
}
await writeFile('artifacts/benchmark.json', JSON.stringify(report, null, 2));
assert.deepEqual(
  errors,
  [],
  'Browser must have no runtime or hydration errors',
);
console.log(
  'PASS: all circuits, finishes, resource cycles, and browser errors.',
);
await browser.close();
