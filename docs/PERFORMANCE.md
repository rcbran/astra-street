# Performance evidence

Measured on 2026-09-05 in production-build gameplay on an Apple M4 Max MacBook Pro: 14 CPU cores, 32 GPU cores, 36 GB RAM. Chrome 152.0.7977.76 used ANGLE's Metal renderer. Other GPU work was permitted on the same laptop.

## Full race measurements

Balanced settings, 1440×900 CSS viewport, device pixel ratio reported as 2, **measured drawing buffer 1440×900**. Framebuffer size is the authoritative render workload; do not describe this as native Retina or a full 1080p benchmark.

| Circuit / weather    | Observed run | Median FPS | Tenth-percentile FPS | Ending rolling GPU p95 | Highest per-second CPU-submit p95 |
| -------------------- | -----------: | ---------: | -------------------: | ---------------------: | --------------------------------: |
| Riviera / sunset     |      115.0 s |       60.0 |                59.95 |                1.75 ms |                            1.8 ms |
| Black Forest / clear |      137.2 s |       60.0 |                59.99 |                2.09 ms |                            2.2 ms |
| Marina Bay / rain    |      132.1 s |       60.0 |                59.98 |                2.10 ms |                            5.0 ms |

Each race completed two laps. Results froze correctly afterward. There were no captured runtime or hydration errors. Structured summaries are in `evidence/performance.json`; complete per-second samples and screenshots remain in ignored `artifacts/` on the development machine.

GPU values above are the timer's rolling-window p95 at the end of the run, not whole-race maximum or whole-race p95. CPU submission excludes some simulation/draw preparation and does not measure GPU completion. A 60 FPS median does not imply every display interval is exactly 16.67 ms, particularly with variable-refresh timing.

The full-race run preceded the latest chase-camera translation correction. That correction passed unit, type, lint and build checks. Moving chase-view verification on gengar-db is described separately below; no fresh hardware timing is available. A short earlier wet test measured about 2.6 ms rolling GPU p95 with reflections. Do not merge measurements from different camera revisions into a single claimed benchmark.

## Resource cycling

The same counts returned in all three cycles after switching through every default circuit/weather:

| Menu world   | Geometries | Textures |
| ------------ | ---------: | -------: |
| Riviera      |         93 |       17 |
| Black Forest |         95 |       18 |
| Marina Bay   |        113 |       22 |

These are renderer-accounted resources uploaded in the tested views, not total JavaScript heap allocation or every geometry authored in a world. The check establishes no observed growth in that repeated sequence; it is not a proof against every possible leak.

## Current budget policy

- Race/countdown: 60 FPS; menu: 30; pause/results: 20.
- Hidden tabs: no rendering. Blur pauses active gameplay and clears input.
- Eco: 720p pixel budget, no directional shadow casting.
- Balanced: 1080p ceiling, bounded pixel ratio and adaptive resolution.
- Ultra: 1440p ceiling, no automatic resolution degradation.
- Sustained samples below 42 FPS reduce Balanced/Eco scale, down to 70% of their initial ratio. Recovery requires sustained fast samples.
- Wet-road reflection: fixed 640×360 target; spray: a fixed 384-particle pool.

The user accepts 40–50 FPS while other agents use the GPU. Preserve that tolerance; do not degrade the picture merely because it temporarily misses 60.

## Limits and next measurements

- No fan RPM, total package power, or sustained thermal measurement was taken. `pmset -g therm` showed no recorded thermal/performance warning at one inspection; that does not establish quiet operation.
- Physical controllers, real mobile devices, Safari and integrated/low-end GPUs remain untested.
- The DPR-only resize bug was reproduced and fixed on gengar-db. It is consistent with the old ratio-1 symptom, but the original Mac run cannot be conclusively explained retrospectively. A fresh visible Mac/Retina run is still needed.
- Do not run multiple heavy benchmarks/render jobs at once on a shared machine. Re-measure only when rendering changes justify it.

## Gengar-db verification — 2026-09-06

Linux Chromium 153.0.8010.12 uses ANGLE/SwiftShader because this host has no exposed rendering GPU or desktop display. This is functional evidence, not an updated hardware benchmark. Build, typecheck, lint and all 19 deterministic tests pass. `scripts/render-check.mjs` loaded and rendered all nine circuit/weather worlds, verified stable resources over three cycles, and captured no browser errors. The sweep is not nine complete races.

The moving chase view was inspected in `artifacts/chase-gengar.png`. At the following diagnostic sample, speed was 233 km/h, horizontal camera distance was 6.30 m and height was 2.08 m above the car origin. The car remains close and readable at speed. Software timing had a 2.95 FPS median (per-second samples 1.88–3.48 FPS), with a 1280×720 CSS viewport and an adaptively reduced 896×503 drawing buffer. GPU timer results were unavailable. These values do not predict laptop performance or prove good driving feel.

A DPR-only transition from 1 to 2 at 1440×900 CSS previously left the drawing buffer at 1440×900 until a CSS resize. The new media-query listener updates it to 1821×1138 under Balanced. Eco and Ultra produced 1214×758 and 2428×1517 respectively at that aspect ratio. Balanced at 1920×1080 CSS and Ultra at 2560×1440 CSS each respected their exact pixel ceilings. The return to DPR 1 and fullscreen entry/exit also passed; fullscreen used an 800×600 virtual display, not physical Retina hardware.

At Eco/960×540, the last two world cycles returned identical renderer counts: Riviera 96 geometries / 18 textures, Forest 100 / 19, Marina 118 / 23. Different viewport/quality and material revisions make these counts distinct from the old Mac baseline. The new concrete and runoff maps add two small world-owned textures and no draw calls. Structured evidence is in `evidence/render-check.json`.
