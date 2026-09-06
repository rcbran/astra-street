# Astra Street

An original arcade street racer for the browser. Drive the Astra S9 through coastal canyons, mountain forests and wet city streets. Handbrake drifts, rechargeable nitro, near-miss bonuses and speed checks reward clean racing. Built with TypeScript, React and Three.js.

**Status:** first playable street-racing pass, inspired by the user’s [Street Heat video reference](https://x.com/higgsfield_ai/status/2095916820431827408). Scenery and handling remain work in progress; this does not claim visual parity. Read [the handoff](docs/HANDOFF.md) and [visual direction](docs/STREET-DIRECTION.md).

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

No account, API key, or external service is required for local gameplay. Runtime assets are served from this repository. The existing owner-private Sites project is reused. See the handoff for publishing status. Source transfer uses its private Git repository; public GitHub publication remains pending.

## Play

Choose a circuit and conditions, then press **Go racing** or **Enter**. Quick races last two laps; time trials continue until you finish the session. Gears are automatic. Steering assistance is enabled by default. Nitro drains a rechargeable charge; braking helps replenish it. Hold Space while steering at speed to slide. Link drifts and bonuses to build a chain, then drive cleanly for two seconds to bank it. Contact or leaving the road loses unbanked points. Finish banks the remaining clean chain.

| Action          | Keyboard      | Controller |
| --------------- | ------------- | ---------- |
| Accelerate      | W / ↑         | RT         |
| Brake           | S / ↓         | LT         |
| Handbrake drift | Space + steer | B + stick  |
| Steer           | A / D / ← / → | Left stick |
| Nitro           | Shift         | A          |
| Change camera   | C             | Y          |
| Reset to track  | R             | X          |
| Pause           | Escape / P    | Start      |
| Mute            | M             | —          |

Touch controls are implemented for coarse-pointer devices, but actual touch-device testing is pending. Controller mappings are implemented; a physical controller has not been tested.

| Circuit     | Setting          | Length  | Default conditions |
| ----------- | ---------------- | ------- | ------------------ |
| Canyon Run  | Coastal canyon   | 2.84 km | Golden hour        |
| Pinecrest   | Highland pass    | 3.43 km | Clear sky          |
| Harbor City | Downtown streets | 3.10 km | Wet night          |

All three conditions can be selected on each circuit. Layouts, car design, livery, and sponsor names are original; the game is not affiliated with Formula 1 or its teams.

## Performance

Rendering is capped at 60 FPS during racing, 30 in menus, and 20 when paused or finished. Hidden tabs stop rendering. Balanced caps internal resolution near 1080p; Eco uses a 720p budget and Ultra 1440p. Balanced/Eco can reduce resolution below 42 FPS, preserving visual quality during the user's accepted 40–50 FPS shared-GPU conditions.

The current street build held a 60 FPS median in short 25-second samples on each default route at a measured 1821×1138 drawing buffer on the M4 Max. These are automated pilot samples, not full-race or thermal measurements. Historical Formula results are recorded separately. See [performance evidence and limits](docs/PERFORMANCE.md).

## Project guide

- [Handoff and next actions](docs/HANDOFF.md)
- [Architecture and resource ownership](docs/ARCHITECTURE.md)
- [Development and verification](docs/DEVELOPMENT.md)
- [Asset provenance](docs/ASSETS.md)
- [Task tracker](docs/TASKS.md)
- [Decisions and constraints](docs/DECISIONS.md)

Third-party runtime scans/HDR lighting are CC0; see [asset notices](public/assets/NOTICE.txt). A repository-wide source license has not yet been selected. Public GitHub publication and licensing remain pending.
