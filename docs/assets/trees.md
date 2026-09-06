# Astra Street tree assets — 2026-09-06

All three model families and their textures are Poly Haven assets under **CC0 1.0 Universal**. Redistribution, modification, commercial use and source-repository inclusion are permitted without attribution requirements. Credit is retained here voluntarily. Primary license: https://polyhaven.com/license ; deed: https://creativecommons.org/publicdomain/zero/1.0/

| Runtime GLB       | Original asset                        | Creators                                           | Original native tree heights     |
| ----------------- | ------------------------------------- | -------------------------------------------------- | -------------------------------- |
| fir_tree_01.glb   | https://polyhaven.com/a/fir_tree_01   | Rico Cilliers (modeling), Rob Tuytel (photography) | approximately 19.0, 14.1, 14.6 m |
| pine_tree_01.glb  | https://polyhaven.com/a/pine_tree_01  | Rico Cilliers (modeling), Rob Tuytel (photography) | approximately 20.4, 14.9, 17.6 m |
| tree_small_02.glb | https://polyhaven.com/a/tree_small_02 | Rico Cilliers                                      | approximately 4.6 m              |

The broadleaf source is tagged Burkea africana / wild syringa by its creator; it is a visual broadleaf understory accent, not a botanically accurate native species claim for the fictional environments.

Source acquired from each asset's Poly Haven API file manifest on 2026-09-06. The committed manifests and authoring scripts are in `scripts/assets/trees/`; original Blender files and downloads are outside the repository under `/tmp/astra-tree-assets`. Generated GLBs are reviewed in `/tmp/astra-tree-assets/output/` before copying to `public/assets/models/trees/`. The API is used only during offline authoring; runtime makes no Poly Haven API calls. See [reproduction instructions](../../scripts/assets/trees/README.md).

## Modifications

- Started from authored conifer LOD2 / broadleaf LOD1 full 3D branch and individual foliage geometry.
- Repaired fir's legacy UVMap FLOAT_VECTOR corner attribute into an actual UV layer before export. Removed source procedural mask color attributes, which are not vertex albedo.
- Separated wood, trunk, individual foliage and dead branches for different reduction budgets.
- Reduced wood geometry with Blender 5.2 collapse simplification. Foliage is never collapse-decimated: all levels sample complete original leaf/twig components throughout the 3D crown, enlarging retained components up to 3.8× to preserve coverage. This avoids collapse-generated leaf slivers and disappearing distant pine crowns. No whole-tree billboards or crossed tree photographs.
- Increased bark/branch budgets after all-angle review found collapse-generated triangular fins, including a 2,700-triangle far broadleaf wood floor. Rejected anomalously broad branch faces.
- Kept native dimensions; shifted each variant's trunk origin to the ground and exported standard glTF Y-up.
- Rebuilt standard glTF PBR materials, using 1,024 px bark/leaf diffuse and normal maps. Foliage diffuse and separate alpha combined into RGBA PNG; opaque maps JPEG compressed. Textures shared among the family's variants and LOD levels.
- Corrected white RGB contamination in pine/broadleaf transparent and partial-alpha texels. SciPy Euclidean nearest-neighbor fill copies RGB from the nearest alpha255 source texel into alpha<255 texels. All alpha and fully opaque colors remain byte-identical; fir was unchanged. Final image repacking preserves every geometry/UV/normal buffer byte and removes superseded image payload.
- Exported foliage materials use double-sided alpha MASK cutoff 0.38 and roughness 0.94, with normal-map strengths 0.55 foliage / 0.75 bark. The runtime loader further sets foliage normal scale to 0.45 and disables alpha-to-coverage after controlled WebGL review found excessively thin, speckled needle coverage. Hardware canvas antialiasing remains enabled. Source procedural material effects were not carried into runtime.

## Integration

Each GLB contains separate root groups, e.g. fir_a_LOD0, fir_a_LOD1, fir_a_LOD2, fir_b_LOD0, etc. Only show one level of each placed tree. Mesh children are in the same local coordinates under identity transforms; glTF roots apply the Z-up to Y-up conversion. Preserve root transforms when flattening/merging geometry. Names: fir_a/b/c; pine_a/b/c; broadleaf_a. Companion JSON manifests include per-part triangle counts and source Z-up bounds.

Use spatial instancing / culling. Foliage is made of individual shaped branch/leaf surfaces distributed in 3D: these are not whole-tree images. Far trees are intentionally coarser and should only be used when small onscreen. Near levels retain detailed branches, natural asymmetry and crown gaps. All meshes/materials/textures in a GLB are immutable shared resources; per-world instances should not dispose asset-library resources.

Khronos glTF validator found zero errors. Tangent-space warnings are expected: normal mapping uses Three.js derivative-generated tangent frames to avoid tangent-attribute payload. Per-asset `*-validation.json` reports and triangle manifests are retained beside this document.

Four-angle offline studio renders are authoring evidence under `/tmp/astra-tree-assets/output/`, not committed runtime assets. The [tracked static gallery fixtures](../../scripts/fixtures/tree-gallery/README.md) reproduce WebGL all-angle checks from a fresh clone; captures and reports go to the selected ignored `artifacts/` output directory. Static shape/material checks do not establish frame pacing or thermal behavior; full-race headless measurements are recorded separately.

## Final exported triangle counts

- broadleaf_a: 54399, 14197, 8697 triangles (near / mid / far).
- fir_a: 47052, 12786, 4540 triangles (near / mid / far).
- fir_b: 29307, 12794, 4533 triangles (near / mid / far).
- fir_c: 16364, 8308, 4537 triangles (near / mid / far).
- pine_a: 55297, 12726, 7330 triangles (near / mid / far).
- pine_b: 55296, 12772, 7333 triangles (near / mid / far).
- pine_c: 55299, 12747, 7331 triangles (near / mid / far).
