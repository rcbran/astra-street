# Architecture

The React application owns menus and the HUD. An imperative Three.js engine owns the game loop and browser resources. Simulation is separated from rendering so racing rules can be checked without a canvas or audio context.

## Modules

| Area              | Entry                                                  | Responsibility                                                             |
| ----------------- | ------------------------------------------------------ | -------------------------------------------------------------------------- |
| Application shell | `app/page.tsx`, `src/ui/RacingGame.tsx`                | Mount engine, connect telemetry/settings/UI, handle load failures          |
| Engine            | `src/game/engine.ts`                                   | Compose subsystems, manage scene/session transitions and lifecycle         |
| Simulation        | `src/game/race-session.ts`                             | Player dynamics, AI, collisions, laps, boost, countdown and results        |
| Circuit data      | `src/game/tracks.ts`                                   | Layout definitions, arc-length track samples and local coordinate frames   |
| Frame budgets     | `src/game/render-loop.ts`                              | Render deadlines, measurements and adaptive pixel budget                   |
| Camera            | `src/game/camera.ts`                                   | Menu orbit, chase rig and attached cockpit viewpoint                       |
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

The engine advances `RaceSession` in fixed 1/120-second steps. Throttle, braking, drag, steering rate, yaw damping, off-track drag, barriers, and boost create approachable arcade handling. Assistance compensates for part of the track curvature; it does not eliminate steering. Rain lowers grip and braking force. Opponents choose a curvature-dependent target speed and adjust lanes around nearby cars.

A quick race ends after the player's second completed lap. The result position and all simulated drivers freeze. Time trials have no opponents and end through the HUD action. The benchmark pilot is test-only and must remain opt-in.

## State flow

`loading → menu → countdown → racing → finished`

`countdown` or `racing` can enter `paused`, which remembers the prior phase. Restart creates a fresh session; returning to circuits rebuilds the menu world. Browser blur/visibility handling clears held inputs and pauses an active race. Settings dialogs must not let global Enter/other shortcuts start or alter a race underneath them.

The HUD receives snapshots about ten times per second. High-frequency simulation and rendering stay outside React state.

## Camera contract

The GLB is Y-up with its nose along +Z. The cockpit eye is approximately `(0, 0.85, -0.20)` in car-local coordinates; the head group is hidden in cockpit mode. The cockpit must move with the chassis: world-space positional damping previously placed the eye inside the engine cover at speed.

The chase rig carries car translation before smoothing its relative pose. This avoids adding `speed / damping` meters to the chase distance. Both behaviors have regression checks. The latest chase correction has passed unit/build checks; a moving production screenshot and short timing check remain to be recorded.

## Resource ownership

- The engine owns the renderer, input/audio, resize observer, animation callback, HDR-derived environment target, loaded surface textures, shared car asset, current world, car visuals, and spray pool.
- The source GLB's geometry is immutable and shared by cloned cars. Each visual owns its cloned materials, contact-shadow resources, and brake-light geometry/material. Disposing one car must not dispose shared GLTF geometry.
- World builders own the geometry/materials/textures they create. Loaded road/grass/tree textures are shared and excluded from world disposal.
- Wet-road disposal explicitly releases its reflector target and geometry. Tree textures are preloaded; scene construction does not leave asynchronous callbacks capable of reviving disposed worlds.
- Track changes dispose the previous world/cars before replacing them. Engine disposal cancels animation, unregisters listeners, and releases shared resources.

Measured resource counts returned to the same values over three full track-switch cycles. See `docs/evidence/performance.json`.

## Rendering and power choices

WebGL2 uses ACES tone mapping, bounded pixel ratio, PBR surfaces, a prefiltered HDR environment, hemisphere fill, and one nearby directional shadow map. Scenery and spectators are instanced; repeated geometry is merged where useful. Vegetation uses alpha-tested crossed cards. Wet reflections use a 640×360 target with normal distortion and Fresnel blending; tire spray is one 384-particle draw call.

The frame scheduler retains deadlines across display refresh rates instead of quantizing 144 Hz down to 48 FPS. Resolution budgeting reacts to sustained low frame rates and recovers slowly. GPU timing samples every eighth render without `gl.finish()` or synchronous readback.

## Storage and hosting

Settings: `astra-settings-v1`. Best laps: `astra-best-v1:<circuit>:<weather>`. Settings are normalized before restoration. There is no backend save, multiplayer, telemetry upload, or external asset request during gameplay.

The Sites/Vinext scaffold builds a Cloudflare-compatible Worker plus static assets. `.openai/hosting.json` identifies the existing private project; no runtime bindings are configured. Source remains a normal local Git repository and can later be published on GitHub after licensing/documentation review.
