# Astra Street rock materials

Both materials are Poly Haven CC0 assets, acquired 2026-09-06. Redistribution, modification and commercial use are allowed by the primary license: https://polyhaven.com/license and https://creativecommons.org/publicdomain/zero/1.0/ . Credits retained voluntarily.

| Runtime set    | Source                               | Authors                                                                        | Intended application                                                                      |
| -------------- | ------------------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| cliff_side-*   | https://polyhaven.com/a/cliff_side   | James Ray Cock and Dario Barresi, photography; Jenelle van Heerden, processing | Warm layered sedimentary canyon cliffs and exposed steep terrain                          |
| rock_wall_02-* | https://polyhaven.com/a/rock_wall_02 | Rob Tuytel                                                                     | Natural weathered gray/olive rock face with crevices and moss for forest hills and cliffs |

Rock Wall 02 is classified by its source as a **natural rock face**, despite the asset name; it is not masonry. Its original footprint is approximately 2 × 2 m. Triplanar scales may intentionally be larger for distant terrain readability, but avoid stretching a single texture over an entire hill.

## Files and processing

Each set contains `-diff.jpg` at 2048 × 2048 pixels, `-normal.jpg` (OpenGL convention) at 1024 × 1024 pixels, and `-roughness.jpg` grayscale at 1024 × 1024 pixels. Combined shipping size is approximately 3.77 MB. No diffuse color grading or synthetic details were applied. Downloaded original 2K JPEG maps were resized with Lanczos and re-encoded: diffuse quality88, normal quality92 with full chroma, roughness quality88 grayscale.

Set diffuse textures to sRGB; normal and roughness maps must remain linear/non-color. Normal maps use +Y/OpenGL orientation. Use repeat wrapping and anisotropic filtering. For triplanar normals, transform each sampled tangent-space normal into the appropriate projection frame before blending, then normalize. A straightforward blend of RGB normal maps is not correct across differently oriented axes.

## Reproduction

Requires Python 3.10+ and Pillow. Run `python3 scripts/assets/rocks/prepare.py`. The script reads the committed `cliff_side-files.json` and `rock_wall_02-files.json` beside itself, validates source downloads against their manifest MD5 and size, and writes only to the ignored repository directory `artifacts/assets/rocks/` by default. Use `--work-dir /absolute/path` to choose a different cache/output directory. Cached sources are verified on every run and mismatches are rejected.

Originals go into `sources/`; processed textures and `SHA256SUMS` go into `output/`. Review the generated maps before copying them into `public/assets/textures/`. Runtime assets require no API requests. Encoding bytes can vary with Pillow/libjpeg versions.
