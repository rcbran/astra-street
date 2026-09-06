# Performance evidence

## Current tree overhaul — not yet production-benchmarked

The migration checkpoint changes the target to **30 FPS** and integrates substantially heavier full-3D trees, new terrain/materials, 4096² shadows and a contact-shading trial. **31 tests, typecheck, lint and production build pass**, but final production full-race timing and resource-cycle validation have not run. The modernized `scripts/benchmark.mjs` supports `ASTRA_ALL_WEATHER=1` for nine complete races and owns a dedicated headless context.

Static shape QA captured 434 tree views and 90 undergrowth views in headless Chrome152 on ANGLE/Metal Apple M4 Max with no errors. Static images are not timing evidence. Short development driving captures displayed 30 FPS at CSS1440×900/DPR1; an A/B used an1821×1138 framebuffer at CSS1440×900/DPR2. Neither establishes sustained production performance. Selected evidence is in `evidence/trees-wip/`; reports record the dirty source based on `b647678`, not a clean measured release.

A separate broadleaf atlas filtering defect remains unresolved. See `HANDOFF.md`. Re-measure after that fix and final visual acceptance. The user is migrating to a mini PC: identify its real GPU and distinguish hardware from software rendering. M4 Max figures must not be presented as mini PC performance.

Everything below is historical unless explicitly headed **Current budget policy**.

## Previous landscape revision — 2026-09-06 (60 FPS target)

The user requested headless automation off their screen. Chrome 152.0.7977.76 reports **HeadlessChrome with ANGLE/Metal on Apple M4 Max**, using a separate temporary profile. This is a production-build GPU workload sample, **not a visible-window display-pacing benchmark**. The older visible results below remain distinct.

Balanced / chase / assisted pilot, DPR 2 at 1440×900 CSS, measured **1821×1138 drawing buffer** (effective ratio 1.264911). This is roughly 2.07 million pixels under the 1080p pixel-count ceiling, not native Retina or a 1920×1080 framebuffer. Each route ran about 25 seconds; FPS statistics use the final sixteen per-second samples.

| Route / weather     | Observed run | Median FPS | Tenth-percentile FPS | Ending rolling GPU p95 | Highest per-second CPU-submit p95 |
| ------------------- | -----------: | ---------: | -------------------: | ---------------------: | --------------------------------: |
| Canyon Run / sunset |      25.43 s |      60.00 |                60.00 |                4.20 ms |                           1.80 ms |
| Pinecrest / clear   |      25.37 s |      60.00 |                60.00 |                3.53 ms |                           1.90 ms |
| Harbor City / rain  |      25.32 s |      60.00 |                60.00 |                4.83 ms |                           5.00 ms |

Canyon contains 6,207 trees (1,500 solid roadside conifers), 1,020 rock instances and 6,202 grass clumps. Pinecrest contains 10,853 trees (1,500 solid), 620 rock instances and 6,360 grass clumps. Harbor City gains a mountain backdrop and 78 distant trees. Vegetation is spatially batched; geometry is shared and scene-owned. More triangles are intentional: one ending canyon sample submits about 6.16 million triangles including the shadow pass, while the 1821×1138 cap remains intact.

No captured browser errors. Raw tail samples, capture timestamps/positions, actual framebuffer and renderer are in `evidence/landscape-mac.json`. GPU p95 is the timer's ending rolling window, not whole-run p95 or maximum; CPU submission excludes some simulation/preparation and GPU completion. No thermal, fan/noise, power or physical-device measurements were taken. These short pilot runs do not replace complete races or human driving feedback. Source evidence was captured from the dirty landscape working tree based on `763f684` before committing.

Headless production keyboard checks passed for both left and right movement, drifting/scoring, nitro, service braking, pause/blur and five responsive menu sizes. Emulated multi-touch passed and released all inputs. DPR/quality/fullscreen checks and all nine world builds passed. Three Eco/960×540 resource cycles returned identical counts: Canyon 94 geometries / 18 textures, Pinecrest 89 / 20, Harbor 97 / 25. Those are renderer-accounted uploads in that sequence, not total heap use or a universal leak guarantee. There are 26 passing deterministic tests, including camera-space steering direction and terrain clearance across all paved routes. Current reports use `landscape-` prefixes.

## First street release — 2026-09-06

Visible foreground Chrome 152.0.7977.76 on Apple M4 Max using ANGLE/Metal, production build, Balanced chase camera and an automated pilot. Each route ran about 25 seconds. The owned browser context emulated DPR 2 with a **1440×900 CSS viewport and measured 1821×1138 drawing buffer**, effective ratio 1.264911. That is about 2.07 million pixels under the 1080p pixel-count ceiling; it is neither native Retina nor a 1920×1080 framebuffer.

| Route / weather     | Observed run | Median FPS | Tenth-percentile FPS | Ending rolling GPU p95 | Highest per-second CPU-submit p95 |
| ------------------- | -----------: | ---------: | -------------------: | ---------------------: | --------------------------------: |
| Canyon Run / sunset |      25.72 s |      60.00 |                59.95 |                3.05 ms |                           3.70 ms |
| Pinecrest / clear   |      25.75 s |      60.00 |                59.51 |                2.65 ms |                           2.80 ms |
| Harbor City / rain  |      25.60 s |      60.00 |                59.54 |                3.69 ms |                           3.80 ms |

The FPS values summarize the final sixteen per-second racing samples, excluding startup and the first capture. GPU values are the ending rolling-window p95, not whole-run p95 or maximum. CPU submission excludes some simulation/draw preparation and GPU completion. No captured runtime errors. Report and samples: `evidence/street-mac.json`. The report honestly records the dirty street working tree based on `a711012`; it is not evidence for unchanged upstream source. These short pilot runs do not establish full-race coverage, human driving feel, low-end performance, power use or sustained thermals.

The production render check passed DPR-only changes, rapid return to DPR 1, quality ceilings, fullscreen entry/exit and the farther moving chase camera (10.32 m horizontal / 2.95 m high at a 226 km/h sample). All nine route/weather worlds loaded/rendered. At Eco/960×540, all three resource cycles returned Canyon 86 geometries / 19 textures, Pinecrest 80 / 20, Harbor 92 / 25. These are renderer-accounted uploads in that sequence, not total heap usage or a proof against every leak. See `evidence/street-render-check.json`.

Production keyboard/UI and emulated multi-touch checks passed, alongside 24 deterministic tests, strict typecheck, owned-source lint and build. Physical controllers, touch devices and Safari remain untested. The final landscape touch layout was separately inspected. See `evidence/street-browser-check.json` and `evidence/street-touch-check.json`.

The engine retains the existing frame/pixel policy below; the new dry drift smoke shares the bounded 384-particle pool, and skid marks use a 768-segment ring buffer. The user accepts 40–50 FPS under shared GPU load. Do not repeat heavy timing runs without relevant changes or an unresolved concern.

## Historical Formula evidence

These older measurements use different vehicles, scenery, camera or rendering revisions. They remain useful history but do not describe the street build.

The following historical Formula revision was measured on 2026-09-05 in production-build gameplay on an Apple M4 Max MacBook Pro: 14 CPU cores, 32 GPU cores, 36 GB RAM. Chrome 152.0.7977.76 used ANGLE's Metal renderer. Other GPU work was permitted on the same laptop.

## Full race measurements

Balanced settings, 1440×900 CSS viewport, device pixel ratio reported as 2, **measured drawing buffer 1440×900**. Framebuffer size is the authoritative render workload; do not describe this as native Retina or a full 1080p benchmark.

| Circuit / weather    | Observed run | Median FPS | Tenth-percentile FPS | Ending rolling GPU p95 | Highest per-second CPU-submit p95 |
| -------------------- | -----------: | ---------: | -------------------: | ---------------------: | --------------------------------: |
| Riviera / sunset     |      115.0 s |       60.0 |                59.95 |                1.75 ms |                            1.8 ms |
| Black Forest / clear |      137.2 s |       60.0 |                59.99 |                2.09 ms |                            2.2 ms |
| Marina Bay / rain    |      132.1 s |       60.0 |                59.98 |                2.10 ms |                            5.0 ms |

Each race completed two laps. Results froze correctly afterward. There were no captured runtime or hydration errors. Structured summaries are in `evidence/performance.json`; complete per-second samples and screenshots remain in ignored `artifacts/` on the development machine.

GPU values above are the timer's rolling-window p95 at the end of the run, not whole-race maximum or whole-race p95. CPU submission excludes some simulation/draw preparation and does not measure GPU completion. A 60 FPS median does not imply every display interval is exactly 16.67 ms, particularly with variable-refresh timing.

The full-race run preceded the latest chase-camera translation correction. That correction passed unit, type, lint and build checks. Moving chase-view verification on gengar-db is described separately below; no fresh hardware timing was available at that handoff. A short earlier wet test measured about 2.6 ms rolling GPU p95 with reflections. Do not merge measurements from different camera revisions into a single claimed benchmark.

## Resource cycling

The same counts returned in all three cycles after switching through every default circuit/weather:

| Menu world   | Geometries | Textures |
| ------------ | ---------: | -------: |
| Riviera      |         93 |       17 |
| Black Forest |         95 |       18 |
| Marina Bay   |        113 |       22 |

These are renderer-accounted resources uploaded in the tested views, not total JavaScript heap allocation or every geometry authored in a world. The check establishes no observed growth in that repeated sequence; it is not a proof against every possible leak.

## Current budget policy

- Race/countdown/menu: 30 FPS; pause/results: 20.
- Hidden tabs: no rendering. Blur pauses active gameplay and clears input.
- Eco: 720p pixel budget, no directional shadow casting.
- Balanced: 1080p ceiling, bounded pixel ratio and adaptive resolution.
- Ultra: 1440p ceiling, no automatic resolution degradation.
- Three sustained slow samples below 25 FPS reduce Balanced/Eco scale, down to 70% of their initial ratio. Recovery requires 15 samples above 29 FPS with CPU submission below 18 ms.
- Wet-road reflection: fixed 640×360 target; spray: a fixed 384-particle pool.

The user explicitly changed the target to 30 FPS for richer trees and scenery. Healthy 30 FPS samples must retain full detail; the previous 42 FPS adaptation threshold would have degraded resolution continuously.

## Limits and next measurements

- No fan RPM, total package power, or sustained thermal measurement was taken. `pmset -g therm` showed no recorded thermal/performance warning at one inspection; that does not establish quiet operation.
- Physical controllers, real mobile devices, Safari and integrated/low-end GPUs remain untested.
- The DPR-only resize bug was reproduced and fixed on gengar-db. It is consistent with the old ratio-1 symptom, but the original Mac run cannot be conclusively explained retrospectively. The current street measurements above now provide a fresh visible Mac run with explicit DPR and framebuffer accounting.
- Do not run multiple heavy benchmarks/render jobs at once on a shared machine. Re-measure only when rendering changes justify it.

## Gengar-db verification — 2026-09-06

Linux Chromium 153.0.8010.12 uses ANGLE/SwiftShader because this host has no exposed rendering GPU or desktop display. This is functional evidence, not an updated hardware benchmark. Build, typecheck, lint and all 19 deterministic tests pass. `scripts/render-check.mjs` loaded and rendered all nine circuit/weather worlds, verified stable resources over three cycles, and captured no browser errors. The sweep is not nine complete races.

The moving chase view was inspected in `artifacts/chase-gengar.png`. At the following diagnostic sample, speed was 233 km/h, horizontal camera distance was 6.30 m and height was 2.08 m above the car origin. The car remains close and readable at speed. Software timing had a 2.95 FPS median (per-second samples 1.88–3.48 FPS), with a 1280×720 CSS viewport and an adaptively reduced 896×503 drawing buffer. GPU timer results were unavailable. These values do not predict laptop performance or prove good driving feel.

A DPR-only transition from 1 to 2 at 1440×900 CSS previously left the drawing buffer at 1440×900 until a CSS resize. The new media-query listener updates it to 1821×1138 under Balanced. Eco and Ultra produced 1214×758 and 2428×1517 respectively at that aspect ratio. Balanced at 1920×1080 CSS and Ultra at 2560×1440 CSS each respected their exact pixel ceilings. The return to DPR 1 and fullscreen entry/exit also passed; fullscreen used an 800×600 virtual display, not physical Retina hardware.

At Eco/960×540, the last two world cycles returned identical renderer counts: Riviera 96 geometries / 18 textures, Forest 100 / 19, Marina 118 / 23. Different viewport/quality and material revisions make these counts distinct from the old Mac baseline. The new concrete and runoff maps add two small world-owned textures and no draw calls. Structured evidence is in `evidence/render-check.json`.
