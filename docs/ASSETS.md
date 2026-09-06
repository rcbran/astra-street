# Asset provenance

All gameplay assets are served locally from `public/assets/`. The complete file sizes and SHA-256 hashes are recorded in [environment-provenance.json](environment-provenance.json). No Poly Haven API request, key or account is needed during gameplay.

| Asset                                                             | Runtime files                    | Source and terms                                                                                            |
| ----------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Astra S9 coupe                                                    | `models/astra-s9.glb`            | Original project mesh; `scripts/build_street_car.py`                                                        |
| Fir Tree 01: three variants                                       | `models/trees/fir_tree_01.glb`   | [Poly Haven](https://polyhaven.com/a/fir_tree_01), Rico Cilliers / Rob Tuytel; CC0                          |
| Pine Tree 01: three variants                                      | `models/trees/pine_tree_01.glb`  | [Poly Haven](https://polyhaven.com/a/pine_tree_01), Rico Cilliers / Rob Tuytel; CC0                         |
| Tree Small 02: broadleaf accent                                   | `models/trees/tree_small_02.glb` | [Poly Haven](https://polyhaven.com/a/tree_small_02), Rico Cilliers; CC0                                     |
| Cliff Side: sandstone diffuse / normal / roughness                | `textures/cliff_side-*`          | [Poly Haven](https://polyhaven.com/a/cliff_side), James Ray Cock / Dario Barresi / Jenelle van Heerden; CC0 |
| Rock Wall 02: natural gray/moss rock diffuse / normal / roughness | `textures/rock_wall_02-*`        | [Poly Haven](https://polyhaven.com/a/rock_wall_02), Rob Tuytel; CC0                                         |
| Asphalt Track: diffuse / normal / roughness                       | `textures/asphalt_track_*`       | [Poly Haven](https://polyhaven.com/a/asphalt_track), Dimitrios Savva; CC0                                   |
| Forest Ground 01: moss / litter / normal / roughness              | `textures/forrest_ground_01-*`   | [Poly Haven](https://polyhaven.com/a/forrest_ground_01), Rob Tuytel; CC0                                    |
| Sparse Grass: diffuse / normal / roughness                        | `textures/sparse_grass_*`        | [Poly Haven](https://polyhaven.com/a/sparse_grass), Amal Kumar; CC0                                         |
| Sundowner Overlook lighting                                       | `textures/environment.hdr`       | [Poly Haven](https://polyhaven.com/a/sundowner_overlook), Dario Barresi; CC0                                |
| Historical AF-27                                                  | `models/astra-formula.glb`       | Original project mesh, retained but not loaded; `scripts/build_car.py`                                      |

Poly Haven's [asset license](https://polyhaven.com/license) is [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). Keep the bundled [asset notices](../public/assets/NOTICE.txt) with redistributed assets. The repository-wide source license and public GitHub visibility are separate, undecided choices.

Two CC0 Namaqualand cliff meshes are also integrated for Canyon Run; their placement is still under visual review. Source authors, original texture checksums and derived geometry are recorded in [canyon scan notes](assets/canyon-scans.md).

## Tree preparation and visual limits

The seven source tree variants each have three authored levels of real branch and distributed foliage geometry. Runtime adds a fourth level to the six conifers; the broadleaf retains three. Canyon also adds three four-level low-crown fir derivatives. The source GLBs remain three-level files. None uses a whole-tree image or crossed whole-tree cards. Individual needle sprays and leaves use alpha-tested surfaces at many positions and orientations inside the crown, a normal real-time foliage technique; they are not individual modeled needles. The tree family GLBs share embedded textures across variants and levels. Full processing/provenance is in [tree asset notes](assets/trees.md), with authoring tools in `scripts/assets/trees/`.

The source fir UV data required conversion before export. Incorrect source mask colors were removed. Near wood budgets were increased after simplification produced triangular fins. Far foliage now keeps complete source components rather than collapsing leaf shapes. Pine/broadleaf transparent-edge RGB is extended from opaque foliage to reduce white mipmap fringes, while every alpha value and opaque color is preserved. Runtime uses explicit cutouts with hardware MSAA; alpha-to-coverage was rejected after it thinned and brightened needle sprays.

The broadleaf white/cyan mipmap defect is corrected with UV-aware RGB padding that preserves alpha and all mapped colors. See `BROADLEAF-DIAGNOSTIC.md` for the current checks and remaining LOD limits.

Far variants remain less detailed and broadleaf coverage is lower than near coverage. They are used only at distance; exact LOD thresholds vary with quality. Native broadleaf height is approximately 4.7 m, so its world placement stays roughly 5–11 m. Conifers are generally 13–28 m, with smaller sapling accents. The broadleaf is a visual accent for fictional places, not a claim about native species.

## Landscape and original graphics

[Forest-floor notes](assets/ground.md) and [rock material notes](assets/rocks.md) document 2K diffuse and 1K OpenGL normal/roughness processing. Ground projection blends three texture directions over steep slopes instead of stretching grass across vertical rock. Procedural terrain, eroded cliff variants, boulders, curved grass, fern leaflets, branched shrubs, guardrails, signs and road-wear graphics are original repository code. Shader wind and leaf transmission are original runtime additions.

The old generated `trees.png`, `conifers.png` and `cliff-rock.png` were replaced and removed from shipping assets. Their original prompts and historical integration remain in `STREET-DIRECTION.md` and Git history. The current foliage overhaul did not use new image generation.

## Research references

The user's [Street Heat video](https://x.com/higgsfield_ai/status/2095916820431827408) is a visual reference only. The video and extracted frames remain ignored under `artifacts/reference-street-heat/`; they never ship as runtime assets. Historical F1 screenshots under `docs/references/` are also ignored research, with prior references in `STREET-DIRECTION.md` and `environment-assets.md`. Do not redistribute research screenshots as game art or claim this implementation matches the reference's source, car or rendering fidelity.
