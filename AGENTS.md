# Astra Formula

Read `docs/HANDOFF.md` first when resuming, then `docs/TASKS.md` and `docs/ARCHITECTURE.md`. The latest user request was to pause implementation/publishing and prepare this handoff. Resume substantive work only when the new session asks to continue.

## User intent

Build a high-fidelity F1-style browser racing game with simple fun gameplay, several environments/weather choices, and a nominal 60 FPS target. The user accepts 40–50 FPS while other agents use the laptop GPU. Target the visual language of AAA F1 games from 2020 onward; do not claim the current build matches them.

Code must remain modular and clear for eventual public GitHub publication. The user initially deferred documentation, then explicitly requested the current documentation and handoff. Maintain concise accurate context at milestones.

## Collaboration

- Do not use Orca orchestration.
- Every delegated subagent MUST use GPT Astra (`gpt-6-astra`); never substitute another model.
- Main agent owns integration and Site operations. Asset workers return outside-checkout files for review/integration.
- Do not spawn agents unless the active user/developer instructions authorize delegation.

## Implementation

- Preserve the existing Sites/Vinext/Three.js project; do not re-scaffold.
- Keep simulation, render budgeting, camera, world building and UI separate.
- Track resource ownership and disposal. Share immutable car geometry; release owned car effects and world resources.
- Keep frame/pixel caps, hidden-tab suspension and blur input clearing.
- Use original graphics or documented licensed assets. Research screenshots are not runtime assets.
- Preserve the lockfile. Lint owns `src`, `app` and configuration; `components/ui` is the scaffold library.
- Run meaningful checks for changes; do not repeatedly benchmark without a relevant change.
- Maintain exact limitations alongside performance claims. See `docs/PERFORMANCE.md`.

## Identity and publishing

This is the user's personal project. Repository Git identity is configured locally; do not change global configuration. Do not print or persist credentials. No GitHub remote or deployed Site exists yet. Reuse the project ID in `.openai/hosting.json`; never create a second Site on resumption.
