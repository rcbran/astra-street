import * as THREE from 'three';
import { Track, seeded } from '../tracks';
import type { Weather } from '../types';
import { instanced } from './geometry';
export function buildTrees(
  root: THREE.Group,
  track: Track,
  weather: Weather,
  texture: THREE.Texture,
  conifers: THREE.Texture,
) {
  const rand = seeded(track.circuit.id === 'forest' ? 912 : 443),
    forest = track.circuit.id === 'forest';
  const groups: {
    x: number;
    y: number;
    z: number;
    ry: number;
    sx: number;
    sy: number;
    sz: number;
    color: THREE.Color;
  }[][] = [[], [], [], []];
  const count = forest ? 850 : 320;
  for (let i = 0; i < count; i++) {
    const at = rand() * track.length,
      side = rand() > 0.5 ? 1 : -1,
      offset =
        side * (track.circuit.width / 2 + 14 + rand() * (forest ? 180 : 90));
    const f = track.sample(at);
    const x = f.x + f.nx * offset,
      z = f.z + f.nz * offset;
    if (
      track.nearestDistance(x, z) < 24 ||
      (track.circuit.id === 'riviera' && x > 460)
    )
      continue;
    const kind =
      rand() < (forest ? 0.76 : 0.28)
        ? 2 + Math.floor(rand() * 2)
        : Math.floor(rand() * 2);
    const s = 0.65 + rand() * 0.85;
    const t = {
      x,
      y: -0.18,
      z,
      ry: rand() * 6.28,
      sx: s,
      sy: s * (0.8 + rand() * 0.5),
      sz: s,
      color: new THREE.Color().setHSL(
        0.19 + rand() * 0.09,
        0.035 + rand() * 0.1,
        0.71 + rand() * 0.25,
      ),
    };
    groups[kind].push(t);
  }
  const material = (map: THREE.Texture) =>
    new THREE.MeshStandardMaterial({
      map,
      alphaTest: 0.45,
      alphaToCoverage: true,
      side: THREE.DoubleSide,
      roughness: 1,
      color: weather === 'sunset' ? 0xe1ddc2 : 0xe5eddc,
    });
  const materials = [material(texture), material(conifers)];
  const regions = [
    [0, 942 / 1774],
    [946 / 1774, 1],
    [0, 0.5],
    [0.5, 1],
  ];
  groups.forEach((trees, kind) => {
    const pine = kind >= 2;
    const geometry = new THREE.PlaneGeometry(pine ? 12 : 13, pine ? 22 : 13);
    geometry.translate(0, pine ? 10.1 : 6.4, 0);
    const uv = geometry.getAttribute('uv');
    const [left, right] = regions[kind];
    for (let i = 0; i < uv.count; i++)
      uv.setX(i, left + uv.getX(i) * (right - left));
    const cards = trees.flatMap((t) => [t, { ...t, ry: t.ry + Math.PI / 2 }]);
    root.add(instanced(geometry, materials[pine ? 1 : 0], cards, true));
  });
}
