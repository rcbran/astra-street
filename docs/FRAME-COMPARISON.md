# Landscape frame comparison

The user asked for a substantial graphics/landscape increase and comparison with the [Street Heat reference](https://x.com/higgsfield_ai/status/2095916820431827408). We inspected the supplied clip at four-second intervals and its full-resolution 8-second frame. Reference files remain ignored in `artifacts/reference-street-heat/`; no frame is a runtime asset.

## Tree overhaul checkpoint — unfinished

The latest migration checkpoint replaces whole-tree cards with seven 3D tree variants and all-3D LODs, adds scanned rock and forest-floor surfaces, broad terraced cliffs, lower layered mountains and detailed steel roadside furniture. These early development frames show the current source; they are not final release acceptance and are not camera/position-matched to the historical benchmark frames below.

| Pinecrest checkpoint                                              | Canyon checkpoint                                                 |
| ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| ![Forest work in progress](evidence/trees-wip/forest-driving.png) | ![Canyon work in progress](evidence/trees-wip/canyon-driving.png) |

Near/mid/far crown volume passed controlled all-angle inspection. Some in-world broadleaf crowns still become white/cyan at driving distance because of a mipmap/filtering-sensitive atlas defect; see `HANDOFF.md` and `evidence/trees-wip/broadleaf-bleed-baseline.png`. Ground/cliff composition and the contact-shading trial still require final motion/weather review. The car/city remain simple and the racing surface is flat. No reference parity is claimed.

## Historical version2 comparison

The historical version2 comparison below focuses on chase-view composition, not exact pixels: the reference has a different car, route and camera. The first-release and version2 Astra Street images are both from roughly eight seconds into Canyon Run at the same 1440×900 CSS viewport and DPR 2, with an 1821×1138 internal drawing buffer. Capture timestamps and positions are in `evidence/landscape-mac.json`.

| First release                                      | Landscape pass                                          |
| -------------------------------------------------- | ------------------------------------------------------- |
| ![First street release](evidence/street-chase.png) | ![Dense canyon landscape](evidence/landscape-chase.png) |

| Reference observation                                      | Implemented response                                                                                 | Remaining difference                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Rock walls fill the upper view with many overlapping faces | Six fractured profiles, connected buttresses, attached ribs, talus and a higher mountain range       | Repeated profiles and simpler fine fracture detail       |
| Forest appears in dense near/middle/far layers             | Solid roadside conifers, dense distant atlas trees, spatial batches and undergrowth                  | Stylized near branches and crossed cards in the distance |
| The ground has relief and roadside detail                  | A shared terrain height field shapes hills and grounds trees/rocks; grass clumps cover the shoulders | The racing surface remains flat                          |
| Asphalt shows patching and cracks                          | Original seeded wear overlay with small cracks and mottling                                          | Material variety remains more limited                    |

The historical local `artifacts/landscape-comparison.html` displays reference / first release / version2 frames together. `artifacts/control-video/` contains the recorded production keyboard check. These captures use a separate headless Chrome profile after the user requested testing off their screen; WebGL reports ANGLE/Metal on the M4 Max. Headless timing is separate from visible-window display pacing. No new image generation or external runtime asset was required for that older landscape pass.
