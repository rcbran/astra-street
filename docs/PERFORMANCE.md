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

The full-race run preceded the latest chase-camera translation correction. That correction passed unit, type, lint and build checks; follow-up moving chase-view timing/visual verification remains pending. A short earlier wet test measured about 2.6 ms rolling GPU p95 with reflections. Do not merge measurements from different camera revisions into a single claimed benchmark.

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
- Audit Retina resizing/fullscreen after the next camera check: the baseline reported DPR 2 but rendered at ratio 1. The pixel ceiling worked, but the exact reason for that ratio should be confirmed before making resolution-quality claims.
- Do not run multiple heavy benchmarks/render jobs at once on this shared laptop. Re-measure only when rendering changes justify it.
