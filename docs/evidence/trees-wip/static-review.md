# Final static vegetation review

The tracked fresh-clone fixtures completed successfully on 2026-09-06 using headless Chrome and ANGLE Metal on Apple M4 Max. Tree inspection captured 434 frames across seven variants and three LODs; undergrowth inspection captured 90 frames across grass, fern and shrub. Both reports contain zero page/console errors. Recorded SHA256 and byte sizes were independently checked against every current runtime GLB after the runs.

Inspected horizontal, low-angle, elevated and weather contact sheets retain a three-dimensional crown across views. The earlier disappearing far pine is resolved. The final alpha-to-coverage setting gives fuller needle clusters, while source edge-color correction removes contaminated white RGB without changing alpha shape.

Remaining limitations:

- Far LOD foliage remains simpler. Average projected crown coverage relative to the near model is 101–121% for fir variants, 72–88% for pines and 57% for broadleaf. The measurement is descriptive, not a visual-equivalence score. Density changes can still be visible at LOD transitions.
- Retained distant leaf/twig components are enlarged to preserve coverage, so they look coarse if inspected at close range. Their intended use is small onscreen.
- Thin individual foliage surfaces and unlit leaf backs remain visible in close-up inspection, but the complete tree no longer becomes an edge-on plane.
- Grass, fern and shrub geometry is intentionally angular at close range and best used as small forest-floor dressing.
- Controlled gallery lighting has no environment HDR and can show dark backlit crowns. These static captures verify shapes/material behavior, not the complete scene lighting, frame pacing, thermal behavior or human driving feel.

See `report.json`, `index.html`, and the `*-sheet.png` contact sheets here. Groundcover evidence is in `../undergrowth-angle-release/`.
