import * as THREE from 'three';
import { Track, seeded } from '../tracks';
import type { Weather } from '../types';
import { instanced } from './geometry';
import { Landscape, terrainNoise } from './landscape';
import { buildCanyonRockFormations } from './canyon-rock';

type Transform = Parameters<typeof instanced>[2][number];

// Fractured sandstone walls use an angular plan, undercut beds and a broken
// rim. The roof closes across an irregular plateau rather than a round dome.
function cliffGeometry(seed: number) {
  const rand = seeded(seed),
    sides = 64,
    beds = 8;
  const positions: number[] = [],
    colors: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const phase = rand() * 25;
  const leanX = (rand() - 0.5) * 0.14,
    leanZ = (rand() - 0.5) * 0.14;
  // Polygon corners, interpolated in Cartesian space, make broad planes with
  // discrete joints instead of a rippled cylindrical surface.
  const corners = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    const radius = 0.43 + rand() * 0.16;
    return { x: Math.cos(a) * radius, z: Math.sin(a) * radius };
  });
  const rings: { t: number; shelf: number; roof: number }[] = [];
  const thicknesses = Array.from({ length: beds }, () => 0.5 + rand() * 1.5);
  const thicknessSum = thicknesses.reduce((a, b) => a + b, 0);
  let height = 0,
    retreat = 0;
  for (let bed = 0; bed < beds; bed++) {
    const thickness = thicknesses[bed] / thicknessSum;
    const ledge = 0.009 + rand() * 0.012;
    rings.push({ t: height, shelf: -retreat + ledge, roof: 1 });
    rings.push({ t: height + 0.008, shelf: -retreat - ledge, roof: 1 });
    rings.push({
      t: height + thickness - 0.008,
      shelf: -retreat - 0.003,
      roof: 1,
    });
    height += thickness;
    // Two larger bedding breaks make real horizontal walkable-width terraces.
    if (bed === 2 || bed === 5) retreat += 0.075 + rand() * 0.035;
  }
  rings.push({ t: 1, shelf: -retreat, roof: 1 });
  for (const roof of [0.8, 0.6, 0.4, 0.2, 0])
    rings.push({ t: 1, shelf: -retreat, roof });
  for (const ring of rings) {
    const t = ring.t;
    for (let side = 0; side <= sides; side++) {
      const a = (side / sides) * Math.PI * 2;
      const ca = Math.cos(a),
        sa = Math.sin(a);
      const section = (side / sides) * corners.length;
      const index = Math.floor(section) % corners.length;
      const next = (index + 1) % corners.length;
      const f = section - Math.floor(section);
      const px = THREE.MathUtils.lerp(corners[index].x, corners[next].x, f);
      const pz = THREE.MathUtils.lerp(corners[index].z, corners[next].z, f);
      const fissure =
        Math.max(0, Math.sin(a * 5 + phase + Math.sin(t * 3 + phase) * 0.13)) **
        12;
      const chip = terrainNoise(
        ca * 8 + phase,
        sa * 8 + Math.floor(t * beds) * 1.2,
      );
      const taper =
        1.0 - t * 0.1 + (1 - THREE.MathUtils.smoothstep(t, 0, 0.24)) * 0.16;
      const radius =
        (taper +
          ring.shelf -
          fissure * 0.045 -
          Math.max(0, chip - 0.62) * 0.22) *
        ring.roof;
      const brokenRim =
        (terrainNoise(px * ring.roof * 5 + phase, pz * ring.roof * 5) - 0.5) *
        0.18;
      const beddingTilt = (ca * 0.018 + sa * 0.025) * ring.roof;
      positions.push(
        px * radius + t * leanX,
        t * (1 + brokenRim) + beddingTilt,
        pz * radius + t * leanZ,
      );
      uvs.push((side / sides) * 8, t * 12);
      const strata =
        0.84 + terrainNoise(Math.floor(t * beds) * 2.9, phase) * 0.18;
      const mineral = terrainNoise(ca * 4 + phase, t * 15 + sa * 4);
      const c = new THREE.Color('#c7b9a5').lerp(
        new THREE.Color('#8c8c7d'),
        THREE.MathUtils.smoothstep(mineral, 0.55, 0.85) * 0.35,
      );
      c.multiplyScalar(
        strata * (1 - fissure * 0.2) * (ring.shelf < -0.01 ? 0.83 : 1),
      );
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let y = 0; y < rings.length - 1; y++)
    for (let x = 0; x < sides; x++) {
      const a = y * (sides + 1) + x,
        b = a + sides + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// Tumbled talus has its own geometry: a short cliff scaled down still looks like
// a miniature cliff. Rounded fractured boulders ground the wall in its hillside.
function boulderGeometry(seed: number) {
  const geometry = new THREE.IcosahedronGeometry(0.6, 3);
  const p = geometry.getAttribute('position');
  const colors: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const n = terrainNoise(x * 6 + seed, z * 6 + y * 3);
    const r = 0.85 + n * 0.3;
    p.setXYZ(i, x * r, y * r * 0.76 + 0.3, z * r);
    const c = new THREE.Color('#b9b5a6').multiplyScalar(0.8 + n * 0.3);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function addTiles(
  root: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transforms: Transform[],
  label: string,
) {
  const tiles = new Map<string, Transform[]>();
  for (const t of transforms) {
    const key = `${Math.floor(t.x / 300)},${Math.floor(t.z / 300)}`;
    const tile = tiles.get(key) ?? [];
    tile.push(t);
    tiles.set(key, tile);
  }
  for (const transforms of tiles.values()) {
    const batch = instanced(geometry, material, transforms, true);
    batch.name = label;
    root.add(batch);
  }
}

export function buildRockFormations(
  root: THREE.Group,
  track: Track,
  weather: Weather,
  textures: {
    color: THREE.Texture;
    normal: THREE.Texture;
    rough: THREE.Texture;
  },
  landscape: Landscape,
) {
  if (track.circuit.id === 'marina') return;
  if (track.circuit.id === 'riviera') {
    buildCanyonRockFormations(root, track, weather, textures, landscape);
    return;
  }
  const coastal = landscape.coastal,
    rand = seeded(coastal ? 842 : 247);
  const material = new THREE.MeshStandardMaterial({
    map: textures.color,
    normalMap: textures.normal,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: textures.rough,
    vertexColors: true,
    color: coastal ? 0xf3eade : 0xc9d4c7,
    roughness: weather === 'rain' ? 0.83 : 0.98,
    envMapIntensity: 0.2,
  });
  const walls: Transform[][] = Array.from({ length: 8 }, () => []);
  const talus: Transform[][] = Array.from({ length: 4 }, () => []);
  // Clusters alternate enclosed rock cuts with forest glades. Scale varies more
  // in width than height, avoiding a row of identical upright pillars.
  for (let at = 0; at < track.length; at += coastal ? 62 : 115)
    for (const side of [-1, 1]) {
      const f = track.sample(at + rand() * 35);
      const exposure = terrainNoise(f.x * 0.006 + side * 10, f.z * 0.006);
      if (exposure < (coastal ? 0.28 : 0.47)) continue;
      const width = 95 + rand() * 90;
      const setback = 55 + width * 0.82 + rand() * (coastal ? 55 : 105);
      const x = f.x + f.nx * side * setback,
        z = f.z + f.nz * side * setback;
      if (
        track.nearestDistance(x, z) < width * 1.02 + 30 ||
        (coastal && x + width * 1.02 > 490)
      )
        continue;
      const height = Math.min(
        width * 0.78,
        (coastal ? 58 : 34) + rand() * (coastal ? 78 : 57),
      );
      const group = Math.floor(rand() * walls.length);
      const base = landscape.height(x, z) - 18;
      landscape.registerVegetationObstacle(x, z, width * 1.02);
      walls[group].push({
        x,
        y: base,
        z,
        ry: f.heading + (rand() - 0.5) * 0.24,
        sx: width * 0.72,
        sy: height,
        sz: width * (1.12 + rand() * 0.13),
        color: new THREE.Color().setHSL(
          coastal ? 0.09 : 0.12,
          0.035 + rand() * 0.06,
          0.82 + rand() * 0.16,
        ),
      });
      for (let rib = 0; rib < 3; rib++) {
        const along = (rib - 1) * width * 0.4;
        const bx = x - f.nx * side * width * 0.22 + f.tx * along;
        const bz = z - f.nz * side * width * 0.22 + f.tz * along;
        const w = width * (0.52 + rand() * 0.16);
        if (track.nearestDistance(bx, bz) < w * 0.95 + 26) continue;
        landscape.registerVegetationObstacle(bx, bz, w * 0.95);
        walls[(group + rib + 1) % walls.length].push({
          x: bx,
          y: landscape.height(bx, bz) - 12,
          z: bz,
          ry: f.heading + (rand() - 0.5) * 0.2,
          rz: (rand() - 0.5) * 0.13,
          sx: w,
          sy: height * (0.25 + rand() * 0.29),
          sz: w * 1.2,
          color: new THREE.Color(0xd4cfc0),
        });
      }
      for (let j = 0; j < 22; j++) {
        const a = rand() * Math.PI * 2;
        const bx = x + Math.cos(a) * width * (0.42 + rand() * 0.35);
        const bz = z + Math.sin(a) * width * (0.42 + rand() * 0.35);
        const s = 2.5 + rand() ** 2 * 18;
        if (track.nearestDistance(bx, bz) < s + 24 || (coastal && bx + s > 494))
          continue;
        talus[j % talus.length].push({
          x: bx,
          y: landscape.height(bx, bz) - s * 0.12,
          z: bz,
          rx: (rand() - 0.5) * 0.5,
          ry: a,
          rz: (rand() - 0.5) * 0.4,
          sx: s,
          sy: s * (0.6 + rand() * 0.5),
          sz: s * (0.8 + rand() * 0.6),
          color: new THREE.Color().setHSL(0.1, 0.04, 0.72 + rand() * 0.24),
        });
      }
    }
  let count = 0;
  walls.forEach((transforms, i) => {
    if (!transforms.length) return;
    count += transforms.length;
    addTiles(
      root,
      cliffGeometry(73 + i * 29),
      material,
      transforms,
      'eroded rock buttresses',
    );
  });
  talus.forEach((transforms, i) => {
    if (!transforms.length) return;
    count += transforms.length;
    addTiles(
      root,
      boulderGeometry(31 + i * 7),
      material,
      transforms,
      'fractured talus boulders',
    );
  });
  root.userData.rockInstances = count;
}
