import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const out = 'artifacts/broadleaf-texture-diagnosis';
await mkdir(out, { recursive: true });
const browser = await chromium.connectOverCDP('http://localhost:9224');
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.setDefaultTimeout(120000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  await page.route('**/__qa_leaf.png', (r) =>
    r.fulfill({
      path: fileURLToPath(new URL('./known-leaf-source.png', import.meta.url)),
      contentType: 'image/png',
    }),
  );
  await page.goto('http://localhost:3000/?debug=1');
  await page.waitForFunction(() => window.__ASTRA__?.phase === 'menu');
  await page
    .locator('.circuit-option')
    .filter({ hasText: 'Pinecrest' })
    .click();
  await page.waitForFunction(
    () =>
      window.__ASTRA__.options.circuit === 'forest' &&
      window.__ASTRA__.phase === 'menu',
  );
  await page.getByRole('button', { name: 'GO RACING', exact: true }).click();
  await page.waitForFunction(() => window.__ASTRA__.phase === 'racing');
  await page.evaluate(() => {
    window.__pilot = setInterval(() => window.__ASTRA__.debugDrive(true), 25);
  });
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const e = window.__ASTRA__;
    clearInterval(window.__pilot);
    e.debugDrive(false);
    e.input.clear();
    cancelAnimationFrame(e.animation);
  });
  await page.screenshot({ path: `${out}/baseline.png` });
  const details = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js');
    const e = window.__ASTRA__;
    const list = [];
    e.world.root.traverse((o) => {
      if (o.isInstancedMesh && o.name.startsWith('broadleaf')) list.push(o);
    });
    const fixed = await new T.TextureLoader().loadAsync('/__qa_leaf.png');
    window.__LEAF_DIAG__ = { T, list, fixed };
    const mats = [...new Set(list.map((o) => o.material))];
    return {
      camera: e.camera.position.toArray(),
      materials: mats.map((m) => ({
        uuid: m.uuid,
        name: m.name,
        type: m.type,
        color: m.color.toArray(),
        emissive: m.emissive?.toArray(),
        roughness: m.roughness,
        metalness: m.metalness,
        envMapIntensity: m.envMapIntensity,
        alphaTest: m.alphaTest,
        transparent: m.transparent,
        side: m.side,
        map: m.map && {
          uuid: m.map.uuid,
          name: m.map.name,
          colorSpace: m.map.colorSpace,
          channel: m.map.channel,
          flipY: m.map.flipY,
          repeat: m.map.repeat.toArray(),
          offset: m.map.offset.toArray(),
          matrix: m.map.matrix.toArray(),
          minFilter: m.map.minFilter,
          premultiplyAlpha: m.map.premultiplyAlpha,
          imageSize: [m.map.image.width, m.map.image.height],
        },
        normal: m.normalMap?.uuid,
        normalScale: m.normalScale?.toArray(),
        userData: m.userData,
      })),
      meshes: list
        .filter((o) => o.visible)
        .map((o) => ({
          name: o.name,
          count: o.count,
          mat: o.material.uuid,
          attributes: Object.keys(o.geometry.attributes),
        })),
    };
  });
  await writeFile(`${out}/details.json`, JSON.stringify(details, null, 2));
  const textureData = await page.evaluate(() => {
    const m = window.__LEAF_DIAG__.list.find(
      (o) => o.material.alphaTest,
    ).material;
    const c = document.createElement('canvas');
    c.width = m.map.image.width;
    c.height = m.map.image.height;
    c.getContext('2d').drawImage(m.map.image, 0, 0);
    return c.toDataURL('image/png').split(',')[1];
  });
  await writeFile(
    `${out}/runtime-leaf-map.png`,
    Buffer.from(textureData, 'base64'),
  );
  for (const mode of [
    'knownTexture',
    'identityUV',
    'noFog',
    'noMipmaps',
    'basicNoFog',
  ]) {
    await page.evaluate((mode) => {
      const e = window.__ASTRA__,
        { T, list, fixed } = window.__LEAF_DIAG__;
      for (const o of list) {
        if (!o.userData.originalMat) o.userData.originalMat = o.material;
        o.material = o.userData.originalMat;
      }
      const mapping = new Map();
      for (const o of list) {
        const source = o.material;
        if (!source.alphaTest) continue;
        if (mapping.has(source)) {
          o.material = mapping.get(source);
          continue;
        }
        let m = source.clone();
        m.onBeforeCompile = source.onBeforeCompile;
        m.customProgramCacheKey = source.customProgramCacheKey;
        if (mode === 'noEnvironment') {
          m.envMapIntensity = 0;
        }
        if (mode === 'noTransmission') {
          m.onBeforeCompile = () => {};
          m.customProgramCacheKey = () => 'diag-no-transmission';
        }
        if (mode === 'noNormal') m.normalMap = null;
        if (mode === 'constantGreen') {
          m.map = null;
          m.alphaMap = null;
          m.alphaTest = 0;
          m.color.set('#14521b');
        }
        if (mode === 'basicMap')
          m = new T.MeshBasicMaterial({
            map: source.map,
            side: T.DoubleSide,
            alphaTest: source.alphaTest,
          });
        if (mode === 'noVertexColor') {
          m.vertexColors = false;
        }
        if (mode === 'knownTexture') {
          fixed.colorSpace = source.map.colorSpace;
          fixed.flipY = false;
          fixed.anisotropy = source.map.anisotropy;
          fixed.needsUpdate = true;
          m.map = fixed;
        }
        if (mode === 'identityUV') {
          m.map = source.map.clone();
          m.map.repeat.set(1, 1);
          m.map.offset.set(0, 0);
          m.map.rotation = 0;
          m.map.updateMatrix();
          m.map.needsUpdate = true;
        }
        if (mode === 'noFog') m.fog = false;
        if (mode === 'noMipmaps') {
          m.map = source.map.clone();
          m.map.minFilter = T.NearestFilter;
          m.map.magFilter = T.NearestFilter;
          m.map.generateMipmaps = false;
          m.map.needsUpdate = true;
        }
        if (mode === 'basicNoFog')
          m = new T.MeshBasicMaterial({
            map: source.map,
            side: T.DoubleSide,
            alphaTest: source.alphaTest,
            fog: false,
          });
        m.needsUpdate = true;
        mapping.set(source, m);
        o.material = m;
      }
      e.renderer.render(e.scene, e.camera);
    }, mode);
    await page.screenshot({ path: `${out}/${mode}.png` });
  }
  await writeFile(`${out}/errors.json`, JSON.stringify(errors));
} finally {
  await page
    .evaluate(() => {
      clearInterval(window.__pilot);
      window.__ASTRA__?.debugDrive(false);
    })
    .catch(() => {});
  await context.close();
  await browser.close();
}
