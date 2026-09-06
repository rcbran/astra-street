# Project context

Updated 2026-09-05. **Implementation and publishing are paused at the user's request for a new-session handoff. Start with `docs/HANDOFF.md`.**

## Objective and preferences

Create a high-fidelity browser open-wheel racer inspired by screenshots of AAA F1 games from 2020 onward. Gameplay should be simple and fun, with several distinct environments/weather choices. Target 60 FPS without unnecessary laptop heat; user accepts 40–50 FPS while other agents use the GPU. Maintain modular, clear code suitable for an eventual public GitHub repository.

Use this checkout and native collaboration only. Do not use Orca orchestration. Every subagent, if explicitly delegated, must use GPT Astra (`gpt-6-astra`). Earlier documentation deferral was superseded by the user's request to update all docs and write a handoff before pausing.

## Current implementation

Astra Formula is playable with three original circuits, a detailed Blender-generated car, seven AI rivals, two-lap races, time trial, boost, automatic gears, chase/cockpit cameras, weather, synthesized sound, keyboard/gamepad/touch input, and a React racing UI. Architecture and disposal responsibilities are documented in `ARCHITECTURE.md`.

19 regression checks pass. Production build, TypeScript, owned-source lint and dependency audit pass. Three full production race runs measured a 60 FPS median over 384 seconds total; repeated track switches showed stable geometry/texture counts and no browser errors. Measurement conditions and caveats are in `PERFORMANCE.md`.

Actual keyboard/UI checks passed through driving, boost/braking, camera, reset, pause/resume, blur, restart, time trial and settings persistence. Portrait menu at 390×844 passed visibility/bounds checks. The same script fails at 844×390 because the start button is below the viewport; this is the first concrete follow-up.

The latest chase-camera translation fix passed regression/static/build checks but needs a new moving screenshot and short timing check. Overall scenery/material fidelity still falls short of the AAA visual reference. Do not treat the current playable build as the final visual result.

## Saved state

Source is committed on `main`; initial code commit `826ced8`. No GitHub remote, source push, saved Site version or deployment. `.openai/hosting.json` contains the one existing private Site ID. Use that project rather than creating another.

The local Codex CLI and private Site owner were verified as the user's personal account. Repository-only Git author settings use the personal email; global settings were left unchanged. No credentials were written into project files.

Local development/production servers and the dedicated test Chrome were stopped for handoff. The embedded preview's engine was disposed. Screenshots and complete raw timings remain in ignored `artifacts/` on this machine. Internal summaries, tests, code and runtime assets are committed. See `DEVELOPMENT.md` to restart.
