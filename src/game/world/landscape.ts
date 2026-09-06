import * as THREE from 'three';
import { Track } from '../tracks';
import type { SurfaceTextures } from '../materials';
import type { Weather } from '../types';

// Coherent, deterministic relief. No noise sampling or terrain allocation in
// the render loop; trees and rocks share the same interpolated height field.
export function terrainNoise(x: number, z: number): number {
  const hash = (a: number, b: number) => {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const ix = Math.floor(x),
    iz = Math.floor(z);
  let fx = x - ix,
    fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), fx),
    THREE.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), fx),
    fz,
  );
}

export class Landscape {
  readonly step = 12;
  readonly min = -1452;
  readonly count = 251;
  readonly heights = new Float32Array(this.count * this.count);
  readonly distances = new Float32Array(this.count * this.count);
  readonly coastal: boolean;
  readonly forest: boolean;
  constructor(readonly track: Track) {
    this.coastal = track.circuit.id === 'riviera';
    this.forest = track.circuit.id === 'forest';
    const city = track.circuit.id === 'marina';
    for (let z = 0; z < this.count; z++)
      for (let x = 0; x < this.count; x++) {
        const wx = this.min + x * this.step,
          wz = this.min + z * this.step;
        const d = track.nearestDistance(wx, wz);
        const rolling = terrainNoise(wx * 0.009, wz * 0.009);
        const ridges =
          1 - Math.abs(terrainNoise(wx * 0.0028, wz * 0.0031) * 2 - 1);
        const far = THREE.MathUtils.smoothstep(
          d,
          city ? 390 : 130,
          city ? 850 : 650,
        );
        const shoulder = THREE.MathUtils.smoothstep(
          d,
          track.circuit.width / 2 + 17,
          95,
        );
        let height =
          -0.24 +
          shoulder * (3 + rolling * (this.forest ? 36 : 23)) +
          far *
            (70 +
              Math.pow(ridges, 2) * (this.forest ? 420 : 280) +
              terrainNoise(wx * 0.018, wz * 0.018) * 28);
        if (city && d < 370) height = -0.24;
        if (this.coastal)
          height = THREE.MathUtils.lerp(
            height,
            -3.5,
            THREE.MathUtils.smoothstep(wx, 465, 525),
          );
        this.heights[z * this.count + x] = height;
        this.distances[z * this.count + x] = d;
      }
  }
  height(x: number, z: number) {
    const gx = THREE.MathUtils.clamp(
      (x - this.min) / this.step,
      0,
      this.count - 1.001,
    );
    const gz = THREE.MathUtils.clamp(
      (z - this.min) / this.step,
      0,
      this.count - 1.001,
    );
    const ix = Math.floor(gx),
      iz = Math.floor(gz),
      i = iz * this.count + ix;
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(this.heights[i], this.heights[i + 1], gx - ix),
      THREE.MathUtils.lerp(
        this.heights[i + this.count],
        this.heights[i + this.count + 1],
        gx - ix,
      ),
      gz - iz,
    );
  }
}

export function buildLandscape(
  root: THREE.Group,
  landscape: Landscape,
  weather: Weather,
  textures: SurfaceTextures,
) {
  const span = (landscape.count - 1) * landscape.step;
  const geometry = new THREE.PlaneGeometry(
    span,
    span,
    landscape.count - 1,
    landscape.count - 1,
  );
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(landscape.min + span / 2, 0, landscape.min + span / 2);
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const colors: number[] = [];
  const base = new THREE.Color(landscape.forest ? '#99a779' : '#c6ba96');
  const leaf = new THREE.Color(landscape.forest ? '#60733d' : '#8b975f');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i),
      h = landscape.height(x, z);
    positions.setY(i, h);
    // Shared grass textures repeat 1200 times; preserve their ~5 m world scale.
    uv.setXY(i, x / 6500, z / 6500);
    const patches = terrainNoise(x * 0.019, z * 0.019);
    const c = base
      .clone()
      .lerp(leaf, THREE.MathUtils.smoothstep(patches, 0.24, 0.76) * 0.85);
    c.multiplyScalar(0.8 + terrainNoise(x * 0.13, z * 0.13) * 0.3);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    map: textures.grass,
    normalMap: textures.grassNormal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: weather === 'rain' ? 0.91 : 1,
    vertexColors: true,
    envMapIntensity: 0.25,
  });
  const ground = new THREE.Mesh(geometry, material);
  ground.receiveShadow = true;
  ground.name = 'sculpted landscape';
  root.add(ground);
}
