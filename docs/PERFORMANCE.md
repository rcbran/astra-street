# Performance evidence

## Current checkpoint — round 10, 2026-09-06

The measured round-10 runtime fingerprint is `bd6bcd102b66ac159f08053dac0b59e9e6056a638f86e9f33eec5430ba0585d1`; the current source was verified identical for runtime files, with only a public notice correction afterward. Dedicated HeadlessChrome 153.0.8010.12 on the Radeon 780M completed a focused wet Pinecrest race at **29.51 FPS median / 21.64 FPS tenth percentile**, 1275×796 through 1821×1138, with 43.59 ms ending rolling GPU p95 and 124.8 ms highest CPU-submit p95. Two laps, frozen results/all-driver state, three resource cycles and zero browser errors passed. This remains headless shared-PC evidence, not visible-display pacing; the 30 FPS target is still open. [Race report](evidence/kyogre-street/round10-wet-pinecrest-race.json).

The paired frozen GPU budget report passed at the same hardware/pixel setup: Canyon sunset baseline **29.78 ms GPU / 4.70 ms CPU** and wet Pinecrest baseline **37.65 ms / 20.40 ms**; direct presentation measured 23.66 ms and 29.46 ms. These are fixed-pose ablations, not full-race FPS or visual-equivalence claims. [GPU report](evidence/kyogre-street/gpu-budget-round-10.json).

## Reference iteration — kyogre, 2026-09-06

The round-08 production build adds per-LOD tree bins, a 2,400-triangle fourth conifer model, tighter occupied bounds, the terrain soil sampling branch, reduced Canyon groves and closed CC0 cliff scans. Runtime fingerprint: `190576c7deda82aba2962a8d5b407d2497ef1a965c1349673eb35fcfbb5532ec`. Subsequent wider cliff placement is not represented by these timings.

Dedicated hardware HeadlessChrome on the same Radeon 780M, frozen pose, Balanced quality, 1440×900 CSS/DPR2 and **1821×1138 internal pixels**, no video recording. Each mode has ten retained samples after two warmups, alternating order. CPU/GPU activity from other projects was not isolated. The comparison with round 03 includes several geometry/layout changes and separate runs; it does not isolate the contribution of one optimization.

| Route/weather | Round 03 median GPU | Round 08 median GPU | Round 08 CPU submission median | Submitted triangles | Draw calls |
| --- | ---: | ---: | ---: | ---: | ---: |
| Canyon / sunset | 38.37 ms | 28.91 ms | 6.40 ms | 8.48 million | 398 |
| Pinecrest / rain | 46.63 ms | 41.44 ms | 49.00 ms | 27.10 million | 1,552 |

Canyon is within the 33.3 ms GPU frame budget in this frozen sample. Wet Pinecrest still exceeds it and has substantial CPU submission time. These are not full-race FPS or visible pacing results. The CPU figure includes submission stalls; it is not a profile assigning all time to JavaScript. Full mode samples, exact source file hashes, renderer and category counts are in [the round-08 report](evidence/kyogre-street/gpu-budget-round-08.json). A subsequent full production wet-Pinecrest two-lap race completed in 143.89 seconds at **21.00 FPS median / 11.80 FPS tenth percentile**. Frozen results, all-driver state and three resource cycles passed with zero browser errors. This remains below target. The complete headless run, adaptive framebuffer samples and exact limitations are in [the race report](evidence/kyogre-street/round08-wet-pinecrest-race.json). Final production keyboard/UI, emulated touch and all-nine-world resource checks passed on the round-10 runtime; see `round10-{browser,render,touch}-check.json` in the same evidence directory. The first launch without the explicit dedicated CDP endpoint selected software rendering and failed the hardware assertion before race measurement; that discarded attempt is not performance evidence.

## Earlier broadleaf correction — kyogre, 2026-09-06

**Nine complete two-lap production races, frozen results and three repeated route/weather resource cycles passed.** The 30 FPS target is preserved. Eight of nine median FPS values round to 30. **Wet Pinecrest falls below target: 26.56 FPS median and 22.86 FPS tenth percentile**, despite adaptive resolution. The target is not met everywhere on this GPU.

Host: **kyogre, Arch Linux 7.2.3-arch1-2, AMD Ryzen 7 8745H / Radeon 780M**. Dedicated HeadlessChrome 153.0.8010.12 reports `ANGLE (AMD, AMD Radeon 780M Graphics (radeonsi phoenix ACO), OpenGL ES 3.2)` using `ASTRA_BROWSER_ANGLE=gl-egl`. Other agents/projects may use the PC; GPU load was not isolated. These are headless renderer workloads, not visible-display pacing, thermals, power or human driving feedback. Node 26.8.1 built and served the existing lockfile.

Balanced quality, chase camera, assisted pilot, 1440×900 CSS/DPR2. The maximum internal framebuffer is **1821×1138** (about 2.07 million pixels), not a 1920×1080 framebuffer or native DPR2. Adaptation remains enabled. Ranges show the smallest/largest actual racing framebuffer, including warm-up; not every intervening resolution was used.

| Route / weather | Observed run (s) | Median FPS | Tenth-percentile FPS | Internal framebuffer range | Ending rolling GPU p95 |
| --- | ---: | ---: | ---: | --- | ---: |
| Canyon Run / Golden hour | 113.3 | 30.00 | 30.00 | 1821×1138 | 32.43 ms |
| Canyon Run / Clear sky | 113.0 | 30.00 | 30.00 | 1821×1138 | 29.21 ms |
| Canyon Run / Wet night | 114.0 | 30.00 | 26.56 | 1675×1047 → 1821×1138 | 34.48 ms |
| Pinecrest / Golden hour | 141.0 | 30.00 | 25.16 | 1530×956 → 1821×1138 | 39.74 ms |
| Pinecrest / Clear sky | 145.9 | 30.00 | 25.58 | 1675×1047 → 1821×1138 | 40.01 ms |
| Pinecrest / Wet night | 136.6 | 26.56 | 22.86 | 1275×796 → 1821×1138 | 45.84 ms |
| Harbor City / Golden hour | 137.9 | 30.00 | 30.00 | 1821×1138 | 18.93 ms |
| Harbor City / Clear sky | 138.0 | 30.00 | 30.00 | 1821×1138 | 18.28 ms |
| Harbor City / Wet night | 132.0 | 30.00 | 30.00 | 1821×1138 | 22.14 ms |

Observed run duration includes countdown and up to about one second of finish polling latency. Two completed laps are corroborated by every run’s lap telemetry and final distance exceeding twice its route length; the original harness asserted finish and best lap, and now also asserts the lap count and finish distance explicitly. The nine-run freeze check covers player distance, race clock and finishing position after 1.1 seconds; the extended harness also checks all drivers and a compact result state. FPS percentiles summarize one-second racing windows, excluding each race's first six windows. They are not per-frame 1% lows. GPU p95 is the last racing snapshot's rolling query window, not whole-race p95 or maximum. The report’s highest rolling GPU p95 can include warm-up or a preceding world within its rolling query window; it is not a race-only maximum. Full per-second telemetry, frame-interval/submission p95 samples, framebuffers observed at roughly one-second intervals, asset hashes, timestamps, frozen-result assertions and all 27 resource-cycle rows are in [the raw report](evidence/kyogre-trees/full-races.json). CPU submission is distinct from GPU completion and excludes some preparation work. No browser/shader errors were captured.

The broadleaf atlas correction preserves alpha, mapped colors and geometry, and adds no runtime pass. Six exact frozen route/weather A/B pairs and 62 broadleaf angle/LOD views passed. **31 deterministic tests, typecheck, lint, build, production keyboard/responsive UI, emulated touch, DPR/quality/fullscreen, moving-camera and nine-world checks passed.** Presentation targets track the physical framebuffer. Shared tree/surface/HDR resources survive world rebuilds and release once at engine teardown; renderer-accounted counts are not a JavaScript heap audit.

The retained contact-shading trial costs about **6.7 ms** on this GPU in fixed Pinecrest views at 1821×1138: clear 34.91 ms direct / 41.59 ms contact-shaded; rain 38.58 / 45.29 ms. These are medians of 20 retained asynchronous samples per mode, alternating order after warm-up, with the same Balanced scene/shadows/camera. The difference includes MSAA4 half-float presentation and both fullscreen passes, not just the shading shader. They are separate from racing FPS. See [presentation cost](evidence/kyogre-trees/presentation-cost.json). The trial remains a candidate for performance tuning; its full-game resource lifecycle now passes.

Measured source is the dirty tree based on `8d30b17`, with broadleaf GLB SHA256 `28bbaeba0b58df18cfb50291a201a415431b8fe086d90e85ce497e7969c4a93b`. That parent SHA alone does not identify the corrected source. Rendering was unchanged during the complete-race sweep. A subsequent padding-margin correction preserves additional valid bilinear taps; the current GLB hash is `2581f4739d4e2cccbdfeb966b344105a73f21426c09b8aea2ef0911270937a73`. It changes RGB only, preserving alpha, geometry, materials and rendering workload. These nine timing runs belong to the earlier hash; final-asset visual checks and a focused wet Pinecrest production repeat are recorded separately. The overhaul is not deployed; live private Site version 2 still uses the older landscape. The unrun inherited benchmark initially stopped before racing on a weather-radio selector; the selector was corrected before these nine runs.

The focused final-asset wet Pinecrest repeat completed two laps in 138.2 observed seconds: **22.62 FPS median / 18.69 FPS tenth percentile**, with racing framebuffers 1275×796 through 1821×1138 and ending rolling GPU p95 50.37 ms. It passed the stronger finish-distance, all-driver/result freeze and three world-cycle checks with no browser errors. This is a separate shared-PC run, not a controlled performance comparison between the two atlas margins; the cause of the timing difference was not isolated. See [final-asset repeat](evidence/kyogre-trees/final-wet-pinecrest.json).

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
