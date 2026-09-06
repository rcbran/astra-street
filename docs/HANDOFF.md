# Session handoff — Astra Formula

**Updated 2026-09-06. Read this first.** The user requested a pause, Git push and handoff to respawn on the MacBook. Implementation and Site deployment are paused. Resume only when the next session asks to continue. The original high-fidelity goal remains open.

## Current environment and constraints

- Checkout: `/home/dev/workspace/repos/f1-racing-astra` on Linux host `gengar-db`. Node 24.19.0; `npm ci` completed with the committed lockfile unchanged and zero reported vulnerabilities.
- Gengar-db has 16 logical CPUs, 15 GiB RAM (about 11 GiB available at inspection), zero swap use and 257 GiB free disk. Builds are fast; software rendering is the bottleneck.
- This host has no exposed rendering GPU or desktop display. Dedicated headless Chromium uses SwiftShader. Missing browser libraries are in `/home/dev/.cache/astra-browser-libs/`; see `DEVELOPMENT.md` for the launcher. Do not compare its FPS with the Mac baseline.
- The game still targets a browser on the player's device. Nominal 60 FPS; 40–50 FPS is acceptable under shared laptop GPU load. Keep frame/pixel caps, hidden-tab suspension and blur input clearing.
- Personal project, modular Three.js/React/Vinext scaffold. Preserve resource ownership and original/licensed assets. AAA F1 games since 2020 are the reference, not an achieved fidelity claim.
- Do not use Orca. Do not delegate unless the active instructions authorize it; any authorized worker must use `gpt-6-astra`. No workers were used in this resumption.

## Resumption changes

1. Expanded the short-landscape menu rule beyond 800px, reset conflicting desktop positioning, corrected weather spacing and moved menu header controls below the logo. The final fix also shortens the invisible header hit area so it cannot intercept session-tab clicks. These header changes are scoped to menus so they do not move racing controls over the HUD.
2. Strengthened the production browser check: same driving assertions now wait for game time (with finite timeouts); repeatable initial settings; five viewport sizes; start-button bounds plus center-point obstruction checks; JSON evidence and cleanup on failure.
3. Reproduced a DPR-only change bug: 1440×900 at DPR 2 stayed at ratio 1 until the CSS size changed. Added a re-armed resolution media query and disposal; diagnostics now include CSS size, device DPR and effective ratio.
4. Added small original concrete/grime and runoff-aggregate textures in `src/game/world/track-surfaces.ts`. Two world-owned textures, no additional draw calls/lights. This is an incremental material pass; terrain, buildings and foliage still need work.
5. Added `scripts/launch-browser.mjs` and `scripts/render-check.mjs` for reproducible browser setup and resolution/world/camera checks.

## Verification and evidence

- Production build, strict typecheck, owned-source lint and all **19 tests** pass.
- `scripts/render-check.mjs`: DPR-only transitions, all quality ceilings, return to DPR 1, fullscreen entry/exit, moving chase-camera distance, all nine circuit/weather world builds, three stable resource cycles and no browser errors. Compact report: `docs/evidence/render-check.json`.
- Moving chase view inspected: `docs/evidence/chase-gengar.png`. Following sample: 233 km/h, 6.30 m horizontal camera distance and 2.08 m camera height. Software timing was about 3 FPS with adaptive resolution; **not a hardware performance claim**.
- The nine-world sweep loads/renders menu worlds; it does not complete nine races. Physical controller, actual touch device, Safari and human handling evaluation remain pending.
- The old M4 Max measurements remain historical evidence for the prior renderer/camera revision: three complete default races, median 60 FPS, **1440×900 drawing buffer** despite reported DPR 2. Do not call that native Retina or full 1080p. A fresh visible hardware run is required after the DPR fix.
- Final production keyboard/UI check passed on the latest build, including all five viewport sizes, unobscured menu/header controls and zero accumulated page errors. Exact viewport bounds are recorded in `docs/evidence/browser-check.json`. Raw reports and additional screenshots are in ignored `artifacts/` on gengar-db. Selected current screenshots are copied into `docs/evidence/` for the MacBook handoff.

## Next substantive work

1. On the MacBook, use the existing checkout at `/Users/rcbranham/git/personal/f1-racing-astra` if present. Check for local changes before fetching/fast-forwarding `main`; do not overwrite them. Install from the unchanged lockfile only as needed.
2. Launch a dedicated visible Chrome, verify the five menu sizes and inspect a moving chase view at the corrected DPR. Run a short hardware timing check; keep CSS size, actual drawing buffer and GPU renderer in the evidence.
3. Improve terrain/horizon and city/coastal composition, building silhouettes and repeated foliage. Use driving screenshots to judge each change, keeping measured budgets and ownership/disposal intact.
4. Have the user drive manual laps to assess fun and handling. The automated pilot proves behavior/completion, not driving feel.
5. Extend real-device coverage to touch/controller and other browsers; finish all nine full circuit/weather races as practical.
6. Public GitHub publication and source-license selection remain separate pending work.

## Hosting and source control

The Git transfer target is the existing private Sites source repository:

- Local remote name: `sites`.
- Remote URL: `https://git.chatgpt-team.site/55cfd5d9-5d0c-44b9-9b4c-a37c7926c6a7/appgprj_6a9c96484ab081919378a4aa6684a3f3.git`.
- Remote branch: `main`.
- This is the project's private source Git repository, not a newly published GitHub project.

On the MacBook, add the same credential-free `sites` remote if missing, obtain a fresh repository-scoped credential for the existing Site through the Sites connector, and use per-command authentication to fetch. If the checkout is clean, fast-forward `main` from `sites/main`. Never save the token in Git config or the remote URL. Inspect `git status` first; preserve any local Mac changes.

Reuse `.openai/hosting.json` verbatim: `appgprj_6a9c96484ab081919378a4aa6684a3f3`. Never create a second Site. Private owner-only access was rechecked for the personal account, with no groups or external viewers. No version was saved and no deployment was started. The latest user request pauses publishing again for the MacBook handoff. Do not confuse a source Git push with a saved Site version or a playable deployment.

Branch `main` began with `826ced8` (source) and `0269613` (original handoff). Inspect `git log` for the current revision. Local author remains RC Branham / personal email; do not change global Git settings. No public GitHub remote has been created. Credentials must remain ephemeral and absent from docs, remote URLs and Git config.

The historical missing `refs/t3/checkpoints/.../turn/0` warning came from the folder starting without Git. `git fsck` found no corruption. Do not fabricate internal checkpoint refs.

## Starting and stopping

```sh
npm run dev -- --host 0.0.0.0
npm run build
npm run start -- --port 8788
```

All test processes owned by this session are stopped before handoff; no pilot should remain. Use the actual printed server URL. A build replaces `dist/`; restart a production server afterward. See `DEVELOPMENT.md` for dedicated CDP browser commands and Linux library setup. Check current ports/processes rather than reusing old session IDs or attaching to unrelated browser jobs.

`?debug=1` exposes `window.__ASTRA__`. Normal URLs do not. Always clear pilot intervals and release held inputs after checks. Test best laps/settings belong to the temporary browser profile.

Runtime assets and editable car generator are committed. Older ignored screenshots migrated with this checkout; timestamps/filenames distinguish historical Mac evidence from `*-gengar.png`. Temporary `/tmp/f1-astra-assets/` authoring outputs are not required and should not be assumed present.
