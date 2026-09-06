import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
// Emulated multi-touch in a dedicated context; this does not replace real-device testing.
const b = await chromium.connectOverCDP(
  process.env.ASTRA_CDP ?? 'http://localhost:9224',
);
const c = await b.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 2,
  hasTouch: true,
});
const p = await c.newPage();
p.setDefaultTimeout(60000);
const cdp = await c.newCDPSession(p);
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await mkdir('artifacts', { recursive: true });
const report = {
  date: new Date().toISOString(),
  kind: 'emulated multi-touch; not a physical device',
  errors,
};
try {
  await p.goto(
    `${process.env.ASTRA_BASE_URL ?? 'http://localhost:8788'}/?debug=1`,
  );
  await p.bringToFront();
  report.userAgent = await p.evaluate(() => navigator.userAgent);
  report.captureMode = /HeadlessChrome/.test(report.userAgent)
    ? 'headless'
    : 'visible';
  await p.waitForFunction(() => window.__ASTRA__?.phase === 'menu');
  await p.evaluate(() =>
    window.__ASTRA__.updateSettings({
      quality: 'balanced',
      assists: true,
      sound: false,
      camera: 'chase',
    }),
  );
  await p.getByRole('tab', { name: 'Time trial', exact: true }).click();
  await p.getByRole('button', { name: 'GO RACING', exact: true }).click();
  await p.waitForFunction(() => window.__ASTRA__.phase === 'racing');
  const targets = {};
  let id = 1;
  for (const name of ['Accelerate', 'Handbrake drift', 'Steer right']) {
    const box = await p
      .getByRole('button', { name, exact: true })
      .boundingBox();
    assert.ok(
      box &&
        box.y >= 0 &&
        box.x >= 0 &&
        box.y + box.height <= 390 &&
        box.x + box.width <= 844,
    );
    targets[name] = {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
      id: id++,
    };
  }
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [targets.Accelerate],
  });
  await p.waitForFunction(() => window.__ASTRA__.telemetry.raceTime >= 3);
  assert.ok(await p.evaluate(() => window.__ASTRA__.telemetry.speed > 90));
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: Object.values(targets),
  });
  const until = await p.evaluate(
    () => window.__ASTRA__.telemetry.raceTime + 0.4,
  );
  await p.waitForFunction(
    (t) => window.__ASTRA__.telemetry.raceTime >= t,
    until,
  );
  assert.ok(await p.evaluate(() => window.__ASTRA__.telemetry.chain > 0));
  await p.screenshot({ path: 'artifacts/touch-landscape.png' });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  const input = await p.evaluate(() => ({ ...window.__ASTRA__.input.touch }));
  assert.equal(input.throttle, 0);
  assert.equal(input.steer, 0);
  assert.equal(input.handbrake, false);
  await p.setViewportSize({ width: 390, height: 844 });
  await p.screenshot({ path: 'artifacts/touch-portrait.png' });
  report.inputAfterRelease = input;
  report.status = 'passed';
  assert.deepEqual(errors, []);
} catch (e) {
  report.status = 'failed';
  report.failure = e.message;
  throw e;
} finally {
  await cdp
    .send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    .catch(() => {});
  await writeFile(
    'artifacts/touch-check.json',
    JSON.stringify(report, null, 2) + '\n',
  );
  await c.close();
  await b.close();
}
console.log(report);
