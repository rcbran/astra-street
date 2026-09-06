# Landscape frame comparison

The user asked for a substantial graphics/landscape increase and comparison with the [Street Heat reference](https://x.com/higgsfield_ai/status/2095916820431827408). We inspected the supplied clip at four-second intervals and its full-resolution 8-second frame. Reference files remain ignored in `artifacts/reference-street-heat/`; no frame is a runtime asset.

The comparison focuses on chase-view composition, not exact pixels: the reference has a different car, route and camera. The first-release and current Astra Street images are both from roughly eight seconds into Canyon Run at the same 1440×900 CSS viewport and DPR 2, with an 1821×1138 internal drawing buffer. Capture timestamps and positions are in `evidence/landscape-mac.json`.

| First release                                      | Landscape pass                                          |
| -------------------------------------------------- | ------------------------------------------------------- |
| ![First street release](evidence/street-chase.png) | ![Dense canyon landscape](evidence/landscape-chase.png) |

| Reference observation                                      | Implemented response                                                                                 | Remaining difference                                     |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Rock walls fill the upper view with many overlapping faces | Six fractured profiles, connected buttresses, attached ribs, talus and a higher mountain range       | Repeated profiles and simpler fine fracture detail       |
| Forest appears in dense near/middle/far layers             | Solid roadside conifers, dense distant atlas trees, spatial batches and undergrowth                  | Stylized near branches and crossed cards in the distance |
| The ground has relief and roadside detail                  | A shared terrain height field shapes hills and grounds trees/rocks; grass clumps cover the shoulders | The racing surface remains flat                          |
| Asphalt shows patching and cracks                          | Original seeded wear overlay with small cracks and mottling                                          | Material variety remains more limited                    |

The local `artifacts/landscape-comparison.html` displays reference / first release / current frames together. `artifacts/control-video/` contains the recorded production keyboard check. These captures use a separate headless Chrome profile after the user requested testing off their screen; WebGL reports ANGLE/Metal on the M4 Max. Headless timing is separate from visible-window display pacing. No new image generation or external runtime asset was required.
