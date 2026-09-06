import * as THREE from 'three';
import { Track, seeded } from '../tracks';
import type { Weather } from '../types';
import { instanced } from './geometry';

// Three reusable eroded profiles. All geometry belongs to the current world;
// the rock albedo belongs to the engine and is shared across circuit changes.
function cliffGeometry(seed: number) {
  const rand = seeded(seed);
  const sides = 20,
    levels = 10;
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const phase = rand() * Math.PI * 2;
  for (let level = 0; level <= levels; level++) {
    const t = level / levels;
    const shelf = [
      0.01, 0, 0.025, -0.005, -0.03, -0.01, 0.015, -0.02, -0.035, -0.01, -0.06,
    ][level];
    for (let side = 0; side <= sides; side++) {
      const a = (side / sides) * Math.PI * 2;
      const fissure = Math.pow(Math.max(0, Math.sin(a * 5 + phase)), 12) * 0.07;
      const ridge =
        Math.sin(a * 3 + phase + t * 4) * 0.045 +
        Math.cos(a * 7 - t * 2) * 0.012;
      const radius =
        (0.51 - t * 0.06 + shelf + ridge - fissure) *
        (t > 0.88 ? 1 - (t - 0.88) * 0.85 : 1);
      const crown =
        1 + Math.sin(a * 3 + phase) * 0.022 + Math.cos(a * 5) * 0.014;
      positions.push(
        Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** 0.6 * radius +
          Math.sin(t * 2 + phase) * t * 0.025,
        t * crown +
          Math.sin(a * 4 + phase + level * 2) * Math.sin(Math.PI * t) * 0.008,
        Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** 0.6 * radius,
      );
      uvs.push((side / sides) * 2, t * 1.8);
    }
  }
  for (let y = 0; y < levels; y++) {
    for (let x = 0; x < sides; x++) {
      const a = y * (sides + 1) + x,
        b = a + sides + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const center = positions.length / 3;
  positions.push(Math.sin(2 + phase) * 0.045, 1, 0);
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
) {
  if (track.circuit.id === 'marina') return;
  const coastal = track.circuit.id === 'riviera';
  const rand = seeded(coastal ? 842 : 247);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    bumpMap: texture,
    bumpScale: 0.16,
    color: coastal ? 0xc2916d : 0x9ca397,
    roughness: weather === 'rain' ? 0.82 : 1,
    envMapIntensity: 0.2,
  });
  const batches: Parameters<typeof instanced>[2][] = [[], [], []];
  for (let i = 0; i < 110; i++) {
    const at = rand() * track.length;
    const f = track.sample(at);
    const side = rand() > 0.5 ? 1 : -1;
    const setback = 100 + rand() * 145;
    const x = f.x + f.nx * side * setback;
    const z = f.z + f.nz * side * setback;
    const width = 48 + rand() * 42;
    // Keep the complete rock footprint outside racing, runoff and furniture.
    if (track.nearestDistance(x, z) < width * 0.65 + 62) continue;
    if (coastal && x + width * 0.65 > 490) continue;
    const height = 35 + rand() * (coastal ? 70 : 60);
    batches[i % 3].push({
      x,
      y: -3,
      z,
      ry: rand() * Math.PI * 2,
      sx: width,
      sy: height,
      sz: width * (0.7 + rand() * 0.5),
      color: new THREE.Color().setHSL(
        coastal ? 0.095 : 0.15,
        0.08 + rand() * 0.08,
        0.72 + rand() * 0.22,
      ),
    });
    // Talus clusters at the foot break the repeated vertical silhouettes.
    for (let j = 0; j < 3; j++) {
      const a = rand() * Math.PI * 2;
      const bx = x + Math.cos(a) * width * 0.45;
      const bz = z + Math.sin(a) * width * 0.45;
      const s = 7 + rand() * 13;
      if (track.nearestDistance(bx, bz) < s + 42) continue;
      if (coastal && bx + s > 494) continue;
      batches[(i + j) % 3].push({
        x: bx,
        y: -1.5,
        z: bz,
        ry: a,
        sx: s * 1.4,
        sy: s * 0.7,
        sz: s,
        color: new THREE.Color(0xc9c1ab),
      });
    }
  }
  batches.forEach((transforms, i) => {
    if (transforms.length)
      root.add(
        instanced(cliffGeometry(73 + i * 29), material, transforms, true),
      );
  });
}
