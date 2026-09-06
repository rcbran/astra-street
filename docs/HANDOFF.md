# Migration handoff — Astra Street

**Updated 2026-09-06, MacBook → mini PC. Read this first**, then `TASKS.md` and `ARCHITECTURE.md`.

## Resume here

The user requested a substantial tree/scenery overhaul, natural shape from all viewing angles, permission to use free models/textures and parallel Astra agents, and **30 FPS instead of 60**. The user is now migrating machines and explicitly requested this handoff. This is an **in-progress source checkpoint, not a new deployed release**. Preserve the improvements below and finish the remaining visual defect and production validation before publishing.

Clone or pull the personal private repository **https://github.com/rcbran/astra-street**, branch `main`. The checkpoint contains all runtime assets, authoring scripts/manifests, tracked gallery fixtures and selected visual evidence. No `/tmp` asset or old browser session is required to run the game. Start a new Codex chat in the cloned folder if the nightly app cannot reopen the same chat; tell it to read this document and continue the tree/scenery work. Exact cross-machine chat-history transfer was not established. A local CLI `codex resume` command alone does not copy the repository or running processes to another computer.

## First work to do

1. **Fix the remaining white/cyan broadleaf crowns at driving distance.** Controlled near/mid/far galleries are green, while some in-world broadleaf crowns become white. A frozen-world A/B keeps the problem with unlit diffuse-only material, no normal map, no shader patch, identity UV matrix and a known corrected source PNG. Disabling mipmaps and using nearest filtering removes it. The evidence points to filtering/mipmap contamination from opaque white unused atlas regions; the exact corrective mask/padding is not implemented. The previous edge-RGB dilation only changes alpha<255 pixels, so it cannot remove opaque unused white regions. Continue with UV-aware atlas cleanup/padding and valid-leaf coverage checks. Do not ship nearest filtering or disable mipmaps as a cosmetic shortcut. See `evidence/trees-wip/` and [BROADLEAF-DIAGNOSTIC.md](BROADLEAF-DIAGNOSTIC.md).
2. Recheck Pinecrest/Canyon driving views and all weather choices after the atlas correction. The new cliffs, ground tone and contact-shading pass are integrated but still need final acceptance in motion. Keep per-material environment binding; it fixed a separate lighting override and must not be reverted to hide the atlas issue.
3. Run production keyboard/UI, DPR/quality/fullscreen/resize, moving-camera and emulated-touch checks. Pay attention to the new postprocessing target lifecycle and shared HDR map exclusion during world disposal.
4. Run the modernized **nine complete route/weather races** and resource cycles once the render source is stable. The new full-race harness is ready but has **not run**. Verify the mini PC's actual GPU renderer and framebuffer. Do not transfer M4 Max timing claims to another GPU.
5. Update performance/frame-comparison evidence with actual results; then push validated source to both remotes and privately publish the existing Site. No new Site should be created.

## What is implemented

- **Trees:** seven CC0 Poly Haven variants (three fir, three pine, one broadleaf), three fully 3D LODs each. Whole-tree cards and the old cone-layer generator are removed. Branches and individual cutout leaf/twig surfaces fill the crown in 3D. Fir UV data was repaired; source mask vertex colors were removed; near bark budgets increased after simplification produced fins. Far LODs retain complete foliage components with modest enlargement instead of collapse-decimating leaves into slivers. Pine/broadleaf partially transparent RGB was extended from opaque pixels; the remaining opaque-atlas mip issue above is separate.
- **Forest layout:** species and height variation, smaller saplings, natural clearings, crown spacing and cliff avoidance. Conifers generally 13–28 m; broadleaf accents 5–11 m. Spatial tiles are 160 m, with per-tree LOD hysteresis. Balanced thresholds are 100/270 m, Eco 65/185, Ultra 130/350. Only tiles changing LOD upload instance transforms. Wind matches beauty and shadow depth passes.
- **Ground:** curved grass, fern fronds and branched shrubs, arranged in compact roadside colonies. Pinecrest uses a CC0 moss/litter texture with normal/roughness maps; Canyon retains dry sparse-grass soil. Terrain samples now match the rendered mesh triangles, fixing floating/buried roots on saddle-shaped cells. Paved-road clearance still passes.
- **Landscape:** gentler foothills, lower layered distant ranges with reduced dry haze, eight broad terraced escarpment profiles and four fractured boulder profiles. Scanned warm sandstone and gray/mossy rock use color/normal/roughness maps; steep terrain uses triplanar projection. Rural roads have steel guardrails, posts/delineators, worn center dashes, narrow asphalt shoulders and soil verges. City architecture/gameplay remains the previous implementation.
- **Lighting:** `environment-lighting.ts` explicitly binds the engine-owned HDR map so authored per-material intensity is respected. Three r180 otherwise substitutes `scene.environmentIntensity` when material `envMap` is null. Weather scaling is based on immutable authored intensity and does not compound. Shared environment is excluded from world disposal. Balanced/Ultra directional shadow map is now 4096².
- **Presentation trial:** `scene-presentation.ts` adds an MSAA4 half-float beauty target, half-resolution depth-derived contact shading and a bilateral composite. Real alpha tests and wet reflections remain in the beauty pass. Eco/unsupported contexts bypass it. Two fullscreen draws; engine-owned targets follow physical framebuffer size. Static shader/Reflector/state/resize checks passed in isolation, but full-game production lifecycle/performance acceptance remains pending. The effect is subtle, not global illumination.
- **Budget:** fixed 120 Hz simulation; race/countdown/menu cap 30 FPS; pause/results 20. Balanced/Eco adaptation reduces resolution only after sustained samples below 25 FPS and recovers slowly above 29; healthy capped 30 FPS no longer triggers the previous 60-FPS controller. Pixel caps, hidden suspension, blur clearing and DPR round-trip handling remain.

Latest early driving worlds: Pinecrest **6,918 trees**, 22,008 grass clumps, 2,003 ferns, 378 shrubs, 390 rock instances; Canyon **3,060 trees**, 9,591 grass clumps, 180 shrubs, 780 rock instances. Every placed tree is 3D. These are authored counts, not simultaneously visible counts or performance guarantees. Wider cliff footprints intentionally exclude more trees than earlier trial builds.

## Validation at this checkpoint

- **31 deterministic tests pass**, strict TypeScript passes, owned-source lint passes, production build passes. New coverage includes 30-FPS scheduling/adaptation, screen-right/left control convention (retained), terrain mesh/root agreement, LOD ownership and non-compounding environment response.
- Final static QA captured **434 tree views across 21 specimens** and **90 undergrowth views**, headless Chrome 152.0.7977.76 on ANGLE/Metal Apple M4 Max, with zero errors. Current GLB hashes match reports. Crown volume persists around inspected yaw/elevation angles. Far/near projected coverage is 101–121% for fir, 72–88% for pine, 57% broadleaf; this is descriptive, not a visual-equivalence score.
- Controlled galleries do not use the environment HDR and did not reveal the in-world mip defect. Remaining limitations include LOD density changes, coarse enlarged far foliage, angular close-up undergrowth, simple car/city geometry and a flat racing surface. Do not claim reference/AAA parity.
- Khronos validators report zero GLB errors; derivative-tangent warnings are expected. Both portable texture pipelines reproduced all nine new ground/rock files byte-for-byte from checksum-verified cached originals.
- Short development driving captures were inspected at 1440×900 CSS/DPR1; an environment A/B used 1821×1138 internal pixels at CSS 1440×900/DPR2. The HUD read 30 FPS, but **no final production full-race benchmark or full resource-cycle check has been run for this overhaul**. Previous 60-FPS evidence in `PERFORMANCE.md` belongs to earlier releases.
- Selected portable reports and images: `docs/evidence/trees-wip/`. Raw reports honestly record dirty source based on `b647678998da7707d0342905505d18f7a16c32af`; that parent SHA alone does not represent the measured working tree. Full image collections remain ignored on the MacBook; tracked fixtures regenerate them.

## Run and verify on the mini PC

Use Node 22.13+ (MacBook used 24.19.0), the existing lockfile and a WebGL2 browser. Install dependencies with `npm ci`; do not copy `node_modules` or `dist` between platforms and do not re-scaffold.

```sh
npm ci
npm run dev -- --host 0.0.0.0
```

In another terminal, start the dedicated headless browser:

```sh
node scripts/launch-browser.mjs
```

Default CDP is 9224. Verify the renderer; a headless process can still use software rendering. `ASTRA_BROWSER_CHANNEL=chrome` selects an installed Chrome channel where needed; consult `DEVELOPMENT.md` for Linux dependencies and software-only functional testing. Never attach to the user's personal browser or open a visible test window without a new request.

```sh
ASTRA_ALL_LODS=1 ASTRA_OUTPUT=artifacts/tree-angle-check node scripts/tree-angle-check.mjs
ASTRA_GALLERY=undergrowth ASTRA_OUTPUT=artifacts/undergrowth-angle-check node scripts/tree-angle-check.mjs
```

Those fixtures require the dev server on 3000 and no old `artifacts` files. After visual fixes, build and serve the production Worker in separate terminals:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run start -- --port 8788
```

Run GPU checks **sequentially** with unchanged rendering:

```sh
node scripts/browser-check.mjs
node scripts/render-check.mjs
node scripts/touch-check.mjs
ASTRA_CDP=http://localhost:9224 ASTRA_ALL_WEATHER=1 ASTRA_OUTPUT=artifacts/trees-full-races node scripts/benchmark.mjs
```

Environment-prefix examples are POSIX shell syntax; use the target shell's equivalent on Windows. The full-race harness defaults to production on port 8788, owns a headless context at CSS 1440×900/DPR2, records actual framebuffer and all per-second snapshots, checks frozen results and repeated world resources, then releases input/pilot/context. Restart the production server after rebuilding. `?debug=1` exposes `window.__ASTRA__`; normal gameplay URLs do not.

## Files and asset reproduction

Read `ARCHITECTURE.md` for modules/ownership and `ASSETS.md` for sources/licenses. All gameplay assets are local; no API key or asset-site account is required. New CC0 files and exact SHA256/size are in `environment-provenance.json`. Source licensing/public GitHub remain undecided; keep the repository private.

- Tree authoring: `scripts/assets/trees/README.md`; Blender 5.2, Python/Pillow/NumPy/SciPy. Scripts still use a documented `/tmp/astra-tree-assets` authoring root; copy them/manifests there or update roots consistently. Runtime does not depend on it.
- Rock/ground authoring: portable `scripts/assets/{rocks,ground}/prepare.py`, committed source manifests, `--work-dir` option, checksum verification. These write only reviewed intermediate outputs, never directly to `public`.
- Mac-only scratch: `/tmp/astra-tree-assets`, `/tmp/astra-tree-qa`, `/tmp/astra-scenery-work`; ignored `artifacts/reference-street-heat`, `trees-angle-release`, `undergrowth-angle-release`, `trees-world-*`, `broadleaf-*-diagnosis`. They contain optional originals/iterations, not missing runtime dependencies. Reference video/screenshots must not ship as game art.

## Git and deployed Site

- Private GitHub: **https://github.com/rcbran/astra-street**, `origin`, branch `main` tracking `origin/main`. Repository-local personal Git identity is set on the Mac; on a fresh clone inspect/set the user's personal identity locally, never globally.
- Sites source: remote `sites`, `https://git.chatgpt-team.site/55cfd5d9-5d0c-44b9-9b4c-a37c7926c6a7/appgprj_6a9c96484ab081919378a4aa6684a3f3.git`. Git remotes are clone-local; add this remote on the mini PC if absent.
- `.openai/hosting.json` stays unchanged: project **`appgprj_6a9c96484ab081919378a4aa6684a3f3`**. Reuse it; never create another Site.
- **Live game remains private Site version 2**, source **`2ee68509713e7d0a9e42be0bdb131f1014b35635`**, at **https://astra-formula-racing.rbranham.chatgpt.site**. Title Astra Street, legacy URL slug retained. Owner sign-in required.
- Version ID: `appgprj_6a9c96484ab081919378a4aa6684a3f3~appgver_5e688b40402c81919c2568ab9bc961fa`; deployment ID `appgdep_6a9cdf6b04bc8191ad8863f6e3f9206c`. Source checkpoint pushes do not deploy it. Recheck owner-only access before a future private release.
- Main owns integration and Site operations; workers use GPT Astra and return outside-checkout proposals. No Orca. Credentials must be fresh/ephemeral per-command headers, never printed, committed or embedded in remotes. Obtain fresh credentials on the new machine; do not copy authentication files into Git.

## Browser and process handoff

The user reported the inline preview appearing persistently in another chat window. The preview service returned no attached tab (`available:true`, `visible:false`, null tab/URL/title); the cause was not confirmed. All current testing used a separate headless profile, not that preview. Do not reopen a visible preview to work around the nightly issue.

MacBook task-owned processes were the dev server on 3000 and headless Chrome/CDP on 9224. They are stopped as part of this migration checkpoint after workers close owned contexts. No production server or benchmark remains running. The unrelated `expecto-patronum-challenge` development process/port 4173 was not touched. Process IDs and tool sessions do not transfer: inspect the new machine and start fresh.
