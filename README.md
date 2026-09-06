# Astra Formula

An original open-wheel racing game for the browser. Three fictional circuits, seven AI rivals, two-lap sprints, and a time-trial mode. Built with TypeScript, React, and Three.js.

**Status:** playable and locally tested; still a work in progress. F1 games released since 2020 are the visual reference. The current scenery and material detail do not yet match AAA fidelity. Development is paused for a session handoff. Read [the handoff](docs/HANDOFF.md) before continuing.

## Run locally

Requires Node.js 22.13 or newer and a browser with WebGL2. Chrome was used for validation on an Apple M4 Max.

```sh
npm ci
npm run dev -- --host 0.0.0.0
```

Open the URL printed by the server, normally `http://localhost:3000`.

To run the production build locally:

```sh
npm run build
npm run start -- --port 8788
```

No account, API key, or external service is required for local gameplay. Runtime assets are served from this repository. A private Sites project has been registered, but nothing has been deployed. No GitHub remote exists yet.

## Play

Choose a circuit and conditions, then press **Go racing** or **Enter**. Quick races last two laps; time trials continue until you finish the session. Gears are automatic. Steering assistance is enabled by default. Boost drains a rechargeable battery; braking helps replenish it.

| Action         | Keyboard      | Controller |
| -------------- | ------------- | ---------- |
| Accelerate     | W / ↑         | RT         |
| Brake          | S / ↓ / Space | LT         |
| Steer          | A / D / ← / → | Left stick |
| Overtake boost | Shift         | A          |
| Change camera  | C             | Y          |
| Reset to track | R             | X          |
| Pause          | Escape / P    | Start      |
| Mute           | M             | —          |

Touch controls are implemented for coarse-pointer devices, but actual touch-device testing is pending. A short landscape menu layout issue is also open. Controller mappings are implemented; a physical controller has not been tested.

| Circuit      | Setting             | Length  | Default conditions |
| ------------ | ------------------- | ------- | ------------------ |
| Riviera      | Mediterranean coast | 2.84 km | Golden hour        |
| Black Forest | German highlands    | 3.43 km | Clear sky          |
| Marina Bay   | Pacific metropolis  | 3.10 km | Wet night          |

All three conditions can be selected on each circuit. Layouts, car design, livery, and sponsor names are original; the game is not affiliated with Formula 1 or its teams.

## Performance

Rendering is capped at 60 FPS during racing, 30 in menus, and 20 when paused or finished. Hidden tabs stop rendering. Balanced caps internal resolution near 1080p; Eco uses a 720p budget and Ultra 1440p. Balanced/Eco can reduce resolution below 42 FPS, preserving visual quality during the user's accepted 40–50 FPS shared-GPU conditions.

Three complete production-build races held a 60 FPS median on the development laptop. These measurements used a 1440×900 drawing buffer and do not establish the same performance on every device. See [performance evidence and limits](docs/PERFORMANCE.md).

## Project guide

- [Handoff and next actions](docs/HANDOFF.md)
- [Architecture and resource ownership](docs/ARCHITECTURE.md)
- [Development and verification](docs/DEVELOPMENT.md)
- [Asset provenance](docs/ASSETS.md)
- [Task tracker](docs/TASKS.md)
- [Decisions and constraints](docs/DECISIONS.md)

Third-party runtime scans/HDR lighting are CC0; see [asset notices](public/assets/NOTICE.txt). A repository-wide source license has not yet been selected. Public GitHub publication and licensing remain pending.
