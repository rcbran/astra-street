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

1. `npm test`: 31 deterministic checks for race completion, freeze behavior, control effects, track wrapping, time trial, camera attachment, settings validation, frame scheduling/resolution budgets, terrain root support, tree LOD ownership and repeatable material lighting.
2. `npm run typecheck` and `npm run lint`: strict TypeScript and owned-source static checks.
3. `npm run build`: production bundle; it is not a gameplay test.
4. `scripts/browser-check.mjs`: actual keyboard and UI actions in the dedicated browser, followed by responsive menu bounds and obstruction checks.
5. `scripts/benchmark.mjs`: complete two-lap races, frozen-result checks, full per-second timing snapshots, screenshots and repeated scene-resource counts. `ASTRA_ALL_WEATHER=1` covers all nine route/weather combinations.

Browser checks cover 390×844, 844×390, 932×430, 1024×600 and 1440×900. They assert start-button bounds and test that menu/header control centers are not obscured. Driving waits use simulation time so the same behavior assertions can run on slow software renderers; they retain finite timeouts. JSON reports and screenshots are written to ignored `artifacts/`.

`scripts/render-check.mjs` checks DPR-only changes, quality pixel ceilings, fullscreen entry/exit, a moving chase camera, all nine circuit/weather world builds and repeated resource cycles. These are functional checks; the nine-world sweep does not run nine full races.

## Headless browser automation (default)

The user requests automation off their screen. `scripts/launch-browser.mjs` now defaults to a separate headless browser and temporary profile. On this MacBook it uses installed Chrome; WebGL reports the Apple M4 Max through ANGLE/Metal. Verify the renderer rather than assuming headless implies hardware or software. Never attach to the user's personal browser. Do not open a visible test window without a new request.

```sh
node scripts/launch-browser.mjs
ASTRA_RECORD_VIDEO=1 node scripts/browser-check.mjs
node scripts/render-check.mjs
node scripts/touch-check.mjs
ASTRA_CDP=http://localhost:9224 ASTRA_ALL_WEATHER=1 ASTRA_OUTPUT=artifacts/trees-full-races node scripts/benchmark.mjs
```

Run GPU checks sequentially with the build unchanged. The keyboard check can record a WebM under `artifacts/control-video/`. Scenery captures record wall-clock timestamps, simulation time, distance, actual framebuffer, GPU renderer and capture mode. The scenery harness changes routes through the UI, keeping HUD/minimap labels in sync. Each script releases its inputs and closes its owned page/context.

Headless GPU timings describe that renderer workload, not visible-window display pacing or sustained thermals. The historical visible benchmarks remain separate. If the user explicitly requests a visible capture later, `ASTRA_HEADLESS=0 node scripts/launch-browser.mjs` is the opt-in override. `scripts/benchmark.mjs` also launches a dedicated headless browser when no CDP endpoint is supplied. Its hardware assertions reject software renderers; use the other functional checks on SwiftShader.

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

The shipped CC0 tree and ground/rock models do not require Blender to run. Offline authoring commands and source manifests are in [the tree pipeline](../scripts/assets/trees/README.md), [rock notes](assets/rocks.md) and [forest-floor notes](assets/ground.md).

`node scripts/tree-angle-check.mjs` uses the tracked [gallery fixtures](../scripts/fixtures/tree-gallery/README.md) against the development server. Set `ASTRA_ALL_LODS=1` for all seven variants and three LODs (434 views), or `ASTRA_GALLERY=undergrowth` for grass/fern/shrub inspection (90 views). It uses the actual runtime loader and shader callbacks in controlled lighting. These static images verify geometry/material behavior, not frame pacing. All frames, contact sheets, asset hashes and reports are saved under ignored `artifacts/`.

## Source control

Branch `main` has a normal initial commit. Use the repository's local author settings. Do not alter global Git configuration. The personal private GitHub repository is `https://github.com/rcbran/astra-street` (`origin`). The private Sites source remains `sites`. Push validated source to both; do not change global Git configuration.

Codex once reported a missing `refs/t3/checkpoints/.../turn/0` diff baseline because the folder had no Git repository at the start of the turn. `turn/1` existed and `git fsck` found no corruption. A normal initial commit was saved afterward. Do not fabricate or rewrite internal Codex checkpoint refs to conceal that missing baseline.

## Street-racing verification

The MacBook uses the installed Chrome channel in headless mode. Run the browser and render checks sequentially, then `ASTRA_OUTPUT=artifacts/street-mac node scripts/scenery-check.mjs` for a 25-second sample per route. The scenery script explicitly emulates DPR 2 at 1440×900 CSS in hardware Chrome, with headless/visible mode recorded, records actual framebuffer/renderer/focus, and fails on software renderers. These samples are not full races or a thermal test. It clears its pilot and closes its owned browser context on exit.

`node scripts/touch-check.mjs` checks simultaneous emulated throttle/steering/handbrake, released input and portrait/landscape views. It closes its owned context afterward; physical touch devices remain untested.

Browser control checks now cover Space handbrake/score and S service braking. The alternate camera uses a bonnet view. `tests/street-score.test.ts` verifies slide recovery, banking, contact losses, near misses, gate thresholds and finish/reset behavior. Regenerate the original S9 with `blender -b --python scripts/build_street_car.py`; reviewed output belongs at `public/assets/models/astra-s9.glb`.
