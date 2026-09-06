# Architecture

The current product is Astra Street; the F1 predecessor remains in Git history. The React application owns menus and the HUD. An imperative Three.js engine owns the game loop and browser resources. Simulation is separated from rendering so racing rules can be checked without a canvas or audio context.

## Modules

| Area              | Entry                                                                | Responsibility                                                             |
| ----------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Application shell | `app/page.tsx`, `src/ui/RacingGame.tsx`                              | Mount engine, connect telemetry/settings/UI, handle load failures          |
| Engine            | `src/game/engine.ts`                                                 | Compose subsystems, manage scene/session transitions and lifecycle         |
| Simulation        | `src/game/race-session.ts`                                           | Player dynamics, AI, collisions, laps, boost, countdown and results        |
| Circuit data      | `src/game/tracks.ts`                                                 | Layout definitions, arc-length track samples and local coordinate frames   |
| Frame budgets     | `src/game/render-loop.ts`                                            | Render deadlines, measurements and adaptive pixel budget                   |
| Presentation      | `src/game/scene-presentation.ts`, `src/game/environment-lighting.ts` | Contact shading, output conversion and material environment response       |
| Camera            | `src/game/camera.ts`                                                 | Menu orbit, chase rig and attached bonnet viewpoint                        |
| Vehicles          | `src/game/vehicle.ts`                                                | GLTF loading, material variants, wheel animation and small car effects     |
| World             | `src/game/world.ts`, `src/game/world/*`                              | Road, furniture, terrain, vegetation, buildings, sky, rain and reflections |
| Wet effects       | `src/game/tire-spray.ts`, `src/game/world/wet-road.ts`               | Bounded spray pool and low-resolution planar reflection                    |
| Input             | `src/game/input.ts`                                                  | Keyboard, gamepad and touch input state, blur handling                     |
| Audio             | `src/game/audio.ts`                                                  | Synthesized engine, wind, tire feedback and countdown cues                 |
| GPU measurements  | `src/game/gpu-timer.ts`                                              | Sparse asynchronous WebGL timer queries                                    |
| Materials         | `src/game/materials.ts`, `src/game/shaders/*`                        | Texture loading, generated surface graphics and shader sources             |
| UI                | `src/ui/*`                                                           | Race setup, HUD, settings, session overlay, map and touch controls         |
| Styles            | `src/ui/styles/*`, `app/globals.css`                                 | Menu, HUD, dialogs, responsive rules and shared tokens                     |

`components/ui/` is the scaffold's shared component library. Compose those primitives from `src/ui/`; avoid mixing engine logic into them. Owned-source lint covers `src`, `app`, and configuration files. It intentionally excludes vendored UI components.

## Simulation

A closed Catmull–Rom spline describes each flat circuit. A `Track` precomputes 2,048 samples and supports wrapped, arc-length-based positions. A sample provides world position, forward/right vectors, heading, and curvature.

Drivers use an unwrapped distance along the track, a lateral offset, speed, and heading error. Unwrapped distance determines standings and lap completion; physical proximity uses a wrapped signed gap so cars can collide across a finish line or when lapping one another.

The engine advances `RaceSession` in fixed 1/120-second steps. `street-score.ts` owns bankable chains, multipliers and bonus messages; simulation calls it for drifting, close forward passes and speed-check crossings. Handbrake slip is separate from velocity heading, so the body can rotate into a recoverable slide while the assisted trajectory remains steerable. Space is handbrake; S/down remains service braking. Input uses positive for screen-right across keyboard, touch and gamepad. Since the chassis faces +Z, simulation converts that to negative world yaw; the benchmark pilot performs the inverse conversion. A camera-space regression check covers both directions. Throttle, braking, drag, steering rate, yaw damping, off-track drag, barriers, and boost create approachable arcade handling. Assistance compensates for part of the track curvature; it does not eliminate steering. Rain lowers grip and braking force. Opponents choose a curvature-dependent target speed and adjust lanes around nearby cars.

A quick race ends after the player's second completed lap. The result position and all simulated drivers freeze. Time trials have no opponents and end through the HUD action. The benchmark pilot is test-only and must remain opt-in.

## State flow

`loading → menu → countdown → racing → finished`

`countdown` or `racing` can enter `paused`, which remembers the prior phase. Restart creates a fresh session; returning to circuits rebuilds the menu world. Browser blur/visibility handling clears held inputs and pauses an active race. Settings dialogs must not let global Enter/other shortcuts start or alter a race underneath them.

The HUD receives snapshots about ten times per second. High-frequency simulation and rendering stay outside React state.

## Camera contract

The original Astra S9 GLB is Y-up with its nose along +Z. Four wheel objects have baked rest transforms and animate around local X. The alternate camera is a bonnet view at `(0, 0.98, 0.9)` relative to the car; its legacy settings key is `cockpit` for compatibility. It is rigidly attached at speed.

The chase rig carries car translation before smoothing its relative pose. The latest reference pass moves the chase view roughly 21–23 m behind the car and about 5.5 m above it, exposing the slide and surrounding road. Distance stability and bonnet attachment have regression checks. `scripts/render-check.mjs` checks the moving rig in production.

## Resource ownership

- The engine owns the renderer, presentation targets, input/audio, resize observer, animation callback, prefiltered HDR environment, loaded road/ground/rock textures, shared car, tree and canyon scan libraries, current world, car visuals and effects.
- Car geometry is immutable and shared. Each visual owns cloned materials, contact-shadow resources, brake lights and nitro effects. Car material disposal never releases the shared environment or source geometry.
- `world/tree-assets.ts` loads seven CC0 source tree variants. The six conifers receive a fourth 2,400-triangle geometry level; the broadleaf retains its three authored levels. Canyon adds three four-level low-crowned fir derivatives owned by the engine. It bakes complete GLTF transforms once, owns the immutable geometries/materials/textures and matching wind-aware depth materials, and survives world changes. `world/tree-batches.ts` owns only spatial instance buffers. Those batches are removed and disposed before generic world traversal, keeping the library alive.
- `world/canyon-scan-assets.ts` owns two CC0 scans and their runtime closed shells. `canyon-scan-formations.ts` borrows those resources and owns only spatial instance buffers, removed before world traversal. `canyon-scan-shell.ts` preserves front positions/UVs and closes scanned cut boundaries. The engine retains scans across all route/weather changes and disposes the library on teardown.
- World builders own generated geometry, materials, instance buffers and generated maps. Engine-owned surface and environment textures are explicitly excluded from world disposal. Wet-road teardown releases its reflector target and geometry. The terrain, eight terraced cliff profiles, four boulder variants, mineral-detail map, road wear and rural furniture are world-owned.
- Scene changes release the previous world, car visuals, smoke/spray and skid marks. Engine teardown cancels animation, unregisters listeners and releases all shared resources. No asynchronous tree loads run after world construction.

`tire-spray.ts` retains one 384-particle pool; `tire-marks.ts` retains one 768-segment ring. Repeated world/quality/target changes are checked with renderer-accounted resource counts; those counts do not measure every JavaScript allocation.

## Landscape and vegetation

The 251×251 terrain field has a 12 m grid. Paved corridors stay flat and clear; foothills rise outside them. Height queries interpolate the same two triangles as the rendered grid so roots and groundcover meet sloped ground. Finite-difference slopes guide placement and exposed-rock blending. Cliff footprints are indexed spatially to keep vegetation out of solid rock. Distant mountain ridges stay at least 650 m from the route and use layered coherent relief with atmospheric haze.

`vegetation.ts` controls species, scale, clearings and crown spacing; `clustered-groundcover.ts` places grass, ferns and shrubs in small roadside colonies. `undergrowth-geometry.ts` creates curved blades and branched plants with individual shaped leaf surfaces. Canyon uses dry soil; Pinecrest uses scanned moss/litter terrain. The ground repeats at 2.8 m; steep faces blend triplanar rock color, correctly oriented normals and roughness.

Tree batches are partitioned by species and LOD in 80/80/320/480 m tiles. One immutable placement/matrix/bounds record is shared by its LOD bins, with mutable membership stored separately. Transitions repack only old/new bins. Near/middle cutoffs are 100/270 m in Balanced, 65/185 in Eco and 130/350 in Ultra, with hysteresis. The optional fourth conifer cutoff is 520 m in Balanced, 480 m in Eco and 550 m in Ultra, with a 32 m hysteresis band. All distances use full 3D models: individual cutout foliage surfaces occur throughout branching crowns, with no whole-tree billboards. Camera movement beyond 4 m triggers distance selection; only tiles changing LOD upload new matrices. Near/middle trees cast shadows. Small crown sway and leaf flutter share the same displacement in beauty and depth passes.

The broadleaf atlas is padded offline using the union of all LOD UV regions and a two-texel margin verified against continuous bilinear support. Unused RGB is extended from mapped opaque non-white pixels; all alpha and protected source colors remain unchanged. This prevents the bake's unused white regions contaminating generated mipmaps without adding runtime work or disabling trilinear/anisotropic filtering. The portable GLB repair and byte-preservation checks live in `scripts/assets/trees/pad_broadleaf_atlas.py`.

`rural-roadside.ts` supplies corrugated steel guardrails, posts, delineators and worn center dashes. Rural routes have narrow asphalt shoulders and soil verges. Harbor City retains its existing circuit furniture and buildings.

## Rendering and power choices

WebGL2 uses ACES tone mapping, bounded resolution, PBR surfaces, a shared HDR environment, hemisphere fill and one local 4096² directional shadow map in Balanced/Ultra. Eco disables directional shadow casting. `environment-lighting.ts` binds the shared map explicitly, because Three.js otherwise replaces material environment intensity with scene intensity. Authored leaf, ground, stone and paint settings are multiplied by weather strength once, without compounding on repeated world changes.

Balanced/Ultra use an MSAA4 half-float beauty target and half-resolution depth-derived contact shading, followed by a depth-aware composite. Real alpha-tested foliage and wet-road reflection participate in the beauty pass. The effect adds two fullscreen draws; Eco or unsupported float targets bypass it. Targets follow physical drawing-buffer dimensions, restore renderer state and are engine-owned. It is modest contact darkening, not global illumination. Wet reflections retain a 640×360 target with normal distortion and Fresnel blending.

Rendering is capped at 30 FPS for racing/countdown/menu and 20 for pause/results. The scheduler retains deadlines across refresh rates. Balanced/Eco lower resolution only after sustained samples below 25 FPS, with slow recovery near 30; Ultra retains its pixel cap without automatic degradation. Hidden tabs do not render, and blur clears input and pauses gameplay.

DPR-only changes are handled by a re-armed resolution media query and a scalar rendered-frame check for coalesced transitions. Diagnostics separate CSS size, device DPR and effective ratio. Sparse GPU timer queries run every eighth render without `gl.finish()` or synchronous readback; CPU submission and GPU timing remain separate measurements.

## Storage and hosting

Settings: `astra-settings-v1`. Street best laps: `astra-street-best-v1:<circuit>:<weather>`, kept separate from historical Formula laps. Score is session-local. Settings are normalized before restoration. There is no backend save, multiplayer, telemetry upload, or external asset request during gameplay.

The Sites/Vinext scaffold builds a Cloudflare-compatible Worker plus static assets. `.openai/hosting.json` identifies the existing private project; no runtime bindings are configured. Source remains a normal local Git repository and is mirrored in the personal private GitHub repository `rcbran/astra-street`. Public visibility and a source license remain separate decisions.
