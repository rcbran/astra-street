# Task tracker

Updated 2026-09-06. Paused for a Git push and MacBook handoff; the original fidelity goal remains open.

## Implemented and verified

- [x] Modular TypeScript/React/Three.js application, original car and three circuits.
- [x] Racing against seven AI cars, time trial, boost, audio, menus and input mappings.
- [x] Fixed simulation, frame caps, adaptive pixel budgets, hidden-tab suspension and disposal.
- [x] Production build, strict TypeScript, lint and 19 deterministic regression checks.
- [x] Historical full production races on all three default environments on M4 Max.
- [x] Fixed 844×390 landscape menu, including header/tab overlap found in screenshot review.
- [x] Reproduced and fixed DPR-only changes; quality budgets and fullscreen verified in Chromium.
- [x] Inspected the moving chase view after its translation fix; software timing recorded separately.
- [x] First roadside material refinement: concrete wear/grime and textured painted runoff.
- [x] Loaded/rendered all nine circuit/weather worlds, with stable resources across three cycles.
- [x] Updated development setup for Linux without a rendering GPU; kept the lockfile intact.

## Next, in order

1. [x] Final production keyboard/UI check passed: all five viewports, obstruction assertions and zero page errors; evidence saved.
2. [ ] On the MacBook, verify the corrected menu/DPR in visible Chrome and take a short hardware timing sample. Site deployment is paused until the user resumes it.
3. [ ] Continue fidelity work: terrain/horizon, building variety, foliage variation and coastal detail. Judge moving views before increasing cost.
4. [ ] Review handling/fun through human laps; tune only with evidence.
5. [ ] Resume private Sites publishing only after the user resumes work; reuse the existing project. No version/deployment has been created.
6. [ ] Nine complete circuit/weather races and additional browsers/devices as practical. The current nine-world check is a load/render smoke test.
7. [ ] Test actual touch controls and a physical controller when available.
8. [ ] Choose a source license and review public-repository contents before creating/publishing GitHub.

## Known gaps

The game is a playable visual foundation, not AAA parity. No measured fan-RPM/package-power claim, physical-controller test, actual mobile-device test or cross-browser qualification exists. See `HANDOFF.md` and `PERFORMANCE.md` for exact context and limits.
