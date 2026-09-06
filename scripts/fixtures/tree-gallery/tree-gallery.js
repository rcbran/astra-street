// Test-only scene: load exactly the game assets, with no product UI or animation loop.
import * as THREE from 'three';
import { loadTreeAssets } from '../../../src/game/world/tree-assets.ts';
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#b9c7d0');
const camera = new THREE.PerspectiveCamera(
  38,
  innerWidth / innerHeight,
  0.1,
  2000,
);
const hemi = new THREE.HemisphereLight('#d7ecff', '#6b7452', 0.78);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff5df', 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2000, 2000),
  new THREE.MeshStandardMaterial({ color: '#727b5a', roughness: 1 }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);
const assets = await loadTreeAssets();
// Gallery-only candidate: never changes the game's loaded species or LODs.
const distantBudget = Number(
  new URLSearchParams(location.search).get('distantBudget'),
);
if ([1800, 2400].includes(distantBudget)) {
  const { createDistantTree } =
    await import('../../../src/game/world/distant-tree-geometry.ts');
  for (const species of assets.species) {
    if (!/^(fir|pine)_/.test(species.id) || species.lods.length > 3) continue;
    const model = createDistantTree(species.lods[2], distantBudget);
    model.traverse((part) => {
      if (part instanceof THREE.Mesh) assets.geometries.add(part.geometry);
    });
    species.lods.push(model);
  }
}
assets.update(12, 1);
let model;
let bounds = new THREE.Box3();
let size = new THREE.Vector3();
let center = new THREE.Vector3();
let materials = [];
let identity = '';
function select(id, lod = 0) {
  if (model) scene.remove(model);
  materials.forEach((m) => m.dispose());
  materials = [];
  const species = assets.species.find((s) => s.id === id);
  if (!species || !species.lods[lod])
    throw new Error(`Missing tree ${id} LOD ${lod}`);
  model = species.lods[lod].clone(true);
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const source = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const copied = source.map((m) => {
      const copy = m.clone();
      // Three Material.clone deliberately omits program callbacks. Reuse the
      // runtime wind/transmission patch and cache key for an honest comparison.
      copy.onBeforeCompile = m.onBeforeCompile;
      copy.customProgramCacheKey = m.customProgramCacheKey;
      materials.push(copy);
      return copy;
    });
    object.material = Array.isArray(object.material) ? copied : copied[0];
    object.customDepthMaterial = assets.depthMaterials.get(source[0]);
    object.castShadow = true;
    object.receiveShadow = true;
  });
  scene.add(model);
  bounds.setFromObject(model);
  bounds.getSize(size);
  bounds.getCenter(center);
  model.position.y -= bounds.min.y;
  bounds.setFromObject(model);
  bounds.getCenter(center);
  identity = `${id} · LOD ${lod}`;
  const radius = Math.max(size.x, size.z, size.y) * 0.9;
  Object.assign(sun.shadow.camera, {
    left: -radius,
    right: radius,
    top: radius,
    bottom: -radius,
    near: 0.1,
    far: radius * 12,
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.position.set(center.x - radius * 2, radius * 3, center.z + radius * 2);
  sun.target.position.copy(center);
  const geometry = new Set();
  let triangles = 0;
  model.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      geometry.add(o.geometry);
      triangles +=
        (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    }
  });
  return {
    id,
    lod,
    bounds: {
      min: bounds.min.toArray(),
      max: bounds.max.toArray(),
      size: size.toArray(),
    },
    triangles,
    geometries: geometry.size,
    materials: materials.length,
  };
}
function frame(azimuth, elevation, silhouette = false, light = 'clear') {
  const angle = THREE.MathUtils.degToRad(azimuth);
  const pitch = THREE.MathUtils.degToRad(elevation);
  const distance =
    (Math.max(size.y, size.x * 1.15, size.z * 1.15) /
      (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) *
    1.3;
  camera.position.set(
    center.x + Math.sin(angle) * Math.cos(pitch) * distance,
    center.y + Math.sin(pitch) * distance,
    center.z + Math.cos(angle) * Math.cos(pitch) * distance,
  );
  camera.lookAt(center);
  if (silhouette) {
    scene.background = new THREE.Color('#ffffff');
    ground.visible = false;
    hemi.intensity = 0;
    sun.intensity = 0;
  } else {
    scene.background = new THREE.Color(
      light === 'sunset' ? '#d6b9a7' : light === 'rain' ? '#8a9caa' : '#b9c7d0',
    );
    ground.visible = true;
    hemi.intensity = light === 'rain' ? 1.05 : 0.78;
    sun.intensity = light === 'rain' ? 1.25 : light === 'sunset' ? 3.5 : 3.2;
    sun.color.set(
      light === 'rain' ? '#bdcfea' : light === 'sunset' ? '#ffdbc0' : '#fff5df',
    );
  }
  document.querySelector('#label').textContent =
    `${identity} · azimuth ${azimuth}° · elevation ${elevation}° · ${silhouette ? 'silhouette' : light}`;
  renderer.info.reset();
  renderer.render(scene, camera);
  let silhouetteCoverage;
  if (silhouette) {
    // Quantify the actual projected shape, not its 3D bounding box. The opaque
    // black mask retains alpha cutouts; the HTML caption is outside WebGL.
    const gl = renderer.getContext();
    const width = gl.drawingBufferWidth,
      height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let count = 0,
      minX = width,
      minY = height,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const offset = (y * width + x) * 4;
        if (pixels[offset] + pixels[offset + 1] + pixels[offset + 2] < 120) {
          count++;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    silhouetteCoverage = {
      pixels: count,
      fraction: count / (width * height),
      bounds: [minX, minY, maxX, maxY],
    };
  }
  return {
    at: new Date().toISOString(),
    monotonicMs: performance.now(),
    azimuth,
    elevation,
    silhouette,
    light,
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    silhouetteCoverage,
  };
}
const gl = renderer.getContext();
const ext = gl.getExtension('WEBGL_debug_renderer_info');
const api = {
  species: assets.species.map((s) => ({ id: s.id, lods: s.lods.length })),
  graphics: {
    renderer: ext
      ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER),
    userAgent: navigator.userAgent,
    captureMode: /HeadlessChrome/.test(navigator.userAgent)
      ? 'headless'
      : 'visible',
    viewport: [innerWidth, innerHeight],
    framebuffer: renderer.getDrawingBufferSize(new THREE.Vector2()).toArray(),
  },
  select,
  frame,
  dispose() {
    if (model) scene.remove(model);
    materials.forEach((m) => m.dispose());
    ground.geometry.dispose();
    ground.material.dispose();
    assets.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  },
};
window.__TREE_QA__ = api;
