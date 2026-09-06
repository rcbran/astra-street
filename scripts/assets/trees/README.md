# Reproduce the tree bundle

Requires Blender 5.2, Python with Pillow, NumPy and SciPy, and Node.js. Khronos `gltf-validator` is optional. Authoring scripts currently use the absolute root `/tmp/astra-tree-assets`; update that root consistently in every script when using another location. Downloads are needed only for offline authoring. The game makes no Poly Haven API requests.

From the repository root, copy the scripts and committed source manifests:

```sh
mkdir -p /tmp/astra-tree-assets
cp scripts/assets/trees/* /tmp/astra-tree-assets/
```

1. Run `python3 /tmp/astra-tree-assets/download.py`. It reads `fir_tree_01-files.json`, `pine-files.json` and `tree_small_02-files.json` from the authoring root and downloads their original Blender files and 1K texture maps.
2. Run `python3 /tmp/astra-tree-assets/prepare_textures.py`. It creates opaque RGB JPEG maps and RGBA foliage PNGs under `prepared-textures/`. Pine/broadleaf partial-alpha RGB is filled from the nearest fully opaque pixel; every alpha byte and fully opaque foliage RGB byte is preserved.
3. Export each family:

```sh
blender -b -t 4 --python /tmp/astra-tree-assets/export_trees.py -- fir_tree_01
blender -b -t 4 --python /tmp/astra-tree-assets/export_trees.py -- pine_tree_01
blender -b -t 4 --python /tmp/astra-tree-assets/export_trees.py -- tree_small_02
```

4. Run `python3 /tmp/astra-tree-assets/finalize_glb.py` to set explicit foliage alpha masks and normalize texture-coordinate selections.
5. Optionally install `gltf-validator` under `/tmp/astra-tree-assets/validator/node_modules/`, then run `node /tmp/astra-tree-assets/validate.cjs`.
6. Optional CPU studio review: `blender -b -t 4 --python /tmp/astra-tree-assets/render_preview.py -- pine_tree_01 2` renders the first variant at the selected LOD from four horizontal angles.

The generated deliverables are `/tmp/astra-tree-assets/output/*.glb`; after review, the game copies them into `public/assets/models/trees/`. Companion triangle manifests and validation reports are generated in the same output folder, with reviewed copies retained in `docs/assets/`. Prepared Blender files, downloaded originals and studio PNGs remain outside the checkout.

If applying a newly corrected foliage PNG to an already exported GLB, run `python3 /tmp/astra-tree-assets/repack_foliage.py`. It replaces the embedded image buffer view without changing geometry buffers or retaining obsolete image payload. A fresh export from corrected prepared textures does not need this repair step.

The source broadleaf trunk OpenEXR normal map is omitted; branch and leaf normal maps remain. Textures otherwise preserve source content, subject to JPEG compression and the documented edge-color correction. Every tree LOD contains 3D branches and distributed foliage surfaces; no whole-tree cards are generated.

[Sources, CC0 provenance and modifications](../../../docs/assets/trees.md) are documented separately. For reproducible WebGL all-angle inspection against the runtime loader, see [the tracked gallery fixtures](../../fixtures/tree-gallery/README.md).
