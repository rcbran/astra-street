# Decisions and constraints

1. **Browser-first renderer.** Use Three.js/WebGL2 inside the existing Sites/Vinext shell. Installing Unreal does not directly produce the portable, low-power browser experience requested. Blender is used for original assets; no Unreal or Photoshop installation was needed.

2. **Original content with licensed supporting scans.** Cars, layouts and sponsor marks are original. Poly Haven scans/HDR are CC0. F1 23/24 screenshots are visual research only, ignored by Git and excluded from the runtime build.

3. **Rendering budget before expensive effects.** Bound render resolution and frame rate; use instancing, merged geometry, alpha-tested foliage, PBR textures, a static prefiltered environment and one localized shadow light. Wet roads use a small planar-reflection target rather than ray tracing. Spray uses one fixed-capacity pool.

4. **Shared laptop tolerance.** The nominal target is 60 FPS, but the user accepts 40–50 while other GPU work runs. Adaptive resolution only reacts below 42 FPS. Menus run at 30, paused/results at 20, hidden tabs stop rendering. Do not infer quiet fans from a frame-rate counter.

5. **Approachable simulation.** Use a deterministic 120 Hz track-coordinate arcade model with steering assistance, automatic gears, short races and rechargeable boost. Keep simulation independent of React, rendering and audio. Preserve meaningful lateral steering/braking and off-track penalties.

6. **Modular ownership.** Engine composes the lifecycle; smaller modules own racing, camera, input/audio, materials, GPU timing, world elements and UI. Immutable GLTF geometry is shared; per-car effects/materials are owned and disposed separately. Never allow async asset callbacks to revive an old world.

7. **Native collaboration only.** User expressly prohibited Orca orchestration. All asset/review workers used GPT Astra. Future delegated agents must also use `gpt-6-astra`; main agent integrates source and owns Site operations. Temporary worker outputs are not runtime dependencies.

8. **Documentation timing.** The user initially deferred public docs, then explicitly requested all docs updated and a handoff before starting a new session. The current documentation describes the actual paused state, including remaining issues.

9. **Personal project identity.** Codex CLI and private Site ownership were verified against the personal account. The global Git author was the company address, so only this repository received a personal author override. Do not change global authentication or Git settings for this project.

10. **Publish state.** A single owner-private Site was registered early; it remains unpublished, with version count zero. No GitHub remote exists. Reuse `.openai/hosting.json` when work resumes. Credentials must remain ephemeral and outside source/configuration.

11. **Honest evidence.** Build success does not establish gameplay, high FPS does not establish visual fidelity, and a CPU submission time is not GPU time. The full-race measurements precede the last chase-camera correction. Record the tested revision and framebuffer size when adding evidence.

12. **Checkpoint recovery.** Codex's start-of-turn Git checkpoint was absent because the original folder was not a repository. A later internal checkpoint was present; Git integrity checks passed. Normal Git history was initialized with a project commit. The missing internal reference was not fabricated.
