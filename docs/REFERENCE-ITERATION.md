# Street Heat iteration — kyogre

Updated 2026-09-06. The user requested continued iteration until four independent GPT Luna reviewers substantiate that the current game is basically the same as the Street Heat video. **Acceptance remains open.** All four initial and all four round-05 reviews rejected parity. Their common issues were cliff shape/enclosure, conifer crowns, lighting, roadside dressing, camera/HUD composition and visible driving effects. Camera direction suggestions were checked against actual image dimensions rather than applied blindly.

The public reference video was recovered after the usage-limit interruption and reboot. Its checksum is `03ee95633a224394f1afdc1c11973494d6373edbef2bf4590d761525a5bd57a2`, 40,501,679 bytes, 1920×1080, approximately 28.63 seconds. [Provenance](evidence/kyogre-street/reference-provenance.json) records the source. Video and full-resolution 0/4/8/12/16/20/24/28-second frames are ignored under `artifacts/reference-street-heat/`; none are runtime assets. A mistaken repeated-frame contact sheet was corrected against the individual decoded frames.

## Integrated work in progress

- UV-safe broadleaf RGB padding from the earlier validation remains in place.
- Canyon now uses two CC0 Namaqualand cliff scans, approximately 6,000 source triangles each, closed with textured derived shells and bounded spatial placement. The first opaque filler failed visual inspection and was replaced; exposed closure strips and incomplete enclosure still require refinement. Actual GLB geometry, closed boundaries, whole-route clearance and two ownership cycles have a CPU test.
- Canyon road dressing includes continuous red/white curbs, black bollards, emissive lamp lenses with bounded camera-facing halos, green overhead signs and speed-check pavement stencils. There are no additional dynamic lamps.
- Chase framing moves the car farther away, about 21–23 m horizontally, matching its approximate reference screen size. Corner instruments replace the large central HUD. Actual time-trial mode hides race position and keeps its label in sync.
- The player coupe uses graphite paint, red brake lamps, exhaust-anchored nitro and a bounded dry-smoke pool. A second smoke pass addresses isolated white puffs with overlapping, aged sub-frame emissions and softer irregular density. Boost streaks use four extra beauty samples in the existing composite, with central-road protection and no additional pass.
- Canyon-only conifer derivatives rigidly reposition intact needle sprays lower on the trunk while retaining UVs and individual spray topology. Grove placement favors fuller variants near the road and removes much deep forest behind cliffs. Pinecrest and City placement remain unchanged by that proposal.
- Tree bounds follow occupied LOD instances; bins are now 80/80/320/480 m by detail level. Original conifers have a fourth 2,400-triangle full-geometry level beyond roughly 520 m in Balanced, with hysteresis. All six conifer variants were inspected around every angle; broadleaf reduction produced spikes and was rejected, retaining its three existing levels. Static batch local matrices no longer recompute every frame. Pure-soil terrain fragments skip unused rock texture sampling, using explicit gradients outside the branch. GPU visual equivalence of that optimization remains to be checked.
- The latest runtime evidence includes the fourth conifer LOD and cached subtree matrix transforms. Two granite scans use textured closed shells with wider bounded placement, but enclosure and placement remain imperfect. The unfinished Mantissa conversion and new sandstone proposal are not integrated; candidate assets remain ignored artifacts for a later session.

## Evidence and limitations

`reference-check.mjs` captures frozen authored poses through the real renderer, with product menu selection so HUD options agree with engine state. It resets counters for each pose; older frozen counters could accumulate and must not be presented as per-frame submissions. These poses do not establish driving behavior or FPS.

`driving-capture.mjs` records an actual race with opponents, pilot steering and keyboard drift/boost. Round 05 passed actual slip/boost assertions and seven screenshots without browser errors, including the lower conifer/grove, procedural rock refinement, continuous smoke and speed streaks. Recording affected pacing; its HUD frame rates are not a benchmark. It predates scanned cliffs and the fourth conifer detail level. The capture's exact telemetry timestamps accompany images; screenshots can finish after their preceding telemetry sample.

`gpu-budget-check.mjs` performs frozen alternating ablations without recording at 1821×1138 internal pixels. Round 03 uses the first cliff/conifer pass, before later grove/rock/terrain changes. Radeon 780M / ANGLE / dedicated HeadlessChrome hardware was verified. Canyon baseline median GPU time was 38.37 ms, wet Pinecrest 46.63 ms. Removing trees as a diagnostic reduced those to 21.53/16.79 ms; direct presentation measured 30.49/36.14 ms. Removing features is not an accepted visual optimization. [Full report](evidence/kyogre-street/gpu-budget-round-03.json) includes timing samples, CPU submission, framebuffer, scene statistics and per-category submissions. Shared machine load was not isolated; these are neither full-race FPS nor visible display pacing.

Typecheck, lint, 41 tests and a production build passed before the usage limit; the final production keyboard/UI, emulated touch and nine-world render/resource checks also passed after resumption. Round-10 wet Pinecrest and frozen GPU budget reports passed with zero errors, but the race remains shared-PC headless evidence and its lower-percentile FPS remains below target. Physical controller/touch/Safari and human handling feedback remain outside current evidence.

The user explicitly authorized suitable free models/textures/packs. Scans now have tracked source and license records in `assets/canyon-scans.*`, zero Khronos validator errors/warnings, and byte-identical reproduction with the portable scripts. Fir Sapling Medium was evaluated and rejected: its authored full-resolution lower crown is still sparse, so the problem is not simplification. Rejected assets and previews remain ignored under `artifacts/assets/fir-sapling/`, never runtime files.

## Next acceptance work

1. Inspect the latest rock/grove/smoke/boost renders and preserve specific differences from the reference.
2. Reduce expensive distant forest geometry/draw submission without losing 3D crown volume; benchmark the affected production routes again.
3. Run four independent Luna reviews of the same current evidence, keeping honest objections and each verdict. Do not seek an approval by hiding known limitations or selectively repeating an unchanged review.
4. Complete production controls/touch/resource/full-race checks, update this context and only then release validated source to the existing private Site. No release has been made from this work in progress.

Final checkpoint: committed to the personal GitHub repository, not deployed. Production is retained on port 8788; the dedicated browser is stopped. The user requested low usage and a wrap-up, so unfinished Mantissa/sandstone work is preserved for continuation rather than expanded into another iteration. Video parity remains unaccepted.
