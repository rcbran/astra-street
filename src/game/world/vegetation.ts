import * as THREE from 'three';
import { Track, seeded } from '../tracks';
import type { Weather } from '../types';
import { instanced } from './geometry';
import { Landscape, terrainNoise } from './landscape';
import { coniferGeometry, grassClumpGeometry } from './conifer-geometry';

type Transforms = Parameters<typeof instanced>[2];
// Spatial batches let the camera and shadow frusta reject entire forest tiles.
function addTiles(
  root: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transforms: Transforms,
  cast: boolean,
  label: string,
) {
  if (!transforms.length) {
    geometry.dispose();
    return;
  }
  const tiles = new Map<string, Transforms>();
  for (const t of transforms) {
    const key = `${Math.floor(t.x / 220)}:${Math.floor(t.z / 220)}`;
    const bucket = tiles.get(key) ?? [];
    bucket.push(t);
    tiles.set(key, bucket);
  }
  for (const bucket of tiles.values()) {
    const batch = instanced(geometry, material, bucket, cast);
    batch.name = label;
    root.add(batch);
  }
}

export function buildTrees(
  root: THREE.Group,
  track: Track,
  weather: Weather,
  texture: THREE.Texture,
  conifers: THREE.Texture,
  landscape: Landscape,
) {
  const forest = landscape.forest,
    coastal = landscape.coastal,
    city = track.circuit.id === 'marina';
  const rand = seeded(forest ? 912 : city ? 78 : 443);
  const far: Transforms[] = [[], [], [], []],
    near: Transforms[] = [[], [], []],
    trunks: Transforms = [],
    grass: Transforms = [];
  let treeCount = 0,
    nearCount = 0;
  for (let i = 0; i < (forest ? 12500 : city ? 1800 : 9000); i++) {
    const f = track.sample(rand() * track.length);
    const side = rand() > 0.5 ? 1 : -1;
    const offset = side * (23 + Math.pow(rand(), 1.6) * (city ? 380 : 690));
    const x = f.x + f.nx * offset,
      z = f.z + f.nz * offset;
    const d = track.nearestDistance(x, z);
    if (d < 22 || (coastal && x > 465)) continue;
    if (city && d < 280) continue;
    // Clustered density leaves small meadows between mature forest stands.
    if (d > 80 && terrainNoise(x * 0.013, z * 0.013) < 0.26) continue;
    const y = landscape.height(x, z) - 0.1;
    if (y < -0.8 || y > (forest ? 390 : 240)) continue;
    const size = (forest ? 17 : 13) + rand() * 18;
    const kind =
      rand() < (forest ? 0.9 : 0.8)
        ? 2 + Math.floor(rand() * 2)
        : Math.floor(rand() * 2);
    const color = new THREE.Color().setHSL(
      0.22 + rand() * 0.09,
      0.06 + rand() * 0.12,
      0.67 + rand() * 0.25,
    );
    treeCount++;
    if (kind >= 2 && d < 100 && nearCount < 1500) {
      nearCount++;
      near[i % 3].push({
        x,
        y,
        z,
        ry: rand() * 6.28,
        sx: size * (0.8 + rand() * 0.25),
        sy: size,
        sz: size,
        color,
      });
      trunks.push({
        x,
        y,
        z,
        sx: size * 0.015,
        sy: size * 0.86,
        sz: size * 0.015,
      });
    } else {
      const s = size / (kind >= 2 ? 22 : 17);
      const t = { x, y, z, ry: rand() * 6.28, sx: s, sy: s, sz: s, color };
      far[kind].push(t, { ...t, ry: t.ry + Math.PI / 2 });
    }
  }
  if (nearCount > 0) {
    const foliageMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1,
      side: THREE.DoubleSide,
      envMapIntensity: 0.25,
    });
    near.forEach((trees, i) =>
      addTiles(
        root,
        coniferGeometry(42 + i * 17),
        foliageMaterial,
        trees,
        true,
        'solid roadside conifers',
      ),
    );
    const trunk = new THREE.CylinderGeometry(0.42, 1, 1, 7);
    trunk.translate(0, 0.5, 0);
    addTiles(
      root,
      trunk,
      new THREE.MeshStandardMaterial({ color: '#564633', roughness: 1 }),
      trunks,
      true,
      'tree trunks',
    );
  }
  const material = (map: THREE.Texture) =>
    new THREE.MeshStandardMaterial({
      map,
      alphaTest: 0.45,
      alphaToCoverage: true,
      side: THREE.DoubleSide,
      roughness: 1,
      color: weather === 'sunset' ? 0xb9baa3 : 0xb3bfa7,
      envMapIntensity: 0.25,
    });
  const materials = [material(texture), material(conifers)];
  const regions = [
    [0, 942 / 1774],
    [946 / 1774, 1],
    [0, 0.5],
    [0.5, 1],
  ];
  far.forEach((trees, kind) => {
    const pine = kind >= 2;
    const geometry = new THREE.PlaneGeometry(pine ? 12 : 13, pine ? 22 : 17);
    geometry.translate(0, pine ? 10.1 : 8.4, 0);
    const uv = geometry.getAttribute('uv'),
      [left, right] = regions[kind];
    for (let i = 0; i < uv.count; i++)
      uv.setX(i, left + uv.getX(i) * (right - left));
    addTiles(
      root,
      geometry,
      materials[pine ? 1 : 0],
      trees,
      false,
      'distant forest',
    );
  });
  for (let i = 0; i < (city ? 0 : 6500); i++) {
    const f = track.sample(rand() * track.length);
    const offset = (rand() > 0.5 ? 1 : -1) * (18 + rand() * 60);
    const x = f.x + f.nx * offset,
      z = f.z + f.nz * offset;
    if (track.nearestDistance(x, z) < 18 || (coastal && x > 465)) continue;
    const s = 0.8 + rand() * 1.8;
    grass.push({
      x,
      y: landscape.height(x, z),
      z,
      ry: rand() * 6.28,
      sx: s,
      sy: s,
      sz: s,
      color: new THREE.Color().setHSL(
        0.15 + rand() * 0.11,
        0.18 + rand() * 0.2,
        0.25 + rand() * 0.15,
      ),
    });
  }
  if (grass.length)
    addTiles(
      root,
      grassClumpGeometry(),
      new THREE.MeshStandardMaterial({
        color: '#bcc994',
        side: THREE.DoubleSide,
        roughness: 1,
      }),
      grass,
      false,
      'roadside undergrowth',
    );
  root.userData.treeCount = treeCount;
  root.userData.solidTreeCount = nearCount;
  root.userData.grassClumps = grass.length;
}
