# Tree/scenery migration evidence

Selected development captures and static geometry checks from the MacBook checkpoint, 2026-09-06. This is unfinished visual work. See [the handoff](../../HANDOFF.md) and [broadleaf diagnosis](../../BROADLEAF-DIAGNOSTIC.md).

- `forest-driving.png` and `canyon-driving.png`: short driving captures of the current scenery. White broadleaf crowns remain visible in Pinecrest. These are not production timing evidence.
- `tree-angle-report.json`, `undergrowth-angle-report.json`, `static-review.md` and the angle contact sheets: 434 tree views and 90 undergrowth views, controlled lighting on headless Chrome/ANGLE Metal M4 Max. Reports reference the full ignored capture collections; only selected sheets are committed. Regenerate all frames with the tracked gallery fixtures and `scripts/tree-angle-check.mjs`.
- `broadleaf-bleed-baseline.png` versus `broadleaf-no-mipmaps-diagnostic.png`: filtering experiment in a frozen world. The latter changes both min/mag filtering to nearest and disables mipmaps; it is a diagnostic, not an integrated fix. Those variables still need to be isolated.
- `runtime-leaf-map.png` and `broadleaf-texture-details.json`: runtime atlas dump and material metadata. Canvas export clears fully transparent RGB; the dump does not establish the original bytes of those pixels.
- `texture-reproduction.json`: the portable rock/ground pipelines reproduced all nine new texture files byte-for-byte from checksum-verified cached originals.
- `diagnostics/`: preserved investigation scripts plus the unchanged corrected authoring leaf PNG. Run scripts from the repository root with dev port 3000 and dedicated headless CDP port 9224. The known-PNG path was made relative for migration; the remaining script behavior is the worker's completed experiment. These are optional diagnostic artifacts, not runtime dependencies.

Reports identify a dirty working tree based on `b647678998da7707d0342905505d18f7a16c32af`; that parent SHA alone does not reproduce the captured source. The migration commit includes the measured changes. Static coverage, short captures and a 30-FPS HUD do not substitute for the pending production full-race and resource checks. Mini PC GPU timing must be measured separately.
