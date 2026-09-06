import * as THREE from 'three';
import { Track, seeded } from '../tracks';
import type { Weather } from '../types';
import { instanced } from './geometry';
import { Landscape, terrainNoise } from './landscape';

// Reusable fractured buttresses with a varied crown, ledges, vertical fissures
// and layered color. Six profiles are instanced into connected canyon walls.
function cliffGeometry(seed: number) {
  const rand = seeded(seed),
    sides = 32,
    levels = 22;
  const positions: number[] = [],
    colors: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const phase = rand() * 10;
  for (let level = 0; level <= levels; level++) {
    const t = level / levels;
    const ledge = Math.floor(t * 7 + 0.12) * 0.021;
    for (let side = 0; side <= sides; side++) {
      const a = (side / sides) * Math.PI * 2;
      const fissure = Math.max(0, Math.sin(a * 7 + phase)) ** 10 * 0.12;
      const fracture = terrainNoise(
        Math.cos(a) * 3 + phase,
        t * 9 + Math.sin(a) * 2,
      );
      const radius =
        0.57 - ledge - t * 0.035 + (fracture - 0.5) * 0.12 - fissure;
      const crown =
        0.86 + terrainNoise(Math.cos(a) * 2 + phase, Math.sin(a) * 2) * 0.3;
      positions.push(
        Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.38 * radius +
          t * 0.065,
        t * crown,
        Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.38 * radius,
      );
      uvs.push((side / sides) * 8, t * 10);
      const strata = 0.73 + terrainNoise(t * 34, phase) * 0.35;
      const c = new THREE.Color('#c6b6a2').multiplyScalar(
        strata * (1 - fissure * 1.7),
      );
      colors.push(c.r, c.g, c.b);
    }
  }
  for (let y = 0; y < levels; y++)
    for (let x = 0; x < sides; x++) {
      const a = y * (sides + 1) + x,
        b = a + sides + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const center = positions.length / 3;
  positions.push(0, 0.98, 0);
  colors.push(0.48, 0.35, 0.24);
  uvs.push(0.5, 0.5);
  for (let x = 0; x < sides; x++) {
    const a = levels * (sides + 1) + x;
    indices.push(a, center, a + 1);
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

export function buildRockFormations(
  root: THREE.Group,
  track: Track,
  weather: Weather,
  texture: THREE.Texture,
  landscape: Landscape,
) {
  if (track.circuit.id === 'marina') return;
  const coastal = landscape.coastal,
    rand = seeded(coastal ? 842 : 247);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    bumpMap: texture,
    bumpScale: 0.65,
    vertexColors: true,
    color: coastal ? 0xf1dfc4 : 0xadb9a8,
    roughness: weather === 'rain' ? 0.85 : 1,
    envMapIntensity: 0.18,
  });
  const batches: Parameters<typeof instanced>[2][] = Array.from(
    { length: 6 },
    () => [],
  );
  // Repeated stations make a legible winding canyon; irregular gaps reveal the
  // mountain range. All footprints remain outside the complete driving corridor.
  for (let at = 0; at < track.length; at += coastal ? 45 : 100)
    for (const side of [-1, 1]) {
      const f = track.sample(at + rand() * 24);
      const width = 38 + rand() * 48;
      const setback = 60 + width * 0.55 + rand() * (coastal ? 45 : 120);
      const x = f.x + f.nx * side * setback,
        z = f.z + f.nz * side * setback;
      if (track.nearestDistance(x, z) < width * 1.04 + 25) continue;
      if (coastal && x + width * 0.8 > 490) continue;
      const height = (coastal ? 90 : 55) + rand() * (coastal ? 110 : 100);
      const group = Math.floor(rand() * batches.length);
      const base = landscape.height(x, z) - 14;
      batches[group].push({
        x,
        y: base,
        z,
        ry: f.heading + rand() * 0.7,
        sx: width,
        sy: height,
        sz: width * (0.85 + rand() * 0.5),
        color: new THREE.Color().setHSL(
          coastal ? 0.08 : 0.12,
          0.09 + rand() * 0.12,
          0.75 + rand() * 0.2,
        ),
      });
      // Attached exposed ribs cast deeper crevice shadows across broad faces.
      for (let rib = 0; rib < 3; rib++) {
        const along = (rib - 1) * width * 0.3;
        const bx = x - f.nx * side * width * 0.39 + f.tx * along;
        const bz = z - f.nz * side * width * 0.39 + f.tz * along;
        const w = width * (0.24 + rand() * 0.13);
        if (track.nearestDistance(bx, bz) < w + 24) continue;
        batches[(group + rib + 1) % 6].push({
          x: bx,
          y: base - 4,
          z: bz,
          ry: f.heading + rand() * 0.35,
          rz: (rand() - 0.5) * 0.1,
          sx: w,
          sy: height * (0.5 + rand() * 0.45),
          sz: w * 1.25,
          color: new THREE.Color().setHSL(0.09, 0.07, 0.78 + rand() * 0.18),
        });
      }
      // Smaller broken spires and talus stitch the vertical walls into the slopes.
      for (let j = 0; j < 6; j++) {
        const a = rand() * Math.PI * 2;
        const bx = x + Math.cos(a) * width * 0.57,
          bz = z + Math.sin(a) * width * 0.57;
        const s = 8 + rand() * 18;
        if (
          track.nearestDistance(bx, bz) < s * 0.95 + 23 ||
          (coastal && bx + s > 494)
        )
          continue;
        batches[(group + j) % 6].push({
          x: bx,
          y: landscape.height(bx, bz) - 5,
          z: bz,
          ry: a,
          rz: (rand() - 0.5) * 0.24,
          sx: s,
          sy: s * (j < 2 ? 2.4 : 0.8),
          sz: s * 1.4,
          color: new THREE.Color(0xc6b5a1),
        });
      }
    }
  let count = 0;
  batches.forEach((transforms, i) => {
    if (!transforms.length) return;
    count += transforms.length;
    const batch = instanced(
      cliffGeometry(73 + i * 29),
      material,
      transforms,
      true,
    );
    batch.name = 'canyon buttresses';
    root.add(batch);
  });
  root.userData.rockInstances = count;
}
