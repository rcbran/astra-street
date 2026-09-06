import * as THREE from 'three';
import type { CircuitId, Weather } from './types';
export interface Circuit {
  id: CircuitId;
  name: string;
  country: string;
  subtitle: string;
  character: string;
  defaultWeather: Weather;
  accent: string;
  points: [number, number][];
  width: number;
  difficulty: string;
}
export const CIRCUITS: Circuit[] = [
  {
    id: 'riviera',
    name: 'Canyon Run',
    country: 'SUNSET COAST',
    subtitle: 'Between the cliffs and the sea',
    character: 'Golden cliffs. Fast sweepers. Long slides.',
    defaultWeather: 'sunset',
    accent: '#ff6a3d',
    width: 14.5,
    difficulty: 'FLOWING',
    points: [
      [0, 0],
      [0, 260],
      [65, 420],
      [230, 480],
      [390, 430],
      [465, 320],
      [430, 190],
      [310, 115],
      [245, 15],
      [290, -140],
      [400, -230],
      [375, -375],
      [205, -450],
      [15, -425],
      [-140, -315],
      [-185, -145],
      [-150, -45],
      [-55, -85],
    ],
  },
  {
    id: 'forest',
    name: 'Pinecrest',
    country: 'HIGHLAND PASS',
    subtitle: 'Into the green',
    character: 'High-speed straights. Technical corners.',
    defaultWeather: 'clear',
    accent: '#b7d57a',
    width: 14,
    difficulty: 'TECHNICAL',
    points: [
      [0, 0],
      [0, 330],
      [65, 495],
      [230, 540],
      [355, 430],
      [355, 260],
      [460, 125],
      [500, -45],
      [405, -160],
      [260, -125],
      [175, -230],
      [225, -390],
      [65, -520],
      [-155, -465],
      [-270, -335],
      [-245, -145],
      [-320, -30],
      [-250, 100],
      [-120, 150],
      [-55, 75],
    ],
  },
  {
    id: 'marina',
    name: 'Harbor City',
    country: 'DOWNTOWN AFTER DARK',
    subtitle: 'After dark, everything changes',
    character: 'City lights. Wet asphalt. Close racing.',
    defaultWeather: 'rain',
    accent: '#9bc5ff',
    width: 14,
    difficulty: 'PRECISION',
    points: [
      [0, 0],
      [0, 300],
      [65, 375],
      [260, 375],
      [325, 305],
      [325, 120],
      [440, 55],
      [480, -80],
      [400, -185],
      [235, -180],
      [175, -290],
      [225, -430],
      [80, -475],
      [-100, -420],
      [-180, -275],
      [-155, -125],
      [-260, -75],
      [-280, 90],
      [-180, 180],
      [-70, 110],
    ],
  },
];
export interface TrackFrame {
  x: number;
  y: number;
  z: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  heading: number;
  curvature: number;
}
export class Track {
  readonly circuit: Circuit;
  readonly curve: THREE.CatmullRomCurve3;
  readonly length: number;
  readonly count = 2048;
  readonly frames: TrackFrame[] = [];
  readonly mapPath: string;
  constructor(circuit: Circuit) {
    this.circuit = circuit;
    this.curve = new THREE.CatmullRomCurve3(
      circuit.points.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      true,
      'catmullrom',
      0.36,
    );
    this.curve.arcLengthDivisions = 6000;
    this.curve.updateArcLengths();
    this.length = this.curve.getLength();
    for (let i = 0; i <= this.count; i++) {
      const u = (i % this.count) / this.count;
      const p = this.curve.getPointAt(u);
      const t = this.curve.getTangentAt(u);
      this.frames.push({
        x: p.x,
        y: 0.04,
        z: p.z,
        tx: t.x,
        tz: t.z,
        nx: t.z,
        nz: -t.x,
        heading: Math.atan2(t.x, t.z),
        curvature: 0,
      });
    }
    for (let i = 0; i < this.count; i++) {
      const a = this.frames[(i + this.count - 3) % this.count],
        b = this.frames[(i + 3) % this.count];
      this.frames[i].curvature =
        angleDelta(b.heading, a.heading) / ((6 * this.length) / this.count);
    }
    this.frames[this.count].curvature = this.frames[0].curvature;
    const xs = this.frames.map((f) => f.x),
      zs = this.frames.map((f) => f.z);
    const minx = Math.min(...xs),
      minz = Math.min(...zs),
      scale = 170 / Math.max(Math.max(...xs) - minx, Math.max(...zs) - minz);
    this.mapPath =
      this.frames
        .filter((_, i) => i % 16 === 0)
        .map(
          (p, i) =>
            `${i ? 'L' : 'M'}${((p.x - minx) * scale + 15).toFixed(1)},${((p.z - minz) * scale + 15).toFixed(1)}`,
        )
        .join(' ') + 'Z';
  }
  sample(distance: number, out?: TrackFrame): TrackFrame {
    const n = ((((distance / this.length) % 1) + 1) % 1) * this.count,
      i = Math.floor(n),
      a = this.frames[i],
      b = this.frames[i + 1],
      t = n - i;
    const o = out ?? {
      x: 0,
      y: 0,
      z: 0,
      tx: 0,
      tz: 0,
      nx: 0,
      nz: 0,
      heading: 0,
      curvature: 0,
    };
    o.x = a.x + (b.x - a.x) * t;
    o.z = a.z + (b.z - a.z) * t;
    o.y = a.y;
    o.heading = a.heading + angleDelta(b.heading, a.heading) * t;
    o.tx = Math.sin(o.heading);
    o.tz = Math.cos(o.heading);
    o.nx = o.tz;
    o.nz = -o.tx;
    o.curvature = a.curvature + (b.curvature - a.curvature) * t;
    return o;
  }
  nearestDistance(x: number, z: number): number {
    let min = 1e12;
    for (let i = 0; i < this.count; i += 12) {
      const f = this.frames[i];
      const d = (f.x - x) ** 2 + (f.z - z) ** 2;
      if (d < min) min = d;
    }
    return Math.sqrt(min);
  }
}
export const angleDelta = (a: number, b: number) =>
  Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const clamp = (x: number, a: number, b: number) =>
  Math.min(b, Math.max(a, x));
export function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
