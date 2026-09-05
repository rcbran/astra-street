import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.connectOverCDP(
  process.env.ASTRA_CDP ?? 'http://localhost:9224',
);
const page = browser.contexts()[0].pages()[0];
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(
  `${process.env.ASTRA_BASE_URL ?? 'http://localhost:8788'}/?debug=1`,
);
await page.waitForFunction(() => window.__ASTRA__?.telemetry.phase === 'menu');
await page.getByRole('button', { name: 'Settings', exact: true }).click();
await page.getByText('Eco', { exact: true }).click();
await page.keyboard.press('Enter');
assert.equal(await page.evaluate(() => window.__ASTRA__.phase), 'menu');
const buffer = await page.evaluate(
  () => window.__ASTRA__.diagnostics().renderer.size,
);
assert.ok(buffer[0] * buffer[1] <= 1280 * 720 + 2);
await page.getByText('Balanced', { exact: true }).click();
await page.keyboard.press('Escape');
await page.getByRole('tab', { name: 'Time trial', exact: true }).click();
await page.getByRole('button', { name: 'GO RACING', exact: true }).click();
await page.waitForFunction(() => window.__ASTRA__.phase === 'racing');
await page.keyboard.down('w');
await page.waitForTimeout(4000);
assert.ok(await page.evaluate(() => window.__ASTRA__.telemetry.speed > 130));
const offset = await page.evaluate(() => window.__ASTRA__.player.offset);
await page.keyboard.down('d');
await page.waitForTimeout(400);
await page.keyboard.up('d');
assert.ok(
  (await page.evaluate(() => window.__ASTRA__.player.offset)) > offset + 0.1,
);
await page.keyboard.down('Shift');
await page.waitForTimeout(700);
await page.keyboard.up('Shift');
assert.ok((await page.evaluate(() => window.__ASTRA__.telemetry.boost)) < 99);
await page.keyboard.up('w');
const speed = await page.evaluate(() => window.__ASTRA__.player.speed);
await page.keyboard.down('Space');
await page.waitForTimeout(1000);
await page.keyboard.up('Space');
assert.ok(
  (await page.evaluate(() => window.__ASTRA__.player.speed)) < speed - 15,
);
await page.keyboard.press('c');
assert.equal(
  await page.evaluate(() => window.__ASTRA__.settings.camera),
  'cockpit',
);
await page.keyboard.press('r');
assert.ok(
  Math.abs(await page.evaluate(() => window.__ASTRA__.player.offset)) < 0.05,
);
await page.keyboard.press('Escape');
const paused = await page.evaluate(() => window.__ASTRA__.player.distance);
await page.waitForTimeout(800);
assert.equal(
  await page.evaluate(() => window.__ASTRA__.player.distance),
  paused,
);
await page.getByRole('button', { name: 'BACK TO RACING', exact: true }).click();
await page.keyboard.down('w');
await page.waitForTimeout(1500);
await page.keyboard.up('w');
await page.screenshot({ path: 'artifacts/cockpit-production.png' });
await page
  .getByRole('button', { name: 'Finish time trial', exact: true })
  .click();
await page.getByRole('button', { name: 'RACE AGAIN', exact: true }).click();
await page.waitForFunction(() => window.__ASTRA__.phase === 'countdown');
assert.ok((await page.evaluate(() => window.__ASTRA__.player.distance)) < 0);
await page.evaluate(() => window.dispatchEvent(new Event('blur')));
assert.equal(await page.evaluate(() => window.__ASTRA__.phase), 'paused');
await page.getByRole('button', { name: 'Back to circuits' }).click();
await page.waitForFunction(() => window.__ASTRA__.phase === 'menu');
await page.reload();
await page.waitForFunction(() => window.__ASTRA__?.phase === 'menu');
assert.equal(
  await page.evaluate(() => window.__ASTRA__.settings.camera),
  'cockpit',
);
for (const [width, height] of [
  [390, 844],
  [844, 390],
  [1440, 900],
]) {
  await page.setViewportSize({ width, height });
  await page.waitForTimeout(600);
  const button = page.getByRole('button', { name: 'GO RACING', exact: true });
  assert.ok(await button.isVisible());
  const box = await button.boundingBox();
  assert.ok(
    box.y >= 0 && box.y + box.height <= height,
    `Start button outside ${width}x${height}`,
  );
  await page.screenshot({ path: `artifacts/menu-${width}x${height}.png` });
}
await page.evaluate(() =>
  window.__ASTRA__.updateSettings({
    ...window.__ASTRA__.settings,
    sound: true,
    camera: 'chase',
  }),
);
assert.deepEqual(errors, []);
console.log(
  'PASS: real keyboard driving, boost/braking, pause/blur, reset, restart, time trial, settings/persistence and responsive menus.',
);
await browser.close();
