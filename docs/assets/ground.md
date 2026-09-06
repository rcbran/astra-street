# Forest-floor material

The shipped forest-floor material is [Forest Ground 01](https://polyhaven.com/a/forrest_ground_01) by **Rob Tuytel**, acquired from Poly Haven on 2026-09-06. The source identifier intentionally uses `forrest_ground_01`. Its moss, fallen twigs, dry grass and organic litter cover an approximately 2 × 2 m surface.

The asset is **CC0 1.0 Universal**. Modification, commercial use and redistribution are permitted; credit is retained voluntarily. See [Poly Haven's license](https://polyhaven.com/license) and the [CC0 deed](https://creativecommons.org/publicdomain/zero/1.0/).

| Shipped file in `public/assets/textures/` | Resolution  | Treatment                             |
| ----------------------------------------- | ----------- | ------------------------------------- |
| `forrest_ground_01-diff.jpg`              | 2048 × 2048 | Unchanged diffuse colors, sRGB        |
| `forrest_ground_01-normal.jpg`            | 1024 × 1024 | OpenGL (+Y) normal, linear/non-color  |
| `forrest_ground_01-roughness.jpg`         | 1024 × 1024 | Grayscale roughness, linear/non-color |

The three files total 2,950,922 bytes. Original 2K JPEG maps were resized with Lanczos, then encoded at quality88 for diffuse/roughness and quality92 with full chroma for the normal map. No synthetic details or color grading were added. The game uses repeat wrapping, anisotropic filtering, a 2.8 m terrain tile and terrain color variation tuned for forest greens. Runtime loading uses local project assets and makes no calls to Poly Haven.

## Reproduction

Requires Python 3.10+ and Pillow. Source manifests are committed beside the script; downloads are checked against their MD5 and byte-size metadata before image processing. These manifest MD5 values check download integrity, not security credentials. Cached files are checked on every run; a mismatched cached file is rejected rather than silently processed.

```sh
python3 scripts/assets/ground/prepare.py
```

The default work directory is the repository's ignored `artifacts/assets/ground/`, independent of the shell's working directory. Original downloads go into `sources/`; processed maps and their `SHA256SUMS` go into `output/`. Override it with `--work-dir /absolute/path` if needed. The script reads `forrest_ground_01-files.json` relative to its own location and does not write into `public/`; review generated files before copying them into runtime assets.

The committed manifest records the exact source URLs and checksums. Image encoding bytes may vary with Pillow/libjpeg versions, so runtime checksums should be recorded when integrating a regenerated set.
