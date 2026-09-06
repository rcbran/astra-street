# Astra Street

Read `docs/HANDOFF.md` first when resuming, then `docs/TASKS.md` and `docs/ARCHITECTURE.md`. The user resumed on the MacBook and explicitly pivoted to street racing on 2026-09-06. Continue the new direction; do not restore the F1 brief as the active target.

## User intent

Build a visually rich browser street racer with simple fun gameplay, drifting, nitro and several environments/weather choices. The active reference is the Street Heat video linked in `docs/STREET-DIRECTION.md`. Preserve the nominal 60 FPS target and the user’s accepted 40–50 FPS under shared GPU load. Treat the older AAA F1 brief as historical; do not claim the current build matches the new video.

Code must remain modular and clear for eventual public GitHub publication. The user initially deferred documentation, then explicitly requested the current documentation and handoff. Maintain concise accurate context at milestones.

## Collaboration

- Do not use Orca orchestration.
- Use a dedicated headless browser/profile for automation and captures; keep it off the user’s screen. Verify the GPU renderer and label headless timing separately.
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

This is the user's personal project. Repository Git identity is configured locally; do not change global configuration. Do not print or persist credentials. The personal GitHub repository is `rcbran/astra-street`, private by default, with remote `origin`. The private Site source is remote `sites`; check the handoff for release status. Public visibility and source-license selection remain pending. Reuse the project ID in `.openai/hosting.json`; never create a second Site on resumption.
