# Astra Street

An original arcade street racer for the browser. Drive the Astra S9 through coastal canyons, mountain forests and wet city streets. Handbrake drifts, rechargeable nitro, near-miss bonuses and speed checks reward clean racing. Built with TypeScript, React and Three.js.

**Status:** playable street racer; an in-progress migration checkpoint adds full 3D trees and richer natural scenery, inspired by the user’s [Street Heat video reference](https://x.com/higgsfield_ai/status/2095916820431827408). Scenery and handling remain work in progress; this does not claim visual parity. Read [the handoff](docs/HANDOFF.md) and [visual direction](docs/STREET-DIRECTION.md).

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

No account, API key, or external service is required for local gameplay. Runtime assets are served from this repository. The [private playable build](https://astra-formula-racing.rbranham.chatgpt.site) requires the personal owner to sign in. The existing Sites project is reused; see the handoff for deployed source and publishing status. Source is also available in the personal private [GitHub repository](https://github.com/rcbran/astra-street). Public visibility remains a separate choice.

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

Rendering is capped at **30 FPS** during racing and menus, and 20 when paused or finished. The user chose more detailed graphics over the previous 60 FPS target. Hidden tabs stop rendering. Balanced caps internal resolution near 1080p; Eco uses a 720p budget and Ultra 1440p. Balanced/Eco reduce resolution only after sustained samples below 25 FPS and recover slowly near 30.

Seven CC0 fir, pine and broadleaf variants use full 3D branching and foliage at all three distance levels. Shared assets, spatial instancing and distance selection keep dense forests bounded. Curved grass, ferns, shrubs, scanned rock surfaces and road furniture add detail around the routes. See [asset provenance](docs/ASSETS.md) and [performance evidence and limits](docs/PERFORMANCE.md). Historical 60 FPS measurements describe earlier, simpler scenery; they do not describe this tree overhaul.

## Project guide

- [Frame comparison and visual changes](docs/FRAME-COMPARISON.md)
- [Handoff and next actions](docs/HANDOFF.md)
- [Architecture and resource ownership](docs/ARCHITECTURE.md)
- [Development and verification](docs/DEVELOPMENT.md)
- [Asset provenance](docs/ASSETS.md)
- [Task tracker](docs/TASKS.md)
- [Decisions and constraints](docs/DECISIONS.md)

Third-party runtime scans/HDR lighting are CC0; see [asset notices](public/assets/NOTICE.txt). A repository-wide source license has not yet been selected. The GitHub repository is private; public visibility and source licensing remain pending.
