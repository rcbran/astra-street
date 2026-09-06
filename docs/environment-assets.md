# Environment implementation notes

This describes the integrated runtime bundle, superseding the initial worker handoff. Provenance and hashes are in `environment-provenance.json`; source links and notices are in `ASSETS.md` and `public/assets/NOTICE.txt`.

## Surface maps

Road and grass scans use 1024×1024 JPEGs. Diffuse maps use sRGB; normal/roughness maps use linear/non-color sampling. Normals are OpenGL convention. Textures use repeat wrapping and bounded anisotropy. Road ribbons map UVs by traveled distance; grass is tiled across the ground instead of stretched as one image. Asphalt Track is a smoother racing surface than the superseded cracked Asphalt 02 set.

`src/game/materials.ts` loads the nine surface/foliage/rock textures before world construction. The engine owns them across circuit changes. Worlds must not dispose shared textures. The HDR is loaded separately, converted once to a PMREM environment, and the source HDR texture is disposed afterward.

## Environment lighting

`textures/environment.hdr` is the 1024×512 Sundowner Overlook HDR. It provides static reflection/lighting detail. The visible sky is a procedural shader so clouds, horizon and sunlight can be adjusted for clear, sunset and wet-night conditions without shipping three large HDRs.

## Foliage atlas

`textures/trees.png` is a 1774×887 RGBA atlas. It contains two broadleaf trees with an uneven split. Alpha was inspected and is real transparency; the source is not a checkerboard-backed image.

- Left tree: pixels x=0…942, UV x=0…0.531; full height.
- Right tree: pixels x=946…1774, UV x=0.533…1; full height.
- The runtime uses both halves on crossed instanced planes, with subtle tint/size variation.
- Material: alpha test 0.45, alpha-to-coverage, double-sided, opaque rendering with discarded transparent pixels; sRGB map.
- Trunks reach the lower edge. Clamp the atlas rather than repeat it.

Tree variety and close-range appearance remain visual improvement opportunities. Reusing the second tree or adding a near/far representation should preserve the draw and overdraw budgets.

## Current scenery limitations

Terrain is generated and flat around the track. Distant hills, building facades, roadside surfaces, yachts, and vegetation variety remain comparatively simple. The coastline ground was shortened to reveal the sea plane; further coastal composition/shore detail needs review in moving gameplay. Wet night includes a low-resolution road reflection, rain lines, and pooled tire spray.

Do not introduce unsupported asset licensing or depend on temporary absolute paths when improving the scenery. Asset authoring workers, if used, must be GPT Astra and return files outside the checkout for integration by the main agent.

## Street assets

The generated 1536×1024 conifer atlas uses equal left/right cells and alpha test 0.45. The 1254×1254 rock color map is reused as a modest bump source on original eroded cliff profiles. Both maps are shared engine resources. Exact generation prompts and limitations are in `STREET-DIRECTION.md`; hashes are in the provenance manifest.
