import * as THREE from 'three';
import { seeded } from '../tracks';

/** Original solid branch whorls for nearby trees; distant trees use the atlas. */
export function coniferGeometry(seed: number) {
  const rand = seeded(seed),
    positions: number[] = [],
    colors: number[] = [];
  const vertex = (x: number, y: number, z: number, shade: number) => {
    positions.push(x, y, z);
    const c = new THREE.Color('#486039').multiplyScalar(shade);
    colors.push(c.r, c.g, c.b);
  };
  for (let level = 0; level < 18; level++) {
    const y = 0.12 + level * 0.047,
      width = (1 - y) * 0.27;
    const branches = 20,
      phase = rand() * 6.28;
    const radii = Array.from(
      { length: branches },
      () => width * (0.62 + rand() * 0.5),
    );
    for (let j = 0; j < branches; j++) {
      const a = (j / branches) * Math.PI * 2 + phase;
      const next = ((j + 1) / branches) * Math.PI * 2 + phase;
      const r = radii[j];
      const nr = radii[(j + 1) % branches];
      const droop = (rand() - 0.5) * 0.035;
      const top = y + 0.085 - level * 0.001;
      // Lobed outer branch tips, two upper facets, and a shaded underside.
      const mid = (a + next) / 2;
      vertex(0, top, 0, 1.1);
      vertex(Math.sin(a) * r, y + droop, Math.cos(a) * r, 0.8);
      vertex(
        Math.sin(mid) * width * 0.53,
        y + 0.034,
        Math.cos(mid) * width * 0.53,
        1.05,
      );
      vertex(0, top, 0, 1.1);
      vertex(
        Math.sin(mid) * width * 0.53,
        y + 0.034,
        Math.cos(mid) * width * 0.53,
        1.05,
      );
      vertex(Math.sin(next) * nr, y + droop, Math.cos(next) * nr, 0.8);
      vertex(Math.sin(a) * r, y + droop, Math.cos(a) * r, 0.8);
      vertex(Math.sin(next) * nr, y + droop, Math.cos(next) * nr, 0.8);
      vertex(
        Math.sin(mid) * width * 0.53,
        y + 0.034,
        Math.cos(mid) * width * 0.53,
        1.05,
      );
      vertex(0, y + 0.008, 0, 0.52);
      vertex(Math.sin(next) * nr, y + droop, Math.cos(next) * nr, 0.7);
      vertex(Math.sin(a) * r, y + droop, Math.cos(a) * r, 0.7);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function grassClumpGeometry() {
  const rand = seeded(78),
    vertices: number[] = [];
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2,
      x = (rand() - 0.5) * 0.7,
      z = (rand() - 0.5) * 0.7;
    const w = 0.04 + rand() * 0.04,
      height = 0.35 + rand() * 0.65;
    vertices.push(
      x - Math.cos(a) * w,
      0,
      z - Math.sin(a) * w,
      x + Math.cos(a) * w,
      0,
      z + Math.sin(a) * w,
      x + Math.sin(a) * height * 0.35,
      height,
      z + Math.cos(a) * height * 0.35,
    );
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.computeVertexNormals();
  return g;
}
