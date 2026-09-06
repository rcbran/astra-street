import * as THREE from 'three';
import type { Quality } from '../types';
import type { TreeAssets, TreeSpecies } from './tree-assets';

export interface TreePlacement {
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  width: number;
  color: THREE.Color;
  species: number;
}
interface PlantedTree {
  placement: TreePlacement;
  matrix: THREE.Matrix4;
  level: number;
}
interface Tile {
  trees: PlantedTree[];
  levels: THREE.InstancedMesh[][];
}
/** Hysteresis prevents detail flicker when the camera hovers at a boundary. */
export function treeDetailLevel(
  distance: number,
  previous: number,
  quality: Quality,
) {
  const near = quality === 'ultra' ? 130 : quality === 'eco' ? 65 : 100;
  const middle = quality === 'ultra' ? 350 : quality === 'eco' ? 185 : 270;
  if (previous === 0 && distance < near + 12) return 0;
  if (previous === 2 && distance > middle - 20) return 2;
  return distance < near ? 0 : distance < middle ? 1 : 2;
}

/** Spatial instancing with per-tree LOD selection. Every level is a 3D model. */
export function createTreeBatches(
  root: THREE.Group,
  assets: TreeAssets,
  placements: TreePlacement[],
) {
  const forest = new THREE.Group();
  forest.name = 'volumetric forest';
  root.add(forest);
  const bins = new Map<string, PlantedTree[]>();
  const object = new THREE.Object3D();
  for (const placement of placements) {
    const { x, y, z, yaw, scale, width, species } = placement;
    object.position.set(x, y, z);
    object.rotation.set(0, yaw, 0);
    object.scale.set(scale * width, scale, scale / width);
    object.updateMatrix();
    const key = `${species}:${Math.floor(x / 160)}:${Math.floor(z / 160)}`;
    const bucket = bins.get(key) ?? [];
    bucket.push({ placement, matrix: object.matrix.clone(), level: -1 });
    bins.set(key, bucket);
  }
  const tiles: Tile[] = [];
  const vector = new THREE.Vector3();
  for (const trees of bins.values()) {
    const species: TreeSpecies = assets.species[trees[0].placement.species];
    const bounds = new THREE.Box3();
    for (const { placement: p } of trees) {
      const r = species.radius * p.scale * Math.max(p.width, 1 / p.width) + 1;
      bounds.expandByPoint(vector.set(p.x - r, p.y - 1, p.z - r));
      bounds.expandByPoint(
        vector.set(p.x + r, p.y + species.height * p.scale + 1, p.z + r),
      );
    }
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const levels = species.lods.map((model, level) => {
      const parts: THREE.InstancedMesh[] = [];
      model.updateMatrixWorld(true);
      model.traverse((part) => {
        if (!(part instanceof THREE.Mesh)) return;
        if (Array.isArray(part.material))
          throw new Error('Tree primitives require one material each.');
        const batch = new THREE.InstancedMesh(
          part.geometry,
          part.material,
          trees.length,
        );
        batch.name = `${species.id} LOD${level}`;
        batch.userData.treeDetail = level;
        batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        // All imported primitives have transforms baked by the asset pipeline.
        batch.boundingBox = bounds.clone();
        batch.boundingSphere = sphere.clone();
        batch.castShadow = level < 2;
        batch.receiveShadow = true;
        batch.customDepthMaterial = assets.depthMaterials.get(part.material);
        batch.count = 0;
        batch.visible = false;
        parts.push(batch);
        forest.add(batch);
      });
      return parts;
    });
    tiles.push({ trees, levels });
  }
  const lastPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
  let lastQuality: Quality | undefined;
  const counts = [0, 0, 0];
  return {
    update(position: THREE.Vector3, quality: Quality) {
      if (
        quality === lastQuality &&
        lastPosition.distanceToSquared(position) < 16
      )
        return;
      lastPosition.copy(position);
      lastQuality = quality;
      counts.fill(0);
      for (const tile of tiles) {
        let changed = false;
        for (const tree of tile.trees) {
          const p = tree.placement;
          const distance = Math.hypot(
            p.x - position.x,
            p.y - position.y,
            p.z - position.z,
          );
          const level = treeDetailLevel(distance, tree.level, quality);
          if (level !== tree.level) changed = true;
          tree.level = level;
          counts[level]++;
        }
        // Most forest tiles keep their level as the car moves. Repack only
        // changed tiles; immutable instance transforms need no steady uploads.
        if (!changed) continue;
        const indices = [0, 0, 0];
        for (const tree of tile.trees) {
          const p = tree.placement;
          const level = tree.level;
          const index = indices[level]++;
          for (const batch of tile.levels[level]) {
            batch.setMatrixAt(index, tree.matrix);
            batch.setColorAt(index, p.color);
          }
        }
        for (let level = 0; level < 3; level++) {
          for (const batch of tile.levels[level]) {
            batch.count = indices[level];
            batch.visible = batch.count > 0;
            if (batch.count) {
              batch.instanceMatrix.needsUpdate = true;
              if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
            }
          }
        }
      }
      root.userData.treeLodCounts = [...counts];
    },
    // Geometry, material and textures are engine-owned. Only these instance
    // buffers belong to the world. Remove them before generic world disposal.
    dispose() {
      forest.traverse((object) => {
        if (object instanceof THREE.InstancedMesh) object.dispose();
      });
      forest.removeFromParent();
      forest.clear();
    },
  };
}
