# Development and verification

## Setup

Use Node.js 22.13+ and the committed npm lockfile. The current machine uses Node 24.19.0. Run `npm ci` only when dependencies need installation. Do not scaffold another project over this checkout.

```sh
npm run dev -- --host 0.0.0.0
npm run typecheck
npm run lint
npm test
npm run build
npm run start -- --port 8788
```

`npm run start` serves the compiled Worker with Wrangler. A new production build replaces files under `dist/`; restart the production server afterward. Keep Wrangler and the Cloudflare Vite plugin on compatible versions: an older Wrangler binary previously rejected the newer build's compatibility date. Current locked versions build and serve successfully.

## Verification levels

1. `npm test`: 19 deterministic checks for race completion, freeze behavior, control effects, track wrapping, time trial, camera attachment, settings validation, and frame scheduling/resolution budgets.
2. `npm run typecheck` and `npm run lint`: strict TypeScript and owned-source static checks.
3. `npm run build`: production bundle; it is not a gameplay test.
4. `scripts/browser-check.mjs`: actual keyboard and UI actions against a visible Chrome browser, followed by responsive menu bounds checks.
5. `scripts/benchmark.mjs`: complete races on all three circuits, timing samples, screenshots and repeated scene-resource counts.

The browser checks currently have one known failure at the 844×390 menu layout. Do not weaken the assertion to hide it. The start button sits below the viewport. Fix the layout, then rerun.

## Visible browser automation

Performance should be measured in a visible foreground browser, with a stable build and no source edits during the run. Headless browsers and background tabs can have misleading frame pacing. Use a dedicated browser/profile; do not attach to unrelated user sessions.

The benchmark can launch its own visible Chrome:

```sh
ASTRA_BASE_URL=http://localhost:8788 node scripts/benchmark.mjs
```

Alternatively, launch a dedicated Chrome with a CDP port and attach both scripts:

```sh
ASTRA_CDP=http://localhost:9224 ASTRA_BASE_URL=http://localhost:8788 node scripts/benchmark.mjs
ASTRA_CDP=http://localhost:9224 ASTRA_BASE_URL=http://localhost:8788 node scripts/browser-check.mjs
```

Example dedicated launcher, run with Node from the repository:

```js
import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--remote-debugging-port=9224', '--window-size=1440,960'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
await context.newPage();
await new Promise((resolve) => browser.on('disconnected', resolve));
```

Ensure the chosen port is free. Do not take over an existing browser port blindly. The handoff session's dedicated browser and servers are stopped; old tool session IDs should not be reused.

## Debug interface

`?debug=1` exposes `window.__ASTRA__`. Normal URLs do not expose this interface. `diagnostics()` returns telemetry, render/memory counters, settings, options and recent timing samples. `debugDrive(true)` supplies one pilot-input snapshot, so the benchmark refreshes it periodically. Always clear the interval afterward.

GPU timing may be unavailable when the WebGL extension is absent. Treat `null` as unsupported rather than as zero GPU cost. `renderMs` measures CPU submission, not GPU completion or entire frame work.

## Assets

Blender is optional for running the game. The committed GLB is ready to use. To regenerate the original car:

```sh
blender -b --python scripts/build_car.py
```

Output defaults to ignored `artifacts/car/`. Add `-- --preview` for optional studio/cockpit renders, or `-- --output-dir PATH` to choose another directory. The generator writes a GLB, editable Blender scene and report. Copy only the reviewed GLB into `public/assets/models/astra-formula.glb`. Preview rendering is off by default to avoid unnecessary GPU/CPU work.

The formatted generator passed Python syntax compilation after its command-line cleanup. Regeneration with the new options has not yet been rerun; the runtime GLB is the already validated original V2 export.

## Source control

Branch `main` has a normal initial commit. Use the repository's local author settings. Do not alter global Git configuration. No GitHub remote has been added.

Codex once reported a missing `refs/t3/checkpoints/.../turn/0` diff baseline because the folder had no Git repository at the start of the turn. `turn/1` existed and `git fsck` found no corruption. A normal initial commit was saved afterward. Do not fabricate or rewrite internal Codex checkpoint refs to conceal that missing baseline.
