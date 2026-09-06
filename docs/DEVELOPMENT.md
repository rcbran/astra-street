# Development and verification

## Setup

Use Node.js 22.13+ and the committed npm lockfile. Gengar-db uses Node 24.19.0. Dependencies were installed with `npm ci` without changing the lockfile. Run `npm ci` only when dependencies need installation. Do not scaffold another project over this checkout.

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

1. `npm test`: 24 deterministic checks for race completion, freeze behavior, control effects, track wrapping, time trial, camera attachment, settings validation, and frame scheduling/resolution budgets.
2. `npm run typecheck` and `npm run lint`: strict TypeScript and owned-source static checks.
3. `npm run build`: production bundle; it is not a gameplay test.
4. `scripts/browser-check.mjs`: actual keyboard and UI actions in the dedicated browser, followed by responsive menu bounds and obstruction checks.
5. `scripts/benchmark.mjs`: complete races on all three circuits, timing samples, screenshots and repeated scene-resource counts.

Browser checks cover 390×844, 844×390, 932×430, 1024×600 and 1440×900. They assert start-button bounds and test that menu/header control centers are not obscured. Driving waits use simulation time so the same behavior assertions can run on slow software renderers; they retain finite timeouts. JSON reports and screenshots are written to ignored `artifacts/`.

`scripts/render-check.mjs` checks DPR-only changes, quality pixel ceilings, fullscreen entry/exit, a moving chase camera, all nine circuit/weather world builds and repeated resource cycles. These are functional checks; the nine-world sweep does not run nine full races.

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

Launch a dedicated visible browser with the installed Chrome channel:

```sh
node scripts/launch-browser.mjs
```

For gengar-db functional checks, bundled headless Chromium is available. The host exposes no rendering GPU or desktop display; Chromium uses SwiftShader. Missing Ubuntu browser libraries were extracted into the user's cache because this account cannot install system packages:

```sh
LD_LIBRARY_PATH=/home/dev/.cache/astra-browser-libs/usr/lib/x86_64-linux-gnu ASTRA_HEADLESS=1 node scripts/launch-browser.mjs
ASTRA_BASE_URL=http://localhost:8788 node scripts/browser-check.mjs
ASTRA_BASE_URL=http://localhost:8788 node scripts/render-check.mjs
```

Run those checks sequentially. Their software-renderer FPS is not comparable to the M4 Max measurements. On another Linux host, use Playwright's normal browser/dependency installation; the cache above is machine-local and is not a project dependency. `ASTRA_BROWSER_CHANNEL` and `ASTRA_CDP_PORT` optionally select another installed channel or free port.

Ensure the chosen port is free. Do not take over an existing browser port blindly. Do not reuse old tool session IDs.

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

## Street-racing verification

The MacBook uses the installed visible Chrome channel. Run the browser and render checks sequentially, then `ASTRA_OUTPUT=artifacts/street-mac node scripts/scenery-check.mjs` for a 25-second sample per route. The scenery script explicitly emulates DPR 2 at 1440×900 CSS in visible hardware Chrome, records actual framebuffer/renderer/focus, and fails on software renderers. These samples are not full races or a thermal test. It clears its pilot and closes its owned browser context on exit.

`node scripts/touch-check.mjs` checks simultaneous emulated throttle/steering/handbrake, released input and portrait/landscape views. It closes its owned context afterward; physical touch devices remain untested.

Browser control checks now cover Space handbrake/score and S service braking. The alternate camera uses a bonnet view. `tests/street-score.test.ts` verifies slide recovery, banking, contact losses, near misses, gate thresholds and finish/reset behavior. Regenerate the original S9 with `blender -b --python scripts/build_street_car.py`; reviewed output belongs at `public/assets/models/astra-s9.glb`.
