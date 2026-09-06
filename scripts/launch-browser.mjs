import { chromium } from '@playwright/test';

// Dedicated profile: never attach checks to an unrelated user browser.
const headless = process.env.ASTRA_HEADLESS !== '0';
const port = Number(process.env.ASTRA_CDP_PORT ?? 9224);
const browser = await chromium.launch({
  channel:
    process.env.ASTRA_BROWSER_CHANNEL ||
    (process.platform === 'darwin' ? 'chrome' : undefined),
  headless,
  args: [`--remote-debugging-port=${port}`, '--window-size=1440,960'],
});
process.once('SIGINT', () => void browser.close());
process.once('SIGTERM', () => void browser.close());
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
await context.newPage();
console.log(
  `Dedicated ${headless ? 'headless' : 'visible'} browser at http://localhost:${port}`,
);
if (headless)
  console.log(
    'Verify the reported WebGL renderer. Headless timing is separate from visible display pacing.',
  );
await new Promise((resolve) => browser.on('disconnected', resolve));
