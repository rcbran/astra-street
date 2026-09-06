# Session handoff — Astra Formula

**Prepared 2026-09-05. Read this first.**

The user requested a convenient pause, all documentation updated, and this handoff for a new session. Implementation and publishing are paused. The game is playable and extensively tested, but the original high-fidelity goal is not complete. Continue from this repository when the user resumes; do not start over or silently declare AAA parity.

## 1. User brief and constraints

- Personal browser F1-style racing game; simple, fun gameplay with several maps and weather.
- Visual target: actual AAA F1 games released in 2020 or later, using screenshots as references.
- Nominal 60 FPS target with restrained laptop heat/fan load. **40–50 FPS is acceptable** because other agents do GPU work on the laptop.
- Clear, modular code for an eventual public GitHub repository.
- **Do not use Orca orchestration.** Native collaboration was used. Any/all delegated subagents must be **GPT Astra (`gpt-6-astra`)**.
- Full computer/app access was authorized. Blender is installed. No Unreal/Photoshop installation was needed.
- Public documentation was initially deferred; the latest instruction superseded that and requested the documentation now present.

## 2. Location and current state

Checkout on this machine: `/Users/rcbranham/git/personal/f1-racing-astra`.

Branch: `main`. Initial code commit: `826ced8a580479e2542df157e10222d854efb1ed`. Documentation/evidence changes are saved in a following handoff commit; inspect `git log -2` for its exact SHA. No GitHub remote has been created.

Implemented:

- Original Blender AF-27 car, animated wheels and a head-hidden cockpit view.
- Riviera coastal sunset (2.84 km), Black Forest daylight (3.43 km), Marina Bay wet night (3.10 km).
- Each circuit supports clear, sunset or rain conditions.
- Two-lap race against seven AI cars; unlimited time trial with an explicit finish action.
- Arcade driving, automatic gears, optional steering assist, rechargeable boost, off-track/barrier penalties, best laps, pause/restart/results.
- Keyboard, gamepad mappings and touch-control UI; synthesized engine/wind/tire audio.
- React menu/HUD/settings with accessible shared components.
- PBR road/grass, static HDR reflections, instanced scenery, one localized shadow map, procedural sky, wet reflection, rain and pooled tire spray.
- Render caps, pixel budgets, adaptive resolution and sparse GPU timing.

**Not deployed.** A private Site is registered, but there has been no source push, saved Site version, or deployment.

## 3. First concrete next actions

1. **Fix the 844×390 landscape menu.** The start button is below the viewport: x≈531.69, y≈415.44, width 268, height 46. Screenshot: `artifacts/menu-landscape-issue.png`. Inspect `src/ui/styles/responsive.css`; the compact landscape rule currently requires width ≤800px and misses 844px. Do not relax the test instead of fixing the layout.
2. Rerun `scripts/browser-check.mjs` on the production build, including its final desktop check. The preceding control actions and 390×844 portrait menu check already passed.
3. Inspect a **moving chase-view screenshot after the latest camera fix**, and run a short timing check. The full-race performance run used the prior chase rig. The fix is committed, passes a regression test, and is in the last successful build, but its driving screenshot/timing follow-up was not completed before pause.
4. Investigate Retina/fullscreen resolution behavior. The benchmark reported DPR 2 but a 1440×900 drawing buffer at a 1440×900 CSS viewport. Do not describe those runs as native Retina or full 1080p. The pixel ceiling itself is tested.
5. Continue visual refinement toward the user’s AAA reference. Current terrain, building variety, roadside materials, coastal detail, and repeated foliage remain simple. Keep the budgets and measured evidence; do not add expensive effects without inspecting their visual benefit.
6. Manual laps should evaluate fun/handling. An automated pilot can validate completion and timing, but cannot establish good driving feel.
7. Finish affected checks, update evidence, then resume private publishing only after the user resumes work. Public GitHub publication/license selection is separate and still pending.

The complete prioritized list is in `docs/TASKS.md`.

## 4. Verification already completed

Latest source checks:

- `npm run build`: passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed for owned source/configuration.
- `npm test`: **19 passed**.
- `npm audit` and `npm audit --omit=dev`: zero known vulnerabilities with the current lockfile.
- Python syntax compile for the formatted car generator: passed. The generator's new optional-preview/CLI path was not actually regenerated after cleanup; the shipped V2 GLB was already verified.

Production browser tests, before the last chase-camera correction:

| Circuit              | Complete run | Median FPS | Tenth percentile |
| -------------------- | -----------: | ---------: | ---------------: |
| Riviera / sunset     |      115.0 s |       60.0 |            59.95 |
| Black Forest / clear |      137.2 s |       60.0 |            59.99 |
| Marina Bay / rain    |      132.1 s |       60.0 |            59.98 |

All three two-lap races finished; result simulation froze. Three full world cycles returned identical geometry/texture counts. No runtime/hydration errors were captured in that benchmark. Read `docs/PERFORMANCE.md` for exact conditions and limitations; structured data is in `docs/evidence/performance.json`.

Latest actual UI/keyboard check passed settings-modal Enter protection, Eco resolution bound, throttle/steer/brake/boost, camera, reset, pause/resume, finish time trial, restart, blur pause, persisted camera settings, and portrait menu bounds. It **failed** on the landscape start-button assertion, so the final accumulated page-error assertion was not reached. See `docs/evidence/browser-check.json`.

Physical controller, real touch device, Safari, other GPUs and all nine circuit/weather combinations have not been fully tested. No fan-RPM or total-power measurement was taken. Do not claim silent operation.

## 5. Restart and test

Node 22.13+ is required; this machine used Node 24.19.0. Dependencies are installed. Preserve the lockfile and scaffold.

```sh
npm run dev -- --host 0.0.0.0
```

The normal URL is `http://localhost:3000`; use the actual printed URL. For production verification:

```sh
npm run build
npm run start -- --port 8788
```

Rebuilding replaces `dist/` and can terminate a watching production server; restart it after a build. `docs/DEVELOPMENT.md` contains a dedicated visible-Chrome launcher and test commands. `scripts/benchmark.mjs` can launch its own visible Chrome. `scripts/browser-check.mjs` attaches to a dedicated CDP browser (default port 9224).

All servers and the dedicated test Chrome from the prior session were stopped. The embedded preview engine was disposed. No benchmark/pilot interval should remain. Do not reuse old tool session IDs or assume port 9224 is still available. Other agents' GPU jobs belong to the user and were left alone.

`?debug=1` exposes `window.__ASTRA__` for diagnostics and the opt-in benchmark pilot. Normal URLs do not expose it. Clear pilot intervals after use. Existing local test best laps/settings may come from automated driving; browser profiles/origins are separate from repository data.

## 6. Code map and important fixes

Start with `docs/ARCHITECTURE.md`.

- `src/game/engine.ts`: composition/lifecycle, renderer, transitions, telemetry.
- `race-session.ts`: deterministic 120 Hz simulation, AI, laps/boost/results.
- `render-loop.ts`: independent render deadlines and pixel-budget adaptation.
- `camera.ts`: attached cockpit and translation-carrying chase rig.
- `vehicle.ts`: shared GLTF geometry, per-car cloned materials/effects, wheels.
- `world.ts` / `world/*`: circuit/scenery/lighting/weather construction and disposal.
- `src/ui/*` / `src/ui/styles/*`: UI components and separated menu/HUD/dialog/responsive styles.
- `scripts/build_car.py`: original asset generator; output defaults to ignored `artifacts/car/`; `--preview` enables optional expensive renders.

Fixes already applied—do not regress them:

- Cockpit world-space smoothing left the camera behind the driver's seat at speed. The cockpit now moves rigidly with the car and hides `driver_head`.
- Chase world-space smoothing made its distance grow with speed. Translation now carries with the car before relative smoothing.
- Frame deadlines formerly quantized 144 Hz displays toward 48 FPS; retained deadlines now pass tests from 60 through 165 Hz.
- The sky sphere was beyond the camera far plane; it is now inside it.
- Per-car shadow/brake-light geometry and asynchronous tree callbacks caused lifecycle risks; ownership/disposal and preload behavior were corrected.
- Finished races used to continue moving; simulation now freezes results.
- Physical collision gaps now wrap across the finish line and lap counts.
- SVG `<title>` interpolation caused hydration mismatch; it now has one string child.
- Settings-dialog shortcuts are guarded, and camera/mute keyboard changes persist.
- Coastal ground covered the sea; the ground now ends at the shoreline.

## 7. Accounts, Git and checkpoint warning

Verified in the prior session without exposing tokens:

- Local Codex CLI: `rcbran.dev@gmail.com`, default organization **Personal**, ChatGPT login.
- Private Site owner/access: same personal email, sole allowed viewer, no groups or external visitors.
- Global Git author was the company email. Only this repository was configured with name `RC Branham` and email `rcbran.dev@gmail.com`; global settings were not changed.

The user saw a Codex checkpoint warning about missing `refs/t3/checkpoints/.../turn/0`. The folder began without Git; a `turn/1` checkpoint existed after initialization but no `turn/0` baseline did. `git fsck` found no corruption. A normal initial source commit established Git history. The old turn's diff can remain unavailable; **do not fabricate internal checkpoint refs** to conceal it.

## 8. Hosting state

Use the existing `.openai/hosting.json` project ID verbatim:

`appgprj_6a9c96484ab081919378a4aa6684a3f3`

Title: Astra Formula. Slug: `astra-formula-racing`. Registered privately under the personal account, version count zero. Never create a second Site when resuming this checkout. Follow the installed Sites building/hosting skills; only the owning agent performs Site operations. Obtain a fresh repo-scoped source credential for this same project if publishing later; old credentials were ephemeral and were not saved in the repo. No tokens should be placed in docs, Git config or remote URLs.

Publishing was intentionally not done because the latest user instruction requested a pause and handoff. Do not treat registration as a live playable URL.

## 9. Evidence and external files

Committed: runtime assets, editable car-generation script, source, lockfile, tests, asset notices/provenance, docs, and compact evidence summaries.

Ignored but available on this machine:

- `artifacts/benchmark.json`: raw samples and render details.
- `artifacts/*-validated.png`, `*-results.png`: full-race visuals/results.
- `artifacts/cockpit-production.png`: current cockpit from the control test.
- `artifacts/menu-390x844.png`, `menu-landscape-issue.png`, `menu-handoff.png`.
- `docs/references/f1-23-wet-singapore.jpg`, `f1-24-dusk-cockpit.jpg`: copyrighted research only, never ship in game assets.

Temporary raw worker outputs: `/tmp/f1-astra-assets/car/`, `/tmp/f1-astra-assets/environment/`, `/tmp/f1-astra-assets/asphalt/`, `/tmp/f1-astra-assets/unused/`. Do not depend on these paths being available on another machine. Asset source URLs/hashes and the required runtime files are in the repository.

Previous native Astra workers completed their bounded tasks: original car asset, environment assets and read-only code review. They have no ongoing work to wait for. The next session need not reuse those agent IDs.
