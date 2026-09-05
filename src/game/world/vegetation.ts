import * as THREE from 'three';
import { Track, seeded } from '../tracks';
import type { Weather } from '../types';
import { instanced } from './geometry';
export function buildTrees(
  root: THREE.Group,
  track: Track,
  weather: Weather,
  texture: THREE.Texture,
) {
  const rand = seeded(track.circuit.id === 'forest' ? 912 : 443),
    forest = track.circuit.id === 'forest';
  const leaves: {
    x: number;
    y: number;
    z: number;
    ry: number;
    sx: number;
    sy: number;
    sz: number;
    color: THREE.Color;
  }[] = [];
  const count = forest ? 680 : 220;
  for (let i = 0; i < count; i++) {
    const at = rand() * track.length,
      side = rand() > 0.5 ? 1 : -1,
      offset =
        side * (track.circuit.width / 2 + 12 + rand() * (forest ? 150 : 65));
    const f = track.sample(at);
    const x = f.x + f.nx * offset,
      z = f.z + f.nz * offset;
    if (
      track.nearestDistance(x, z) < 24 ||
      (track.circuit.id === 'riviera' && x > 460)
    )
      continue;
    const s = 0.8 + rand() * 1.1;
    const t = {
      x,
      y: -0.18,
      z,
      ry: rand() * 6.28,
      sx: s,
      sy: s * (0.8 + rand() * 0.5),
      sz: s,
      color: new THREE.Color().setHSL(
        0.23 + rand() * 0.07,
        0.24 + rand() * 0.15,
        0.18 + rand() * 0.12,
      ),
    };
    leaves.push(t);
  }
  const cardMat = new THREE.MeshStandardMaterial({
    map: texture,
    alphaTest: 0.45,
    alphaToCoverage: true,
    side: THREE.DoubleSide,
    roughness: 1,
    color: weather === 'sunset' ? 0xc3ceaf : 0xccd5c1,
  });
  const geometry = new THREE.PlaneGeometry(13, 13);
  geometry.translate(0, 6.4, 0);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (942 / 1774));
  const cards = leaves.flatMap((t) => [
    { ...t, color: undefined },
    { ...t, ry: t.ry + Math.PI / 2, color: undefined },
  ]);
  root.add(instanced(geometry, cardMat, cards, true));
}
