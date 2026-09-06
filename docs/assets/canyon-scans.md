# Canyon scan models

The two locally served Namaqualand Cliff meshes are from Poly Haven, licensed CC0. Jenelle van Heerden photographed Cliff 01, Dario Barresi photographed Cliff 02, and Rico Cilliers modeled both. See the [asset manifest](canyon-scans.json), [Cliff 01](https://polyhaven.com/a/namaqualand_cliff_01), [Cliff 02](https://polyhaven.com/a/namaqualand_cliff_02), and [primary license](https://polyhaven.com/license). Acquired 2026-09-06.

Each source is simplified to approximately 6,000 triangles in Blender 5.2. Its original UVs and exact 2K diffuse, OpenGL normal and packed ARM JPEG bytes are retained. Geometry is centered horizontally with its lowest Y at zero; tangents are exported. These are open scanned surfaces, so runtime placement must conceal the cut boundaries. Initial placement revealed its plain backing through the photographed face. The current runtime derives a closed textured shell and preserves the original front positions/UVs, but exposed strip texturing and enclosure still need visual refinement. A valid mesh or passing clearance check does not establish visual acceptance.

Run from the repository root, using Python 3.10+, curl and Blender 5.2:

```sh
python3 scripts/assets/canyon-scans/download.py
blender --background --threads 2 --python-exit-code 1 --python scripts/assets/canyon-scans/prepare.py
python3 scripts/assets/canyon-scans/verify.py
blender --background --threads 2 --python-exit-code 1 --python scripts/assets/canyon-scans/preview.py
```

Use `--work-dir /absolute/path` for Python scripts, or `-- --work-dir /absolute/path` after Blender arguments. Pinned source URLs, sizes and MD5 values are committed beside the scripts. Every cached source is checked; output goes into ignored `artifacts/assets/canyon-scan/output/`. Review output before copying GLBs to `public/assets/models/rocks/`. No authoring tool or external request is needed during gameplay. Reproduction byte hashes may vary with Blender versions; current runtime hashes are recorded separately.

Both current GLBs pass Khronos validation with zero errors and warnings. The portable preparation pipeline reproduces both byte for byte on the recorded Blender build; see [reproduction report](canyon-scans-reproduction.json). Runtime shells have no open edges after positional welding, but inherit source nonmanifold seams; this is not a manifold-purity claim.
