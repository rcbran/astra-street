# Asset provenance and visual references

All runtime files are local under `public/assets/`. The full file list, byte sizes and SHA-256 hashes are in [environment-provenance.json](environment-provenance.json). The filename is retained from the initial environment handoff, but the manifest now includes the car and all runtime textures.

## Runtime assets

| Asset                                              | Runtime path                      | Source / author                                                         | Terms                                                  |
| -------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------ |
| Astra AF-27 car                                    | `models/astra-formula.glb`        | Original Blender generation for this project                            | Original project asset; no third-party mesh            |
| Asphalt Track, diffuse / OpenGL normal / roughness | `textures/asphalt_track_*_1k.jpg` | [Poly Haven](https://polyhaven.com/a/asphalt_track), Dimitrios Savva    | CC0 1.0                                                |
| Sparse Grass, diffuse / OpenGL normal / roughness  | `textures/sparse_grass_*_1k.jpg`  | [Poly Haven](https://polyhaven.com/a/sparse_grass), Amal Kumar          | CC0 1.0                                                |
| Sundowner Overlook HDR                             | `textures/environment.hdr`        | [Poly Haven](https://polyhaven.com/a/sundowner_overlook), Dario Barresi | CC0 1.0                                                |
| Broadleaf foliage atlas                            | `textures/trees.png`              | Generated for this project with OpenAI image generation                 | Original generated output; no third-party source image |

Original source also generates circuit geometry, sky, barriers, fences, grandstands, buildings, signs, contact shadows, and surface/effect textures. Fictitious sponsor text and Astra marks are part of the project. The car uses system typeface outlines for livery text; no font file is distributed. The repository's overall source license is still undecided.

The historical Formula car is the V2 asset: approximately 36,949 triangles and 1.21 MB. Its construction source is `scripts/build_car.py`. Named nodes include `wheel_FL`, `wheel_FR`, `wheel_RL`, `wheel_RR`, `driver_head`, and `Astra_AF27_body`. Y is up and +Z points toward the nose. Wheels rotate around local X; front wheels steer around local Y. `Livery` is the tintable paint material.

See [environment implementation notes](environment-assets.md) for color spaces and atlas coordinates. Keep a copy of [the runtime notices](../public/assets/NOTICE.txt) with redistributed assets.

## Research references, excluded from the game

- F1 23, wet Singapore: [OC3D performance review screenshot](https://overclock3d.net/reviews/software/f1_23_pc_performance_review_and_optimisation_guide/4/). Local reference: `docs/references/f1-23-wet-singapore.jpg`.
- F1 24, dusk cockpit: [Steam Community screenshots](https://steamcommunity.com/app/2488620/screenshots/). Local reference: `docs/references/f1-24-dusk-cockpit.jpg`.
- [EA F1 24 overview](https://www.ea.com/games/f1/news/f124-everything-you-need-to-know).

Reference images remain copyrighted by their owners. They are ignored by Git and are not included in `public/` or the deployment build. The Steam page is a collection rather than a stable single-image attribution; improve the exact reference citation before publishing a research document with that screenshot.

The visual targets are low, consistent camera placement; visible suspension and halo; detailed asphalt/paint/rubber; believable scenery scale and density; atmospheric depth; wet reflections/spray; and a restrained racing HUD. The current game is a playable base for further fidelity work, not evidence of AAA parity.

## Superseded and external working files

The first cracked Asphalt 02 maps were replaced with smoother Asphalt Track scans and removed from shipping assets. Old files remain outside the checkout in `/tmp/f1-astra-assets/unused/` on the development machine.

Original car authoring scenes/previews and raw asset handoffs are under `/tmp/f1-astra-assets/`. They are temporary conveniences, not required build inputs. The committed GLB and generator are sufficient to continue development. A CC0 conifer atlas was investigated but was not shipped because its winter/snow appearance did not fit the environment.

## Current street-racing additions

The active car is the original `models/astra-s9.glb`, approximately 15,210 triangles, generated with `scripts/build_street_car.py`. `textures/cliff-rock.png` (1254×1254 RGB) and `textures/conifers.png` (1536×1024 RGBA) are original built-in OpenAI generated assets. See `STREET-DIRECTION.md` for exact prompts, visual reference and limitations; the manifest records their sizes and hashes. The user’s linked video is research only and never shipped as an asset.
