# Astra Formula environment asset handoff

Recommended runtime bundle: 7,027,561 bytes (7.03 MB / 6.70 MiB), five files in this folder. Do not copy research/ into the game build. Exact download provenance, author, CC0 terms and SHA256 hashes are in provenance.json.

- sparse_grass_diff_1k.jpg: 1024x1024, sRGB base color. Natural sparse grassy soil, approximately 2m scan width. Tile rather than stretching; normal scale approximately 0.25–0.5 is a sensible starting point.
- sparse_grass_nor_gl_1k.jpg: 1024x1024, OpenGL tangent-space normal. Linear/non-color texture.
- sparse_grass_rough_1k.jpg: 1024x1024 scalar roughness. Linear/non-color texture; material metalness 0.
- sundowner_overlook_1k.hdr: 1024x512 RGBE environment. Clear coastal late-afternoon low sun; blue sky and ocean with warm grassy coastal hill. Good for PMREM environment lighting/reflections; the horizon includes a small cafe, so a procedural sky background is more controllable. Decode via RGBELoader, use equirectangular reflection mapping, generate PMREM once, then dispose HDR texture. HDR preview in research/ was only a basic inspection conversion, not calibrated tonemapping.
- broadleaf_atlas.png: generated original summer broadleaf tree cutout, 1774x887 RGBA, genuine alpha verified (633,041 completely transparent pixels; foliage mostly alpha 249–252). Use alphaTest around 0.4–0.5, transparent false, depthWrite true, sRGB color, DoubleSide and mipmaps. Two instanced crossed quads per tree or camera-facing billboards. Avoid too many overlapping cards. No generated ground or shadows.

Atlas framing: generation did not evenly split trees at u=0.5. Center empty area at alpha>128 is x=913..977. Left tree UV rectangle x=0..942 (u=0..0.531), right tree x=946..1774 (u=0.533..1); use full y=0..887. Match plane aspect ratio to each UV rectangle (left ~1.062, right ~0.934). Trunks reach lower image edge; the right crown reaches the top edge, so clamp sampling and do not repeat the atlas. Tiny alpha fringe can be discarded at alphaTest 0.45.

All downloaded Poly Haven files matched API MD5 checksums. Diffuse, normal, roughness and converted HDR preview were visually inspected. Atlas was visually inspected and alpha distribution measured using ffmpeg raw RGBA decode. Main integrator still needs to check the appearance under game lighting and measure overdraw/frame pacing.

## Unused research asset
research/tree_collection_1k.png is a photographic CC0 conifer atlas by rubberduck, 3157x1024, 3,819,864 bytes. Source https://opengameart.org/content/high-res-tree-textures-treecollection1kpng ; direct download https://opengameart.org/sites/default/files/oga-textures/82657/tree_collection_1k.png ; CC0 license linked by source https://creativecommons.org/publicdomain/zero/1.0/ . The atlas has dark winter coloring and snow on multiple trees, so it is excluded from the recommended summer circuit bundle. Original broadleaf generation was used because this photographic option did not fit the summer art direction.
