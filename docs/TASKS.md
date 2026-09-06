# Task tracker

Updated 2026-09-06. Active direction: Astra Street, following the user's Street Heat reference and explicit gameplay pivot.

## Active tree/scenery overhaul — migration checkpoint

The user is moving from the MacBook to a mini PC. Read `HANDOFF.md` for exact state. This source checkpoint is not deployed.

- [x] Replace whole-tree cards/cone layers with seven documented CC0 3D variants at three LODs.
- [x] Repair source UVs/mask colors, improve wood budgets and retain complete far foliage components.
- [x] Add spatial LODs with hysteresis, crown spacing, clearings, cliff exclusions and shadow-matched wind.
- [x] Add curved grass/ferns/shrubs in colonies and scanned forest-floor/rock PBR materials.
- [x] Ground roots on actual terrain triangles; keep paved corridors clear.
- [x] Reshape foothills, distant mountains and broad terraced cliffs; improve rural road furniture.
- [x] Honor per-material HDR response and repeated weather changes; integrate contact-shading trial.
- [x] Switch racing/menu target and adaptation to 30 FPS, preserving caps/suspension/input clearing.
- [x] Pass 31 tests, strict typecheck, lint and production build.
- [x] Capture 434 static tree views and 90 undergrowth views; verify current GLB hashes.
- [x] Reproduce all nine new ground/rock textures from checksum-verified sources, byte-identical.
- [ ] Fix remaining in-world white/cyan broadleaf mipmap contamination; retain filtered foliage.
- [ ] Finish driving/weather visual acceptance, including contact-shading cost/benefit.
- [ ] Run production controls, responsive/touch, DPR/fullscreen and resource-lifecycle checks on new rendering.
- [ ] Run nine full route/weather races; document actual mini PC renderer/framebuffer/timing and limits.
- [ ] Update final comparison/performance reports, push validated source, privately publish the existing Site.

## First street pass

- [x] Pull the existing Sites source on the MacBook and preserve project/history.
- [x] Recheck the inherited landscape menu and display-scaling fixes in visible hardware Chrome.
- [x] Inspect the video and document concrete visual targets.
- [x] Create an original S9 sports coupe with working wheels and nitro exhaust.
- [x] Generate/integrate rock and conifer textures with prompts and provenance.
- [x] Add bounded instanced cliff scenery, foliage variety and lower rural barriers.
- [x] Add handbrake slip, drift smoke, skid marks, score chains, near misses and speed checks.
- [x] Adapt the menu/HUD, route identity and chase/bonnet cameras.
- [x] Verify 24 deterministic tests, typecheck, owned-source lint and production build.
- [x] Production keyboard/UI check including drift/scoring and five menu sizes.
- [x] DPR/quality/fullscreen checks and nine route/weather world builds with stable resource cycles.
- [x] Corrected-resolution hardware timing: three short visible M4 Max samples at 1821×1138, median 60 FPS.
- [x] Emulated multi-touch and compact landscape HUD verification.
- [x] Privately publish version 1 and return the existing preview tab to the production URL; owner sign-in required.

## Landscape and steering pass

- [x] Compare chase frames with the reference video and the first release.
- [x] Correct horizontal steering across the shared input path; add camera-space regression coverage.
- [x] Add sculpted terrain, higher mountain ridges, connected fractured cliffs and dense forest bands.
- [x] Add solid roadside conifers, spatial forest batches, undergrowth and asphalt wear.
- [x] Switch automation to a separate headless profile; verify M4 Max Metal rendering and record controls video.
- [x] Pass 26 tests, strict typecheck, lint and production build.
- [x] Pass headless keyboard/menu, DPR/fullscreen, nine-world and resource-cycle checks.
- [x] Create the personal private GitHub repository `rcbran/astra-street`.
- [x] Short headless GPU samples at 1821×1138: three default routes, 60 FPS median.
- [x] Push validated source to personal private GitHub and Sites; private Site version 2 succeeded.

## Later refinements

1. Have the user drive laps and describe steering/handbrake feel. Tune from feedback; the pilot only validates behavior.
2. Improve cliff profiles, varied roadside composition and car surface detail against the video. This first pass remains simpler than the reference.
3. Improve city silhouettes, facade density and lighting composition.
4. Test physical controller, real touch devices and Safari. Browser emulation does not establish physical-device quality.
5. Extend coverage to nine complete route/weather races. The nine-world test is a load/render check, not nine completed races.
6. Choose a source license before any requested change from private to public GitHub visibility.
