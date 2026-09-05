# Decisions

1. Use Three.js/WebGL2 for broad browser support and a small deployment. No Unreal installation: native engine rendering would not directly satisfy a portable low-power browser build.
2. Target a coherent art direction through materials, lighting, scenery density and camera composition. No ray tracing. One shadow-casting sun, static environment reflections, instanced scenery, fixed resolution ceiling, 60 Hz cap. Three.js manuals document shadow map multipass cost and object merging: https://threejs.org/manual/en/shadows.html and https://threejs.org/manual/en/optimize-lots-of-objects.html .
3. Original cars, fictional circuits and sponsor graphics. F1 23/24 screenshots used for research only in docs/references.
4. Arcade handling: automatic gears and track-aware steering assistance while retaining lateral/heading dynamics and off-track penalties. Short races and a rechargeable boost.
5. All native collaborators use GPT Astra. User explicitly disallowed Orca orchestration. Asset workers return outside-checkout deliverables; main agent integrates and owns the Site.
6. Keep source modular and public-repository friendly; defer public documentation. Preserve only concise internal project context and asset provenance while developing.
7. Balanced has a 1080p pixel ceiling, Eco 720p, Ultra 1440p. Sparse asynchronous GPU timer queries avoid forced GPU synchronization. Wet roads use a 640×360 planar reflection and one pooled tire-spray draw call.
8. User accepts 40–50 FPS under shared GPU contention. Adapt only below 42 FPS, cap at 60, stop rendering hidden tabs; no unmeasured claim about fan noise.
