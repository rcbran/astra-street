# Session handoff — Astra Street

**Updated 2026-09-06. Read this first**, then `TASKS.md` and `ARCHITECTURE.md`. The user resumed on the MacBook, supplied the correct private Sites Git repository, shared a Street Heat video and explicitly said **“move toward street racing.”** The former implementation pause is over. Continue the street direction; do not restore the old F1 brief.

## Current state

- Checkout: `/Users/rcbranham/git/personal/f1-racing-astra`, Apple M4 Max, Node 24.19.0. The existing project and lockfile are preserved.
- `main` was fast-forwarded from `0269613` to `a711012` through the `sites` remote. The initially supplied unrelated GitHub repository was never merged.
- The product is now **Astra Street**: original S9 coupe, Canyon Run / Pinecrest / Harbor City, handbrake slip, drift smoke/skid marks, bankable chains, near-miss bonuses, speed checks and nitro. Two-lap AI races and unlimited time trial remain.
- Space: handbrake drift; W/A/S/D or arrows: drive/service brake; Shift: nitro. Gamepad and touch have dedicated drift controls. The alternate camera is bonnet view; its internal settings key remains `cockpit`.
- The video is reference material only. Original Blender car and generated rock/conifer textures are committed with provenance and exact image prompts in `STREET-DIRECTION.md`. No video frame is a runtime asset.
- This is a first playable interpretation. Car detail, cliff shapes, foliage depth, city composition and flat closed-circuit geometry remain simpler than the reference. Human handling feedback is still needed.

## Engineering and verification

Simulation, score rules, camera, render budgeting, world building and UI remain separate. Car geometry is immutable/shared. World resources, car effects, the 384-particle spray/smoke pool and 768-segment skid buffer have explicit ownership/disposal. Keep hidden-tab suspension, input clearing and frame/pixel caps. Street best laps use `astra-street-best-v1` so historical Formula records do not mix.

The inherited DPR listener missed rapid round-trips when Chrome coalesced media-query events. The render loop now checks the DPR scalar on accepted render frames; it reads layout only when a change occurs. Production resolution/quality/fullscreen checks passed after this fix.

- Strict typecheck, owned-source lint, **24 deterministic tests** and production build pass.
- Production keyboard/UI check passed, including actual handbrake/score, service braking and unobscured menus at five sizes.
- Nine route/weather worlds load/render; three repeated resource cycles return stable counts. This does not establish nine full-race completion or universal leak freedom.
- Emulated multi-touch simultaneously accelerates, steers and drifts, then releases all input. Portrait and landscape captures were inspected; the compact landscape HUD now clears the pedals and map. This is not physical-device evidence.
- Short visible M4 Max hardware samples are documented in `PERFORMANCE.md`. Read exact framebuffer sizes and limitations before quoting performance. The older full-race Formula and Linux SwiftShader reports are historical.
- Current portable evidence has `street-` prefixes under `docs/evidence/`. Raw captures remain ignored under `artifacts/`. Evidence gathered before committing honestly records parent `a711012` with a dirty working tree; it is not a benchmark of unchanged upstream source.

## Next refinements

1. User-drive the coupe and tune steering, countersteer/recovery and handbrake timing from feedback. The pilot proves behavior, not fun.
2. Refine canyon faces, varied roadside composition and coupe materials against the reference, judging moving chase views.
3. Improve Harbor City's silhouettes and lighting; consider a stronger street-route layout in a separate change.
4. Test a physical controller, touch devices and Safari. Extend to nine complete route/weather races as practical.
5. Choose a source license and review contents before public GitHub publication.

## Hosting and Git

Reuse `.openai/hosting.json` verbatim: `appgprj_6a9c96484ab081919378a4aa6684a3f3`. Never create a second Site.

- Remote: `sites`; branch: `main`.
- URL: `https://git.chatgpt-team.site/55cfd5d9-5d0c-44b9-9b4c-a37c7926c6a7/appgprj_6a9c96484ab081919378a4aa6684a3f3.git`.
- This is private Sites source Git. No public GitHub remote exists.
- Access was inspected: personal owner only, no groups or external viewers.
- Private deployment succeeded on 2026-09-06: https://astra-formula-racing.rbranham.chatgpt.site . The legacy URL slug is retained; the display title is Astra Street.
- Saved version 1 / deployed source: `9ba6a575977c0ba8bd102d2d7dc74a6a61adb051`. This follow-up documentation commit does not change the deployed application.
- Version ID: `appgprj_6a9c96484ab081919378a4aa6684a3f3~appgver_27e16fc33d44819191548586f014fc29`; deployment ID: `appgdep_6a9cc433ce1881918ee70dacd2d821f2`.
- The existing preview tab was navigated to the exact production URL and reached “Sign in required.” The personal owner must sign in. Local production gameplay was verified; authenticated hosted gameplay was not separately replayed.

Inspect local changes before fetching. Use a fresh repository-scoped Sites credential as a per-command HTTP header; never persist or print it. Keep repository-local personal author settings; do not change global Git configuration. Preserve the source lockfile.

## Running and stopping

```sh
npm run dev -- --host 0.0.0.0
npm run build
npm run start -- --port 8788
node scripts/launch-browser.mjs
```

A new build replaces `dist/`; restart the production server afterward. `DEVELOPMENT.md` documents browser, rendering, short hardware and touch checks. Use a dedicated visible Chrome and run heavy checks sequentially. Normal URLs do not expose the `?debug=1` diagnostic interface. Always clear pilots and held inputs afterward. Session-owned servers/browser are stopped after publishing; inspect current processes rather than reusing old IDs.

Do not use Orca. Do not delegate unless active instructions authorize it; every authorized worker must use `gpt-6-astra`. The Sites skill required one asset worker this session; it returned two generated PNGs outside the checkout and is finished. Only the owner integrated files and performed Site operations.
