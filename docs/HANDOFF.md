# Session handoff — Astra Street

**Updated 2026-09-06 on kyogre / Arch Linux. Read this first**, then `TASKS.md` and `ARCHITECTURE.md`.

## Resume here

**Active continuation:** the user requested repeated implementation and four independent Luna reviews until the result substantially matches Street Heat. All four initial and all four round-05 reviewers rejected parity. This remains an open goal, not an accepted release. Read `REFERENCE-ITERATION.md` for the newer canyon, conifer, HUD, effects and performance work. At the final checkpoint, production is available on port 8788. The dedicated headless browser is stopped after checks; no dev server is running. Verify listeners on resumption. The served round-10 build matches runtime source; the asset notice author correction was copied afterward.

The active task is the tree/scenery overhaul with a **30 FPS target** and dedicated headless testing. The user confirmed that other agents work on this PC, but this agent is the only one working on Astra. Use separate owned browser/server instances; stop stale Astra servers, leave other projects alone. The latest user request is to conserve usage, delegate additional work to Luna where possible, and wrap a reviewable checkpoint. Earlier they requested Astra medium for difficult work. Ten focused worker reviews ran in waves (the session allowed four concurrent agents including main). Main owns integration and GPU tests run sequentially.

Checkout: `/home/dev/git/personal/astra-street`, branch `main`, private GitHub `rcbran/astra-street`. Source starts from `8d30b17` (the MacBook scenery checkpoint). This checkpoint is committed to the personal GitHub repository; it is not deployed. Live Site remains version 2; see hosting below. Other projects were left alone. Production 8788 is retained for local review; automation is stopped.

## Current correction and validation

- **Broadleaf white/cyan mipmap defect fixed.** `scripts/assets/trees/pad_broadleaf_atlas.py` preserves every alpha byte and mapped source color (all three LODs plus a two-texel margin verified against continuous bilinear support), extending non-white mapped RGB into unused atlas space. No UV/geometry change, tint, nearest-filter shortcut or mipmap disabling. Candidate GLB hash: `2581f4739d4e2cccbdfeb966b344105a73f21426c09b8aea2ef0911270937a73`; 5,702,788 bytes. Re-running padding is byte-idempotent. See `BROADLEAF-DIAGNOSTIC.md` and `assets/tree_small_02-padding.json`.
- Six exact frozen before/after pairs cover Pinecrest/Canyon × clear/sunset/rain through the real presentation pipeline. Sixty-two broadleaf views cover all three LODs and preserve crown volume; far density remains about 57% of near in the static fixture. Zero browser errors; zero GLB errors, six unchanged derivative-tangent warnings.
- **41 tests, typecheck and production build passed before the limit; final production keyboard/UI, emulated touch, DPR/quality/fullscreen, moving-camera and nine-world resource checks also passed after resumption.** New render checks verify presentation target dimensions and engine ownership: shared tree/surface/environment resources survive world switches, release on teardown, and tolerate repeated disposal. Final reports: `docs/evidence/kyogre-street/round10-{browser,render,touch}-check.json`.
- Hardware confirmed: **AMD Radeon 780M Graphics (radeonsi phoenix ACO)** via ANGLE/OpenGL ES, dedicated HeadlessChrome 153.0.8010.12, Arch Linux kernel 7.2.3-arch1-2. Node 26.8.1 builds and serves the existing lockfile successfully. Timing is headless, on a shared PC, not visible pacing or isolated GPU/thermal evidence.
- Frozen Pinecrest GPU A/B at 1821×1138: clear 34.91 ms direct / 41.59 ms contact-shaded; rain 38.58 / 45.29 ms (medians, 20 samples per mode, alternating order). Keep the 30 FPS cap and adaptive resolution. Contact shading adds about 6.7 ms at this resolution; the nine-run sweep puts wet Pinecrest below target at 26.56 FPS median / 22.86 FPS tenth percentile. Eight other route/weather medians round to 30. Exact adaptive sizes and timing limits are in `PERFORMANCE.md`. This cost comparison includes MSAA/half-float presentation and both fullscreen draws, not just the shading shader.
- Final-asset wet Pinecrest production repeat: **22.62 FPS median / 18.69 FPS tenth percentile**, 1275×796 through 1821×1138 internal pixels. Two-lap distance and all-driver/result freeze assertions passed, along with three resource cycles and zero errors. Timing differs from the earlier sweep under unisolated shared load; no cause is assigned.
- Round-10 focused wet Pinecrest repeat passed with **29.51 FPS median / 21.64 FPS tenth percentile**, 1275×796 through 1821×1138 internal pixels, 43.59 ms ending rolling GPU p95 and 124.8 ms highest CPU-submit p95. It completed two laps, froze all-driver/results state, and passed three resource cycles with zero errors. This is headless shared-PC evidence, not visible-display pacing; the tenth percentile remains below the 30 FPS target.
- Round-10 frozen GPU budget evidence passed: Canyon sunset baseline **29.78 ms GPU / 4.70 ms CPU**, wet Pinecrest baseline **37.65 ms / 20.40 ms**; direct presentation measured 23.66 ms and 29.46 ms respectively. These are fixed-pose ablations, not race benchmarks or visual-equivalence claims.
- Portable new evidence: `docs/evidence/kyogre-trees/`. Full images/raw output are ignored under `artifacts/`. Old Mac evidence below is historical and must not be attributed to the 780M.

## Remaining work

1. Tune wet Pinecrest on the 780M while preserving the 30 FPS target and visual quality. The nine production two-lap route/weather races passed completion, frozen distance/clock/position, errors and 27 world cycles, but wet Pinecrest missed the target. Consider tighter per-LOD tree bounds or reflection-specific tree detail; these are unmeasured suggestions, not established wins.
2. Keep the evidence distinction: nine-race timing and UI/resource suites used the initial padded atlas (`28bbaeba…`); the final conservative bilinear-margin correction is `2581f473…`. Final-asset visual checks and a focused wet Pinecrest repeat are separate. Alpha, geometry, materials and runtime pipeline did not change.
3. Preserve remaining visual limitations: broadleaf far-LOD thinning, coarse undergrowth at close range, simple car/city and flat racing surface. Human handling feedback and physical-device/Safari coverage remain outstanding.
4. The overhaul is not yet a published release. Performance acceptance remains open; publish only a validated source to the existing private Site, never create another Site.

## What is implemented

- **Trees:** seven CC0 Poly Haven variants (three fir, three pine, one broadleaf), three fully 3D LODs each. Whole-tree cards and the old cone-layer generator are removed. Branches and individual cutout leaf/twig surfaces fill the crown in 3D. Fir UV data was repaired; source mask vertex colors were removed; near bark budgets increased after simplification produced fins. Far LODs retain complete foliage components with modest enlargement instead of collapse-decimating leaves into slivers. Pine/broadleaf partially transparent RGB was extended from opaque pixels; UV-aware broadleaf padding now fixes the separate opaque-atlas mip issue.
- **Forest layout:** species and height variation, smaller saplings, natural clearings, crown spacing and cliff avoidance. Conifers generally 13–28 m; broadleaf accents 5–11 m. Spatial tiles are 160 m, with per-tree LOD hysteresis. Balanced thresholds are 100/270 m, Eco 65/185, Ultra 130/350. Only tiles changing LOD upload instance transforms. Wind matches beauty and shadow depth passes.
- **Ground:** curved grass, fern fronds and branched shrubs, arranged in compact roadside colonies. Pinecrest uses a CC0 moss/litter texture with normal/roughness maps; Canyon retains dry sparse-grass soil. Terrain samples now match the rendered mesh triangles, fixing floating/buried roots on saddle-shaped cells. Paved-road clearance still passes.
- **Landscape:** gentler foothills, lower layered distant ranges with reduced dry haze, eight broad terraced escarpment profiles and four fractured boulder profiles. Scanned warm sandstone and gray/mossy rock use color/normal/roughness maps; steep terrain uses triplanar projection. Rural roads have steel guardrails, posts/delineators, worn center dashes, narrow asphalt shoulders and soil verges. City architecture/gameplay remains the previous implementation.
- **Lighting:** `environment-lighting.ts` explicitly binds the engine-owned HDR map so authored per-material intensity is respected. Three r180 otherwise substitutes `scene.environmentIntensity` when material `envMap` is null. Weather scaling is based on immutable authored intensity and does not compound. Shared environment is excluded from world disposal. Balanced/Ultra directional shadow map is now 4096².
- **Presentation trial:** `scene-presentation.ts` adds an MSAA4 half-float beauty target, half-resolution depth-derived contact shading and a bilateral composite. Real alpha tests and wet reflections remain in the beauty pass. Eco/unsupported contexts bypass it. Two fullscreen draws; engine-owned targets follow physical framebuffer size. Shader/Reflector/state/resize and full-game production resource lifecycle checks passed. Performance acceptance remains open because wet Pinecrest falls below target on the 780M. The effect is subtle, not global illumination.
- **Budget:** fixed 120 Hz simulation; race/countdown/menu cap 30 FPS; pause/results 20. Balanced/Eco adaptation reduces resolution only after sustained samples below 25 FPS and recovers slowly above 29; healthy capped 30 FPS no longer triggers the previous 60-FPS controller. Pixel caps, hidden suspension, blur clearing and DPR round-trip handling remain.

Latest early driving worlds: Pinecrest **6,918 trees**, 22,008 grass clumps, 2,003 ferns, 378 shrubs, 390 rock instances; Canyon **3,060 trees**, 9,591 grass clumps, 180 shrubs, 780 rock instances. Every placed tree is 3D. These are authored counts, not simultaneously visible counts or performance guarantees. Wider cliff footprints intentionally exclude more trees than earlier trial builds.

## Historical MacBook checkpoint validation

- **31 deterministic tests pass**, strict TypeScript passes, owned-source lint passes, production build passes. New coverage includes 30-FPS scheduling/adaptation, screen-right/left control convention (retained), terrain mesh/root agreement, LOD ownership and non-compounding environment response.
- Final static QA captured **434 tree views across 21 specimens** and **90 undergrowth views**, headless Chrome 152.0.7977.76 on ANGLE/Metal Apple M4 Max, with zero errors. Current GLB hashes match reports. Crown volume persists around inspected yaw/elevation angles. Far/near projected coverage is 101–121% for fir, 72–88% for pine, 57% broadleaf; this is descriptive, not a visual-equivalence score.
- Controlled galleries do not use the environment HDR and did not reveal the in-world mip defect. Remaining limitations include LOD density changes, coarse enlarged far foliage, angular close-up undergrowth, simple car/city geometry and a flat racing surface. Do not claim reference/AAA parity.
- Khronos validators report zero GLB errors; derivative-tangent warnings are expected. Both portable texture pipelines reproduced all nine new ground/rock files byte-for-byte from checksum-verified cached originals.
- Short development driving captures were inspected at 1440×900 CSS/DPR1; an environment A/B used 1821×1138 internal pixels at CSS 1440×900/DPR2. The HUD read 30 FPS, but **no final production full-race benchmark or full resource-cycle check had been run at that MacBook checkpoint**. Previous 60-FPS evidence in `PERFORMANCE.md` belongs to earlier releases.
- Selected portable reports and images: `docs/evidence/trees-wip/`. Raw reports honestly record dirty source based on `b647678998da7707d0342905505d18f7a16c32af`; that parent SHA alone does not represent the measured working tree. Full image collections remain ignored on the MacBook; tracked fixtures regenerate them.

## Run and verify on the mini PC

Use Node 22.13+ (kyogre validated 26.8.1; MacBook used 24.19.0), the existing lockfile and a WebGL2 browser. Install missing dependencies with `npm ci`; do not copy `node_modules` or `dist` between platforms and do not re-scaffold.

```sh
npm ci
npm run dev -- --host 0.0.0.0
```

In another terminal, start the dedicated headless browser:

```sh
ASTRA_BROWSER_ANGLE=gl-egl node scripts/launch-browser.mjs
```

Default CDP is 9224. The `gl-egl` override selects the verified Mesa hardware path on kyogre; omit it on the MacBook. Verify the renderer; a headless process can still use software rendering. `ASTRA_BROWSER_CHANNEL=chrome` selects an installed Chrome channel where needed; consult `DEVELOPMENT.md`. Never attach to the user's personal browser or open a visible test window without a new request.

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
- Main owns integration and Site operations; workers return outside-checkout proposals. Current user preference is Luna for simple QA and GPT Astra medium for difficult work. No Orca. Credentials must be fresh/ephemeral per-command headers, never printed, committed or embedded in remotes. Obtain fresh credentials on the new machine; do not copy authentication files into Git.

## Historical MacBook browser and process handoff

The user reported the inline preview appearing persistently in another chat window. The preview service returned no attached tab (`available:true`, `visible:false`, null tab/URL/title); the cause was not confirmed. All current testing used a separate headless profile, not that preview. Do not reopen a visible preview to work around the nightly issue.

MacBook task-owned processes were the dev server on 3000 and headless Chrome/CDP on 9224. They are stopped as part of this migration checkpoint after workers close owned contexts. No production server or benchmark remains running. The unrelated `expecto-patronum-challenge` development process/port 4173 was not touched. Process IDs and tool sessions do not transfer: inspect the new machine and start fresh.
