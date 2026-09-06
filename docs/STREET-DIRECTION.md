# Street-racing direction

Updated 2026-09-06. The user explicitly changed direction from F1 to street racing after sharing [Higgsfield's Street Heat clip](https://x.com/higgsfield_ai/status/2095916820431827408). The original Formula build remains in Git history; the current product is **Astra Street**.

The 28.6-second clip was downloaded from the post's public video metadata and sampled at four-second intervals. Reference-only files are ignored under `artifacts/reference-street-heat/`; none are game assets. Observed targets: dense layered canyon walls, conifers, warm directional light, visible tire effects, an offset drifting car in a more distant chase view, and a small arcade score HUD. The post's model/capability marketing claims are not independently verified.

The current pass introduces an original Astra S9 coupe, Canyon Run / Pinecrest / Harbor City route identities, generated rock and conifer maps, original instanced cliffs, drift smoke/skid marks, nitro exhaust, handbrake slip, bankable drift chains, near-miss bonuses and speed checks. It preserves the three layouts, AI races, unlimited time trial, frame/pixel caps, pause behavior and modular resource ownership.

This is a first playable interpretation. Cliff profiles, car body detail, foliage depth, roadside composition and the flat track geometry remain simpler than the reference. It is not a reconstruction of the video's source code or a claim of visual parity. Human handling feedback and real-device coverage remain necessary.

## Asset generation

Built-in OpenAI image generation was used, one request per asset and no retries. Outputs were copied unchanged into the repository. The owner inspected both images before integration. The conifer PNG has real alpha with soft fringes; the material uses alpha test 0.45. Mathematical edge continuity of the requested seamless rock map has not been established.

### Rock

`public/assets/textures/cliff-rock.png` — 1254×1254 RGB.

Exact prompt:

```text
Use case: photorealistic-natural
Asset type: original seamless runtime rock BASE COLOR texture for repeating on tall 3D canyon cliff columns in a browser racing game.
Primary request: Create a square 1024x1024 seamless tileable rock base-color texture. Warm muted sandstone and limestone, buff ochre and tan stone with pale exposed fractured rock, fine dark stratified fissures and mineral streaks. Photorealistic game texture, flattened diffuse albedo, moderate contrast, evenly distributed detail without a large singular feature.
Composition: orthographic flat rock surface filling the entire canvas; seamlessly tileable on all four sides.
Lighting: completely uniform neutral ambient illumination. NO baked sunlight or cast shadows or directional shading.
Constraints: Original asset. No objects, sky, plants, ground plane, text, labels, logo or watermark. No perspective. No edge border. The entire square is opaque rock color.
```

### Conifers

`public/assets/textures/conifers.png` — 1536×1024 RGBA.

Exact prompt:

```text
Use case: photorealistic-natural
Asset type: original runtime transparent conifer tree atlas for game vegetation billboards.
Primary request: Create a landscape 1536x1024 PNG with EXACTLY TWO full tall mature evergreen pine/spruce trees side by side, one per equal left and right cell. Both trunks end at a common bottom baseline. Entire trees isolated on a TRUE transparent alpha background.
Composition: tree tips and all branches completely unclipped, transparent margins around every tree, a clear transparent center gap, tree height nearly full canvas. Two distinct irregular silhouettes, natural mature pine proportions, dense layered needles, visible brown trunk. Detailed believable game vegetation suitable for a richly forested canyon racing environment.
Color: deep green needles with gently varied olive tips and natural brown bark.
Lighting: soft even diffuse light, no strong baked sun or directional shadow.
Constraints: TRUE transparency preserved in PNG alpha; no solid background, no painted checkerboard, no ground, no cast shadow, no sky, no extra trees, no snow, no text, no labels, no logos or watermark.
```

### Coupe

`public/assets/models/astra-s9.glb` is an original Blender mesh authored by `scripts/build_street_car.py`; no third-party mesh or input image was used. Approximately 15,210 triangles, with four independently animated wheels, a shared body and tintable livery. Geometry is immutable across car instances. The generator writes editable and binary outputs to ignored `artifacts/street-car/`.
