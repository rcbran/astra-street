# Astra Formula project

## User intent
Build a high-fidelity F1-style browser racing game here. Target the visual language of AAA F1 games from 2020 onward, with simple fun gameplay, multiple environments and weather, and a measured 60 FPS target without unnecessary heat/fan load. User authorizes implementation, asset acquisition, local applications, testing and iterative improvements. All subagents MUST use GPT Astra (`gpt-6-astra`); do not substitute another model.

## Continuity
Read `docs/PROJECT_CONTEXT.md`, `docs/TASKS.md`, and `docs/DECISIONS.md` before substantial work. Update these at milestones and before ending a session. Evidence and actual measurements go in `docs/evidence/`. Never claim AAA parity or stable 60 FPS without evidence.

## Working rules
- Main agent owns integration and project source. Keep resource loading/disposal correct.
- Preserve a immediately playable local build. Use the existing Sites/Vinext scaffold.
- Original circuit names/liveries; references are visual research, not game assets.
- Cap frame rate and internal render resolution; pause on blur/hidden; avoid unbounded devicePixelRatio.
- Record third-party assets and licenses in `docs/ASSETS.md`.
- Test real driving, race state, track switching, weather and frame pacing. Do not rely only on compilation.
