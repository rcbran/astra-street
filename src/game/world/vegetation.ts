import * as THREE from 'three';
import { Track, seeded } from '../tracks';
import type { Weather } from '../types';
import { instanced } from './geometry';
import { Landscape, terrainNoise } from './landscape';
import {
  fernGeometry,
  grassClumpGeometry,
  shrubGeometry,
} from './undergrowth-geometry';
import { createTreeBatches, type TreePlacement } from './tree-batches';
import type { TreeAssets } from './tree-assets';
import { clusteredGroundcover } from './clustered-groundcover';

type Transforms = Parameters<typeof instanced>[2];
function addGroundcover(
  root: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  transforms: Transforms,
  label: string,
) {
  if (!transforms.length) {
    geometry.dispose();
    return;
  }
  const tiles = new Map<string, Transforms>();
  for (const t of transforms) {
    const key = `${Math.floor(t.x / 100)}:${Math.floor(t.z / 100)}`;
    const bucket = tiles.get(key) ?? [];
    bucket.push(t);
    tiles.set(key, bucket);
  }
  for (const bucket of tiles.values()) {
    const batch = instanced(geometry, material, bucket, false);
    batch.name = label;
    root.add(batch);
  }
}

/** Forest ecology is separate from asset loading and distance rendering. */
export function buildTrees(
  root: THREE.Group,
  track: Track,
  weather: Weather,
  assets: TreeAssets,
  landscape: Landscape,
) {
  const forest = landscape.forest,
    coastal = landscape.coastal;
  const city = track.circuit.id === 'marina';
  const rand = seeded(forest ? 912 : city ? 78 : 443);
  const placements: TreePlacement[] = [];
  const occupied = new Map<
    string,
    { x: number; z: number; radius: number }[]
  >();
  const firs = assets.species.flatMap((s, i) =>
    s.id.startsWith('fir') ? [i] : [],
  );
  const canyonFirs = assets.species.flatMap((s, i) =>
    s.id.startsWith('canyon_fir') ? [i] : [],
  );
  // Low, broad fir_b crowns lead the Canyon groves; taller fir_a accents
  // break their outline. Sparse fir_c and high pine crowns suit Pinecrest.
  const canyonGroves = canyonFirs.flatMap((i) =>
    assets.species[i].id.endsWith('_b')
      ? [i, i, i, i]
      : assets.species[i].id.endsWith('_a')
        ? [i]
        : [],
  );
  const pines = assets.species.flatMap((s, i) =>
    s.id.startsWith('pine') ? [i] : [],
  );
  const broadleaves = assets.species.flatMap((s, i) =>
    s.id.startsWith('broadleaf') ? [i] : [],
  );
  for (
    let i = 0;
    i < (forest ? 20000 : city ? 2000 : coastal ? 8000 : 14000);
    i++
  ) {
    const f = track.sample(rand() * track.length);
    const side = rand() > 0.5 ? 1 : -1;
    const offset =
      side *
      ((coastal ? 18.5 : 22) +
        Math.pow(rand(), coastal ? 1.5 : 1.35) *
          (city ? 430 : coastal ? 132 : 820));
    const x = f.x + f.nx * offset,
      z = f.z + f.nz * offset;
    const d = track.nearestDistance(x, z);
    if (d < (coastal ? 18.5 : 22) || (coastal && x > 465) || (city && d < 280))
      continue;
    // Author only the visible roadside groves and their backing rows. Deep
    // forest beyond this corridor mostly sits behind the Canyon buttresses.
    if (coastal && d > 150) continue;
    const stand = terrainNoise(x * 0.017, z * 0.017);
    // Broad stands are punctuated by clearings; roadside trees get breathing
    // room instead of forming one uninterrupted hedge along the tarmac.
    if (stand < (coastal ? 0.32 : d < 90 ? 0.34 : 0.22)) continue;
    const y = landscape.height(x, z) - 0.12;
    if (y < -0.75 || y > (forest ? 570 : 390) || landscape.slope(x, z) > 1.25)
      continue;
    const choice = rand();
    const family =
      choice < (forest ? 0.64 : coastal ? 0.86 : 0.22)
        ? coastal && canyonFirs.length
          ? canyonFirs
          : firs
        : choice < (forest ? 0.94 : coastal ? 0.99 : 0.91)
          ? pines
          : broadleaves;
    const pool =
      coastal && canyonGroves.length
        ? canyonGroves
        : family.length
          ? family
          : firs;
    const speciesIndex = pool[Math.floor(rand() * pool.length)];
    const species = assets.species[speciesIndex];
    const sapling = rand() < 0.12;
    const height = species.id.startsWith('broadleaf')
      ? 5 + rand() * 6
      : sapling
        ? 5 + rand() * 5
        : (forest ? 15 : coastal ? 12 : 13) + rand() * (coastal ? 8 : 13);
    const scale = height / species.height;
    const radius = species.radius * scale;
    if (!landscape.vegetationClear(x, z, Math.min(12, radius * 0.45))) continue;
    const cellX = Math.floor(x / 12),
      cellZ = Math.floor(z / 12);
    let crowded = false;
    for (let dx = -2; dx <= 2 && !crowded; dx++)
      for (let dz = -2; dz <= 2 && !crowded; dz++)
        for (const tree of occupied.get(`${cellX + dx}:${cellZ + dz}`) ?? []) {
          if (
            Math.hypot(tree.x - x, tree.z - z) <
            (coastal ? 3.8 : 2.5) +
              (tree.radius + radius) * (coastal ? 0.65 : 0.48)
          ) {
            crowded = true;
            break;
          }
        }
    if (crowded) continue;
    const bucket = occupied.get(`${cellX}:${cellZ}`) ?? [];
    bucket.push({ x, z, radius });
    occupied.set(`${cellX}:${cellZ}`, bucket);
    const shade = coastal ? 0.78 + rand() * 0.14 : 0.84 + rand() * 0.16;
    placements.push({
      x,
      y,
      z,
      species: speciesIndex,
      scale,
      yaw: rand() * Math.PI * 2,
      width: 0.9 + rand() * 0.2,
      color: new THREE.Color().setRGB(
        shade * ((coastal ? 0.78 : 0.96) + rand() * 0.04),
        shade,
        shade * ((coastal ? 0.74 : 0.91) + rand() * 0.07),
      ),
    });
  }
  const trees = createTreeBatches(root, assets, placements);
  const { grasses, ferns, shrubs } = clusteredGroundcover(track, landscape);
  const groundcover = new THREE.MeshStandardMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: weather === 'rain' ? 0.86 : 1,
    envMapIntensity: 0.25,
  });
  addGroundcover(
    root,
    grassClumpGeometry(),
    groundcover,
    grasses,
    'curved roadside grasses',
  );
  addGroundcover(
    root,
    fernGeometry(),
    groundcover,
    ferns,
    'forest floor ferns',
  );
  addGroundcover(
    root,
    shrubGeometry(),
    groundcover,
    shrubs,
    'branched understory shrubs',
  );
  root.userData.treeCount = placements.length;
  root.userData.solidTreeCount = placements.length;
  root.userData.grassClumps = grasses.length;
  root.userData.fernCount = ferns.length;
  root.userData.shrubCount = shrubs.length;
  root.userData.treeSpecies = assets.species.map((s) => s.id);
  return trees;
}
