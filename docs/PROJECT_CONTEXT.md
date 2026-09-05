# Astra Formula — project context

Updated: 2026-09-05

## Objective
A personal, high-fidelity browser open-wheel racer. AAA F1 2020+ screenshots are visual targets, not a claim that this prototype already matches them. Approachable controls, short races, three environments, different weather, and 60 FPS with restrained resource usage.

## Machine
MacBook Pro, Apple M4 Max (14 CPU / 32 GPU cores), 36 GB RAM, internal Retina display. Native physical pixels are expensive; Balanced caps render area near 1080p and renders at 60 Hz. No thermal claim without a sustained measurement.

## Scope and first implementation
Working title: ASTRA / FORMULA. Three fictional circuits: Riviera (coast / sunset), Black Forest (forest / daylight), and Marina (city / wet night). Keyboard and gamepad, automatic gearbox, two-lap sprint against seven opponents, time trial, boost, chase and cockpit cameras. Settings expose Balanced/Eco/Ultra and sound.

## Architecture
Sites/Vinext React shell; imperative Three.js WebGL2 game loop outside React. Fixed simulation steps; low-frequency HUD snapshots. Track-coordinate arcade model with heading/lateral dynamics. Swept track geometry with curbs, barriers, fencing, race furniture. Instancing and merged geometry, PBR asphalt, prefiltered static environment, one tight shadow light, atmospheric fog, inexpensive wet-surface lighting.

## Current state
Playable modular Three.js game implemented. Original Blender AF-27 GLB; three circuits, three weather choices, quick race/time trial, seven AI opponents, boost, sound, chase/cockpit cameras, touch/gamepad/keyboard input, pause/results/settings. React UI uses accessible shared primitives. Source modules split simulation, rendering, camera, vehicle, input/audio, world components and UI. Public documentation is deferred at the user's request.

Native Astra workers supplied the original Blender car, licensed/generated environment assets, and read-only code review. User explicitly prohibited Orca orchestration; do not use it. User accepts 40–50 FPS while other agents use this laptop GPU. Cap remains 60; adaptive resolution acts below 42 FPS. Menus 30, pause/results 20, hidden rendering off.

18 simulation/render-budget regression checks pass. Production build, strict TypeScript, owned-source lint, and dependency audit pass (zero known vulnerabilities). A moving cockpit camera lag bug and SVG-title hydration mismatch were fixed. Full production browser races and GPU-resource cycling are underway. Evidence is in ignored artifacts/; benchmark script is scripts/benchmark.mjs.

## Resuming
Read TASKS/DECISIONS/ASSETS. `npm run dev -- --host 0.0.0.0`; use the printed URL. `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`. Development browser debug interface is opt-in through `?debug=1`. A real visible Chrome process is used for performance timing; headless and background tabs are unsuitable. Publishing uses the existing private Site in .openai/hosting.json; never create a second Site. No GitHub remote has been created.
