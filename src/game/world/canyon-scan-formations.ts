import * as THREE from 'three';
import { Track, seeded } from '../tracks';
import { instanced } from './geometry';
import type { Landscape } from './landscape';
import type { CanyonScanAssets } from './canyon-scan-assets';

type Transform = Parameters<typeof instanced>[2][number];
export interface CanyonScanFormations {
  count: number;
  triangles: number;
  dispose: () => void;
}

/**
 * World-owned instance buffers borrowing closed, textured scan shells. Call dispose()
 * before generic world traversal: it removes the borrowed asset subtree first.
 * Shared scan geometries/materials/textures survive route/weather changes.
 */
export function buildCanyonScanFormations(
  root: THREE.Group,
  track: Track,
  landscape: Landscape,
  assets: CanyonScanAssets,
): CanyonScanFormations {
  if (!assets.scans.length) throw new Error('No canyon scan assets');
  const group = new THREE.Group();
  group.name = 'scanned canyon formations';
  root.add(group);
  const random = seeded(87324);
  const groups: Transform[][] = assets.scans.map(() => []);
  const instances: THREE.InstancedMesh[] = [];
  // Coarse nearestDistance omits 11 samples: half its sampling step is added
  // to the requested paved-edge clearance. An enclosing circle covers the
  // full horizontal footprint and every other bend on the closed route.
  const clearance =
    track.circuit.width / 2 + 14 + (track.length / track.count) * 6;
  const triangleLimit = 960000;
  let triangles = 0,
    count = 0;
  const appendFormation = (
    x: number,
    z: number,
    width: number,
    stretch: number,
    heading: number,
    variant: number,
    floor?: number,
  ) => {
    const scan = assets.scans[variant];
    const size = scan.bounds.getSize(new THREE.Vector3());
    const scale = width / size.x;
    const height = size.y * scale * stretch;
    // The loader closes the real +Z scan front behind its minimum depth.
    // Bounds include every side/rear vertex; there is no opaque backing core.
    const p = scan.geometry.getAttribute('position');
    let radius = 0;
    for (let i = 0; i < p.count; i++)
      radius = Math.max(
        radius,
        Math.hypot(p.getX(i) * scale, p.getZ(i) * scale * 0.62),
      );
    if (track.nearestDistance(x, z) < radius + clearance) return false;
    const formationTriangles = scan.triangles;
    if (triangles + formationTriangles > triangleLimit) return false;
    let terrainBase = landscape.height(x, z);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      terrainBase = Math.min(
        terrainBase,
        landscape.height(x + Math.cos(a) * radius, z + Math.sin(a) * radius),
      );
    }
    // The low ring is buried rather than floating on a central terrain sample.
    const y = floor ?? terrainBase - Math.max(2, height * 0.06);
    const color = new THREE.Color().setRGB(
      0.93 + random() * 0.07,
      0.91 + random() * 0.08,
      0.89 + random() * 0.08,
    );
    groups[variant].push({
      x,
      y,
      z,
      ry: heading,
      sx: scale,
      sy: scale * stretch,
      sz: scale * 0.62,
      color,
    });
    landscape.registerVegetationObstacle(x, z, radius);
    triangles += formationTriangles;
    count += 1;
    return { y, height, radius };
  };
  // At most 48 major formations plus occasional overlapping upper shells.
  // Distributing along the full route avoids spending the cap at its start.
  const upperSections: (() => void)[] = [];
  const stations = Math.min(24, Math.floor(track.length / 96));
  for (let station = 0; station < stations; station++)
    for (const side of [-1, 1]) {
      const f = track.sample(
        ((station + 0.15 + random() * 0.25) / stations) * track.length,
      );
      let width = 132 + random() * 40;
      const setback = 111 + random() * 18;
      const x = f.x + f.nx * side * setback,
        z = f.z + f.nz * side * setback;
      const heading = Math.atan2(-f.nx * side, -f.nz * side);
      const variant = (station + (side > 0 ? 1 : 0)) % assets.scans.length;
      const stretch = 1.35 + random() * 0.65;
      let placed = appendFormation(x, z, width, stretch, heading, variant);
      if (!placed) {
        // Tight inside bends retain a narrower wall instead of a large gap.
        width *= 0.72;
        placed = appendFormation(x, z, width, stretch * 1.2, heading, variant);
      }
      if (!placed || station % 4 !== (side > 0 ? 0 : 2)) continue;
      // A narrower upper section overlaps deeply, keeping a broken skyline and
      // projecting shelves instead of stretching every scan into a tall slab.
      upperSections.push(() =>
        appendFormation(
          x + f.nx * side * 7,
          z + f.nz * side * 7,
          width * 0.72,
          1.6,
          heading + 0.08,
          0,
          placed.y + placed.height * 0.56,
        ),
      );
    }
  // Major walls get first use of the cap around the entire loop.
  upperSections.forEach((append) => append());
  const addTiles = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    transforms: Transform[],
  ) => {
    const tiles = new Map<string, Transform[]>();
    for (const transform of transforms) {
      const key = `${Math.floor(transform.x / 200)}:${Math.floor(transform.z / 200)}`;
      const tile = tiles.get(key) ?? [];
      tile.push(transform);
      tiles.set(key, tile);
    }
    for (const tile of tiles.values()) {
      const batch = instanced(geometry, material, tile, true);
      batch.name = 'bounded scanned cliff';
      group.add(batch);
      instances.push(batch);
    }
  };
  assets.scans.forEach((scan, i) =>
    addTiles(scan.geometry, scan.material, groups[i]),
  );
  root.userData.rockInstances = count;
  root.userData.canyonScanTriangles = triangles;
  let disposed = false;
  return {
    count,
    triangles,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      instances.forEach((batch) => batch.dispose());
      group.clear();
    },
  };
}
