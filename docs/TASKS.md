# Task tracker

Updated 2026-09-05. Paused for handoff; the original fidelity goal remains open.

## Implemented and verified

- [x] Scaffold a modular TypeScript/React/Three.js application.
- [x] Original detailed car asset and editable Blender generator.
- [x] Riviera, Black Forest and Marina Bay circuits; clear/sunset/wet conditions.
- [x] Player driving, AI opponents, laps, boost, time trial, audio and input.
- [x] Menu, HUD, settings, pause/results and track maps.
- [x] Fixed simulation, frame caps, pixel budgets and sparse GPU timing.
- [x] Production build, strict TypeScript and owned-source lint.
- [x] 19 simulation, camera and frame-budget regression checks.
- [x] Full production races on all three default environments.
- [x] Three scene-resource cycles without measured growth.
- [x] Real keyboard driving, pause/blur, reset/restart, time trial and settings persistence.
- [x] Dependency audit: zero known vulnerabilities with current lockfile.
- [x] Personal account verification and repository-only Git author configuration.
- [x] Initial source commit, updated docs, handoff and clean process shutdown.

## Next, in order

1. [ ] Fix short landscape menu layout at 844×390. Start button is at y≈415, height 46. Keep the browser-check assertion.
2. [ ] Rerun `scripts/browser-check.mjs`; complete desktop/portrait/landscape checks. Test actual touch controls and a physical controller when available.
3. [ ] Capture/inspect moving chase view after the latest camera fix; check short-run timing and Retina/fullscreen render resolution.
4. [ ] Improve fidelity toward the F1 reference: terrain/horizon detail, building variety, roadside material wear, foliage variation and closer scenery composition. Evaluate screenshots honestly before adding expensive effects.
5. [ ] Review handling/fun through manual laps and tune only with evidence. The benchmark pilot is not a replacement for human feel.
6. [ ] Test all nine circuit/weather combinations and additional browsers/devices as practical.
7. [ ] Rerun affected checks after real changes, update evidence, and build the intended publish revision.
8. [ ] Resume private Sites publishing only after the user resumes work. Reuse the existing project; no deployment occurred before the pause.
9. [ ] Choose a source license and review public-repository contents before creating/publishing a GitHub remote.

## Known gaps

The game is a functional visual foundation, not AAA parity. No measured fan-RPM/package-power claim, physical-controller test, actual mobile-device test or cross-browser qualification exists yet. See `HANDOFF.md` for exact context and `PERFORMANCE.md` for measurement limitations.
