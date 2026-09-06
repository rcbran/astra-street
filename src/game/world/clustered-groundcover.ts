import * as THREE from 'three';
import { Track, seeded } from '../tracks';
import { Landscape, terrainNoise } from './landscape';
import type { instanced } from './geometry';

type Transforms = Parameters<typeof instanced>[2];

/** Groundcover uses compact colonies and a roadside density gradient, rather than
 * isolated equally probable tufts spread over a 210-m-wide strip. Rendering and
 * resource ownership remain with vegetation.ts's existing spatial batches. */
export function clusteredGroundcover(track: Track, landscape: Landscape) {
  const grasses: Transforms = [],
    ferns: Transforms = [],
    shrubs: Transforms = [];
  if (track.circuit.id === 'marina') return { grasses, ferns, shrubs };
  const forest = landscape.forest,
    coastal = landscape.coastal;
  const random = seeded(forest ? 63537 : 74359);
  const half = track.circuit.width / 2;
  const colonyCount = Math.ceil(track.length * (forest ? 1.1 : 0.82));
  for (let colony = 0; colony < colonyCount; colony++) {
    const station = track.sample(random() * track.length);
    const side = random() < 0.5 ? -1 : 1;
    const offset = side * (half + 5.5 + Math.pow(random(), 2.1) * 78);
    const cx = station.x + station.nx * offset,
      cz = station.z + station.nz * offset;
    const moisture = terrainNoise(cx * 0.031 + 12, cz * 0.031 + 7);
    if (moisture < (forest ? 0.22 : 0.31)) continue;
    const radius = 1.15 + random() * 2.2;
    const members = 5 + Math.floor(random() * (forest ? 7 : 5));
    const colonyShade = 0.79 + random() * 0.17;
    for (let member = 0; member < members; member++) {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * radius;
      const x = cx + Math.cos(angle) * distance,
        z = cz + Math.sin(angle) * distance;
      const roadDistance = track.nearestDistance(x, z),
        y = landscape.height(x, z);
      if (
        roadDistance < half + 4.7 ||
        y < -0.65 ||
        (coastal && x > 465) ||
        landscape.slope(x, z) > 0.9 ||
        !landscape.vegetationClear(x, z, 0)
      )
        continue;
      const fern =
        forest &&
        moisture > 0.54 &&
        roadDistance > half + 10 &&
        random() < 0.24;
      const shrub =
        !fern && roadDistance > half + 15 && member === 0 && random() < 0.22;
      const scale = shrub
        ? 0.65 + random() * 0.9
        : fern
          ? 0.65 + random() * 0.55
          : 0.5 + random() * 0.65;
      const shade = colonyShade * (0.94 + random() * 0.06);
      const transform = {
        x,
        y: y - 0.025,
        z,
        ry: random() * Math.PI * 2,
        sx: scale * (0.85 + random() * 0.3),
        sy: scale,
        sz: scale,
        color: new THREE.Color().setRGB(
          shade * (coastal ? 1 : 0.94),
          shade,
          shade * (coastal ? 0.75 : 0.87),
        ),
      };
      (shrub ? shrubs : fern ? ferns : grasses).push(transform);
    }
  }
  return { grasses, ferns, shrubs };
}
