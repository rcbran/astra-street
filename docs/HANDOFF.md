# Session handoff — Astra Street

**Updated 2026-09-06. Read this first**, then `TASKS.md` and `ARCHITECTURE.md`.

## Active user intent and workflow

The user pivoted to street racing, then requested a substantial graphics/landscape improvement, comparison with the Street Heat video, and corrected horizontal steering. They subsequently requested **headless browser automation off their screen** and a copy in their **personal GitHub**. Continue that direction; the F1 brief is historical.

- Checkout: `/Users/rcbranham/git/personal/f1-racing-astra`, Apple M4 Max, Node 24.19.0.
- Use a dedicated headless Chrome profile for captures/tests. The installed Chrome channel reports ANGLE/Metal on the M4 Max. Do not open a visible test window without a new request. Headless GPU timing is separate from visible-window display pacing.
- Nominal 60 FPS; 40–50 FPS under shared GPU load is acceptable. Preserve frame/pixel caps, hidden-tab suspension and input clearing.
- No Orca and no delegation unless active instructions authorize it; authorized workers must use `gpt-6-astra`. No workers or new image-generation requests were used in this landscape pass.

## Current implementation

Astra S9 coupe, Canyon Run / Pinecrest / Harbor City, handbrake slip, drift smoke/skid marks, bankable chains, near misses, speed checks and rechargeable nitro. Two-lap AI races and unlimited time trial remain. Space is drift, W/A/S/D or arrows drive, Shift is nitro; S/down is service braking. The alternate `cockpit` settings key provides bonnet view.

**Steering corrected:** input +1 means screen-right across keyboard, touch and controller. A +Z-forward chassis needs negative world yaw for that movement, so simulation converts the sign once and the benchmark pilot converts back. Camera-space regression and actual keyboard checks cover both directions. Prior tests only checked the internal offset sign and missed the inversion.

**Landscape:** a 251×251 height field keeps paved routes clear while lifting surrounding hills. Larger ridged mountains fill the distance. Six reusable fractured cliff profiles form connected walls, ribs, spires and talus. Spatially batched forests mix three solid near-conifer variants/trunks with the two existing far-tree atlases; grass clumps and a seeded road-wear overlay add close detail. Canyon has 6,207 trees including 1,500 solid conifers; Pinecrest has 10,853 including 1,500 solid. Harbor gains a mountain backdrop and 78 distant trees. The original runtime image/GLB files and lockfile are unchanged.

Ownership stays modular. Engine owns shared textures/car geometry; world owns its meshes/materials and generated overlay maps. Spatial batches share immutable geometry within a world. Smoke/spray uses 384 particles and skid marks use a 768-segment ring. Terrain generation happens during configuration, not per frame. The earlier scalar DPR fallback remains intact.

## Comparison and validation

- `FRAME-COMPARISON.md` compares the first release with the new canyon and documents the reference observations. The original video and extracted frames remain ignored under `artifacts/reference-street-heat/`, never in runtime assets. `artifacts/landscape-comparison.html` displays reference / old / new together.
- Terrain and forest density are substantially higher, but the car remains simple, near trees are stylized, distant trees use crossed cards, cliff profiles repeat and the racing surface is flat. Do not claim video/AAA parity.
- **26 tests**, strict typecheck, owned-source lint and production build pass. New tests cover camera-space left/right movement and terrain clearance along all paved routes.
- Production headless keyboard/UI checks cover both steering directions, drift scoring, nitro/braking, pause/blur, restart, time trial and five responsive menu sizes. Recorded WebM: `artifacts/control-video/page@4bd72ca25bb42a6ef024186ab5608bdc.webm`.
- DPR/quality/fullscreen, moving chase camera, nine route/weather world builds and three stable resource cycles pass. Nine world builds are not nine completed races. Emulated multi-touch passes; physical devices and Safari remain untested.
- Three short headless M4 Max pilot runs held 60 FPS medians at **1821×1138 drawing buffer**, 1440×900 CSS / DPR 2. They are not native Retina, 1920×1080, visible pacing or thermal measurements. Read `PERFORMANCE.md` for exact GPU/CPU values and limits.
- Portable evidence uses `docs/evidence/landscape-*`. Timing reports honestly record the dirty working tree based on `763f684`; that parent SHA alone does not describe the measured landscape source. Raw screenshots record timestamps and positions; route changes now go through the UI to keep labels synchronized.

## GitHub and hosting

- Personal private GitHub repository: **https://github.com/rcbran/astra-street**, remote `origin`. The user authorized this copy; private visibility was the stated default. Public visibility and source licensing remain pending separate choices.
- Sites source remote: `sites`, branch `main`, URL `https://git.chatgpt-team.site/55cfd5d9-5d0c-44b9-9b4c-a37c7926c6a7/appgprj_6a9c96484ab081919378a4aa6684a3f3.git`.
- Reuse `.openai/hosting.json` verbatim: `appgprj_6a9c96484ab081919378a4aa6684a3f3`. Never create another Site. Owner-only access was rechecked: one personal owner, no groups or external viewers.
- Existing private playable URL: **https://astra-formula-racing.rbranham.chatgpt.site**. Legacy URL slug stays; title is Astra Street. Owner sign-in is required.
- Landscape source `2ee68509713e7d0a9e42be0bdb131f1014b35635` is pushed to both remotes. `main` now tracks `origin/main`; continue pushing the validated source to `sites/main` before saving a Site version.
- **Private Site version 2 succeeded** on 2026-09-06, using that exact source. Version ID: `appgprj_6a9c96484ab081919378a4aa6684a3f3~appgver_5e688b40402c81919c2568ab9bc961fa`. Deployment ID: `appgdep_6a9cdf6b04bc8191ad8863f6e3f9206c`.
- The existing Site preview was returned to the production URL. Local production gameplay was tested headlessly; authenticated hosted gameplay was not separately replayed. This follow-up docs commit does not change the deployed application.
- The prior release is version 1, source `9ba6a575977c0ba8bd102d2d7dc74a6a61adb051`. A GitHub push alone does not update the Site.

Use repository-local personal author settings; never change global Git identity. Sites credentials must be ephemeral per-command headers, never printed, saved in files, or embedded in remotes. GitHub uses the existing authenticated `gh` account `rcbran`. Inspect local changes before pulling; preserve unrelated user work. The originally supplied unrelated GitHub repository was never merged.

## Next refinements and running

Have the user test the corrected controls. Continue improving natural cliff/foliage detail, car materials, city architecture and road elevation from feedback. Headless pilot runs establish behavior, not fun. Extend real-device coverage and full route/weather race coverage as useful, without repeated heavy benchmarks for unchanged rendering.

```sh
npm run dev -- --host 0.0.0.0
npm run build
npm run start -- --port 8788
node scripts/launch-browser.mjs
```

The launcher defaults to headless; `DEVELOPMENT.md` documents the sequential checks. A new build replaces `dist/`, so restart a production server afterward. Always release inputs/clear pilots and close owned contexts after checks. Session-owned servers/browser are stopped after publishing. Inspect current processes rather than reusing old session IDs. Normal gameplay URLs do not expose the `?debug=1` diagnostic interface.
