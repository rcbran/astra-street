# Architecture

The current product is Astra Street; the F1 predecessor remains in Git history. The React application owns menus and the HUD. An imperative Three.js engine owns the game loop and browser resources. Simulation is separated from rendering so racing rules can be checked without a canvas or audio context.

## Modules

| Area              | Entry                                                  | Responsibility                                                             |
| ----------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Application shell | `app/page.tsx`, `src/ui/RacingGame.tsx`                | Mount engine, connect telemetry/settings/UI, handle load failures          |
| Engine            | `src/game/engine.ts`                                   | Compose subsystems, manage scene/session transitions and lifecycle         |
| Simulation        | `src/game/race-session.ts`                             | Player dynamics, AI, collisions, laps, boost, countdown and results        |
| Circuit data      | `src/game/tracks.ts`                                   | Layout definitions, arc-length track samples and local coordinate frames   |
| Frame budgets     | `src/game/render-loop.ts`                              | Render deadlines, measurements and adaptive pixel budget                   |
| Camera            | `src/game/camera.ts`                                   | Menu orbit, chase rig and attached bonnet viewpoint                        |
| Vehicles          | `src/game/vehicle.ts`                                  | GLTF loading, material variants, wheel animation and small car effects     |
| World             | `src/game/world.ts`, `src/game/world/*`                | Road, furniture, terrain, vegetation, buildings, sky, rain and reflections |
| Wet effects       | `src/game/tire-spray.ts`, `src/game/world/wet-road.ts` | Bounded spray pool and low-resolution planar reflection                    |
| Input             | `src/game/input.ts`                                    | Keyboard, gamepad and touch input state, blur handling                     |
| Audio             | `src/game/audio.ts`                                    | Synthesized engine, wind, tire feedback and countdown cues                 |
| GPU measurements  | `src/game/gpu-timer.ts`                                | Sparse asynchronous WebGL timer queries                                    |
| Materials         | `src/game/materials.ts`, `src/game/shaders/*`          | Texture loading, generated surface graphics and shader sources             |
| UI                | `src/ui/*`                                             | Race setup, HUD, settings, session overlay, map and touch controls         |
| Styles            | `src/ui/styles/*`, `app/globals.css`                   | Menu, HUD, dialogs, responsive rules and shared tokens                     |

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

The chase rig carries car translation before smoothing its relative pose. The street view is intentionally farther back, roughly 9–11 m, to expose the slide and surrounding road. Distance stability and bonnet attachment have regression checks. `scripts/render-check.mjs` checks the moving rig in production.

## Resource ownership

- The engine owns the renderer, input/audio, resize observer, animation callback, HDR-derived environment target, loaded surface textures, shared car asset, current world, car visuals, and spray pool.
- The source GLB's geometry is immutable and shared by cloned cars. Each visual owns its cloned materials, contact-shadow resources, brake-light geometry/material and shared-per-car nitro cone resources. Disposing one car must not dispose shared GLTF geometry.
- World builders own the geometry/materials/textures they create. Loaded road/grass/tree textures are shared and excluded from world disposal.
- Wet-road disposal explicitly releases its reflector target and geometry. Original concrete and runoff maps in `world/track-surfaces.ts` belong to the world and are disposed with its materials. The rock/conifer textures are engine-owned and excluded from world disposal. Six reusable fractured rock profiles are world-owned. Three solid conifer variants and their trunks cover the roadside; four distant tree kinds use two atlases. Vegetation is grouped into spatial tiles for frustum culling. The 251×251 terrain field provides one shared height function during world construction, with flat road clearance and rising hills beyond it. Mountain geometry fills the far horizon. The road-wear overlay owns one texture and geometry. Tree textures are preloaded; scene construction does not leave asynchronous callbacks capable of reviving disposed worlds.
- Track changes dispose the previous world/cars before replacing them. Engine disposal cancels animation, unregisters listeners, and releases shared resources.

`tire-spray.ts` owns one 384-particle pool: wet spray or dry drift smoke. `tire-marks.ts` owns one fixed 768-segment ring buffer. Both are disposed on scene changes and engine teardown.

Measured resource counts returned to the same values over three full track-switch cycles. See `docs/evidence/landscape-render-check.json`.

## Rendering and power choices

WebGL2 uses ACES tone mapping, bounded pixel ratio, PBR surfaces, a prefiltered HDR environment, hemisphere fill, and one nearby directional shadow map. Scenery and spectators are instanced; repeated geometry is merged where useful. Distant vegetation uses alpha-tested crossed cards; nearby conifers have solid branch geometry and cast shadows. Wet reflections use a 640×360 target with normal distortion and Fresnel blending; tire spray is one 384-particle draw call.

The frame scheduler retains deadlines across display refresh rates instead of quantizing 144 Hz down to 48 FPS. Resolution budgeting reacts to sustained low frame rates and recovers slowly. A re-armed resolution media query catches DPR changes even when the CSS viewport stays the same. A scalar DPR check on rendered frames also catches rapid round-trips whose media-query events Chrome can coalesce; the engine removes its listener on disposal. Diagnostics record CSS dimensions, device DPR and effective pixel ratio separately. GPU timing samples every eighth render without `gl.finish()` or synchronous readback.

## Storage and hosting

Settings: `astra-settings-v1`. Street best laps: `astra-street-best-v1:<circuit>:<weather>`, kept separate from historical Formula laps. Score is session-local. Settings are normalized before restoration. There is no backend save, multiplayer, telemetry upload, or external asset request during gameplay.

The Sites/Vinext scaffold builds a Cloudflare-compatible Worker plus static assets. `.openai/hosting.json` identifies the existing private project; no runtime bindings are configured. Source remains a normal local Git repository and can later be published on GitHub after licensing/documentation review.
