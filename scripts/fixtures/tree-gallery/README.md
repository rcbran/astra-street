# Static tree and undergrowth inspection

These tracked fixtures load the actual runtime tree/undergrowth modules through the development server. They create an isolated scene with controlled lighting and a single explicit render per requested view. Tree material clones retain the runtime shader callbacks, wind uniforms and custom depth materials. JavaScript fixtures keep test-only browser globals outside the application TypeScript build.

From the repository root, start the development server and dedicated headless launcher in separate terminals:

```sh
npm run dev -- --host 0.0.0.0
```

```sh
node scripts/launch-browser.mjs
```

Then capture all seven tree variants at all three LODs:

```sh
ASTRA_BASE_URL=http://localhost:3000 ASTRA_CDP=http://localhost:9224 ASTRA_ALL_LODS=1 ASTRA_OUTPUT=artifacts/tree-angle-check node scripts/tree-angle-check.mjs
```

Inspect groundcover separately:

```sh
ASTRA_GALLERY=undergrowth ASTRA_OUTPUT=artifacts/undergrowth-angle-check node scripts/tree-angle-check.mjs
```

The harness fulfills the HTML document from this folder because Vinext redirects `.html` paths. The fixture JavaScript and relative imports still pass through the actual Vite module pipeline. No old files in `artifacts/` are required. This check requires the development server; the production bundle does not expose source modules.

Reports, individual captures, contact sheets and an HTML gallery are written under `ASTRA_OUTPUT`. `ASTRA_TREE_SPECIES=fir_a,pine_a` limits the tree variants. Without `ASTRA_ALL_LODS=1`, only the near LOD is captured. `ASTRA_GALLERY_HTML` and `ASTRA_GALLERY_URL` remain optional custom-fixture overrides.

This is static shape/material evidence, not FPS or thermal evidence. The browser must be headless and report a hardware renderer. The harness owns and closes its context; it does not reuse launcher or personal browser pages.
