# Remaining broadleaf white/cyan crown issue

Checkpoint diagnosis, 2026-09-06. No runtime/source/asset edits were made by this worker. Both diagnostic scripts finished successfully and their `finally` blocks closed their owned browser contexts; no worker contexts or running GPU tasks remain.

## Reproduction and evidence

Run the development server on port 3000 and the dedicated headless Chrome launcher on CDP 9224. Select Pinecrest, start GO RACING, enable `debugDrive(true)` every 25 ms and capture approximately 5 s after racing starts. White/cyan broadleaf crowns appear at the far left and on the right roadside around screen x1020/1220,y340 in a 1440×900 frame. Parent reference: `artifacts/trees-world-fifth/forest-5s.png`.

Preserved diagnostic scripts, run from repository root with the development server and dedicated headless CDP launcher already running:

- `docs/evidence/trees-wip/diagnostics/white-broadleaf.mjs`: freezes the actual world after capture, dumps materials and compares no environment, no transmission shader, no normal map, constant color, MeshBasicMaterial diffuse-only, and no vertex color.
- `docs/evidence/trees-wip/diagnostics/white-texture.mjs`: repeats with known prepared diffuse PNG, identity texture transform, no fog, no mipmaps/nearest filtering, and diffuse-only/no-fog.

Both scripts own a fresh headless context, clear the pilot, cancel the engine animation for frozen A/B renders, and close the context in `finally`. They import Three through the local Vite development pipeline. The texture test reads the adjacent committed `known-leaf-source.png`, copied unchanged from the corrected authoring PNG. Its file path was made portable during handoff; the diagnostic itself was not rerun after that path-only change. These are investigation scripts, not production regression tests; the A/B modes call the raw renderer directly. The scripts write ignored `artifacts/` output and close their own contexts.

Evidence folders:

- `artifacts/broadleaf-white-diagnosis/`: baseline and first A/B frames, `details.json`, empty `errors.json`.
- `artifacts/broadleaf-texture-diagnosis/`: baseline and texture A/B frames, runtime diffuse-map dump, `details.json`, empty `errors.json`.
- Most useful compact pair: `broadleaf-texture-diagnosis/baseline.png` versus `noMipmaps.png`.

Selected baseline, nearest/no-mipmap frame, runtime leaf map and texture details are committed in `docs/evidence/trees-wip/`; full intermediate captures remain ignored and can be regenerated with these scripts.

## Established findings

1. Actual-world crowns remain pale with MeshBasicMaterial using only the diffuse map. Removing the custom foliage shader, normal map, vertex colors, or fog does not resolve them. Disabling environment light darkens them but retains the cyan appearance.
2. The material uses the expected leaf diffuse image, SRGB, channel 0, flipY false, identity UV transform, repeat 1/1, offset 0/0, 1024×1024 image. All broadleaf LODs share the intended leaf material. Substituting the known prepared diffuse PNG does not fix the issue.
3. **Changing the broadleaf diffuse texture to NearestFilter for min/mag and disabling mipmaps makes the white crowns green in the exact frozen world.** Thus the issue is concretely sensitive to mip/filter sampling, not just a generic lighting or tint problem. This experiment changes mip usage and filtering together; they have not yet been isolated individually.
4. The runtime leaf atlas visibly contains white unused regions outside the green leaf islands. Pixel audit found **57,633 fully opaque pixels with every RGB channel>235** in both the runtime canvas dump and prepared authoring PNG. Prior RGB dilation preserved opaque pixels by design, so those white regions remained. The prepared PNG has 295,108 near-white pixels total, many transparent; its runtime canvas dump has 64,730 because canvas serialization zeroes fully transparent RGB. Do not mistake that canvas conversion for a GLB mutation.

## Current hypothesis and next step

Mip filtering likely draws opaque white/transparent-white atlas regions into small projected leaf islands. This is a strong hypothesis supported by the filtering A/B and atlas audit, but the precise contribution of unused opaque regions versus mip generation/premultiplication remains unproven.

Next, isolate `LinearFilter` without mipmaps from nearest filtering, then test a corrected atlas candidate outside checkout. Inspect the source alpha/UV islands before modifying it: mask/pad only verified unused white atlas regions, preserve legitimate leaf colors, and use alpha-aware mip filtering or proper edge padding. Compare the candidate in the same frozen world at multiple distances and all three LODs. Avoid treating permanent nearest filtering or an arbitrary dark-green tint as the final fix. Repeat all-angle QA only after an actual asset/material change.

No new filtering or atlas fix has been integrated. Existing final static gallery checks passed but use controlled lighting and large specimens; they do not expose this small-projection world issue.
