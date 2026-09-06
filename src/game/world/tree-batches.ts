import * as THREE from 'three';
import type { Quality } from '../types';
import type { TreeAssets } from './tree-assets';

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
  readonly index: number;
  readonly placement: TreePlacement;
  readonly matrix: THREE.Matrix4;
  readonly bounds: THREE.Box3;
  readonly tiles: Tile[];
}
interface Tile {
  level: number;
  trees: PlantedTree[];
  parts: THREE.InstancedMesh[];
  bounds: THREE.Box3;
  sphere: THREE.Sphere;
  dirty: boolean;
}
/** Batch object transforms are immutable; instance matrices hold tree motion/LOD.
 * Cache only this owned subtree, retaining parent/world transform propagation.
 */
class TreeBatchGroup extends THREE.Group {
  private readonly previousWorld = new THREE.Matrix4();
  private initialized = false;

  override updateMatrixWorld() {
    if (this.matrixAutoUpdate) this.updateMatrix();
    if (this.parent)
      this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
    else this.matrixWorld.copy(this.matrix);
    if (this.initialized && this.previousWorld.equals(this.matrixWorld)) {
      this.matrixWorldNeedsUpdate = false;
      return;
    }
    this.previousWorld.copy(this.matrixWorld);
    this.initialized = true;
    // All owned batch nodes have fixed local matrices; parent changes still
    // propagate even for invisible/unoccupied batches before later LOD use.
    super.updateMatrixWorld(true);
  }
}

const TILE_SIZES = [80, 80, 320, 480];

/** Hysteresis prevents detail flicker when the camera hovers at a boundary. */
export function treeDetailLevel(
  distance: number,
  previous: number,
  quality: Quality,
  levelCount = 3,
) {
  const near = quality === 'ultra' ? 130 : quality === 'eco' ? 65 : 100;
  const middle = quality === 'ultra' ? 350 : quality === 'eco' ? 185 : 270;
  const distant = quality === 'ultra' ? 550 : quality === 'eco' ? 480 : 520;
  if (previous === 0 && distance < near + 12) return 0;
  if (levelCount > 3 && previous === 3 && distance > distant - 32) return 3;
  if (
    previous === 2 &&
    distance > middle - 20 &&
    (levelCount < 4 || distance < distant + 32)
  )
    return 2;
  return distance < near
    ? 0
    : distance < middle
      ? 1
      : levelCount < 4 || distance < distant
        ? 2
        : 3;
}

/** Spatial instancing with per-tree LOD selection. Every level is a 3D model. */
export function createTreeBatches(
  root: THREE.Group,
  assets: TreeAssets,
  placements: TreePlacement[],
) {
  const forest = new TreeBatchGroup();
  forest.name = 'volumetric forest';
  root.add(forest);
  const bins = new Map<string, Tile>();
  const tiles: Tile[] = [];
  const trees: PlantedTree[] = [];
  const object = new THREE.Object3D();
  // Include every LOD's vertical extent: coarse foliage can exceed near detail.
  const speciesBounds = assets.species.map((species) => {
    const bounds = new THREE.Box3();
    for (const lod of species.lods) bounds.expandByObject(lod);
    return bounds;
  });
  let levelCount = 3;
  for (const species of assets.species)
    levelCount = Math.max(levelCount, species.lods.length);
  for (const placement of placements) {
    const { x, y, z, yaw, scale, width, species } = placement;
    object.position.set(x, y, z);
    object.rotation.set(0, yaw, 0);
    object.scale.set(scale * width, scale, scale / width);
    object.updateMatrix();
    const model = assets.species[species];
    const extent = speciesBounds[species];
    const radius = model.radius * scale * Math.max(width, 1 / width) + 1;
    // Keep the existing canopy radius and one-metre wind margin in world space.
    const bounds = new THREE.Box3(
      new THREE.Vector3(
        x - radius,
        y + Math.min(0, extent.min.y) * scale - 1,
        z - radius,
      ),
      new THREE.Vector3(
        x + radius,
        y + Math.max(model.height, extent.max.y) * scale + 1,
        z + radius,
      ),
    );
    // This record is built once. LOD membership is held separately, so bins
    // share placement/matrix/bounds rather than cloning a tree for each level.
    const tree: PlantedTree = {
      index: trees.length,
      placement,
      matrix: object.matrix.clone(),
      bounds,
      tiles: [],
    };
    trees.push(tree);
    for (let level = 0; level < model.lods.length; level++) {
      const size = TILE_SIZES[level];
      const key = `${species}:${level}:${Math.floor(x / size)}:${Math.floor(z / size)}`;
      let tile = bins.get(key);
      if (!tile) {
        tile = {
          level,
          trees: [],
          parts: [],
          bounds: new THREE.Box3(),
          sphere: new THREE.Sphere(),
          dirty: false,
        };
        bins.set(key, tile);
        tiles.push(tile);
      }
      tile.trees.push(tree);
      tree.tiles.push(tile);
    }
  }
  for (const tile of tiles) {
    const species = assets.species[tile.trees[0].placement.species];
    const model = species.lods[tile.level];
    model.updateMatrixWorld(true);
    model.traverse((part) => {
      if (!(part instanceof THREE.Mesh)) return;
      if (Array.isArray(part.material))
        throw new Error('Tree primitives require one material each.');
      const batch = new THREE.InstancedMesh(
        part.geometry,
        part.material,
        tile.trees.length,
      );
      batch.name = `${species.id} LOD${tile.level}`;
      batch.matrixAutoUpdate = false;
      batch.userData.treeDetail = tile.level;
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Allocate color storage during construction, not first occupancy/update.
      batch.instanceColor = new THREE.InstancedBufferAttribute(
        new Float32Array(tile.trees.length * 3),
        3,
      ).setUsage(THREE.DynamicDrawUsage);
      // All imported primitives have transforms baked by the asset pipeline.
      // Occupancy alone controls visibility: beauty/shadow cameras independently
      // test these same conservative bounds through Three's ordinary frusta.
      batch.boundingBox = tile.bounds;
      batch.boundingSphere = tile.sphere;
      batch.castShadow = tile.level < 2;
      batch.receiveShadow = true;
      batch.customDepthMaterial = assets.depthMaterials.get(part.material);
      batch.count = 0;
      batch.visible = false;
      tile.parts.push(batch);
      forest.add(batch);
    });
  }
  const levels = new Int8Array(trees.length).fill(-1);
  const lastPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
  let lastQuality: Quality | undefined;
  const counts = Array.from({ length: levelCount }, () => 0);
  let disposed = false;
  return {
    update(position: THREE.Vector3, quality: Quality) {
      if (disposed) return;
      if (
        quality === lastQuality &&
        lastPosition.distanceToSquared(position) < 16
      )
        return;
      lastPosition.copy(position);
      lastQuality = quality;
      counts.fill(0);
      for (const tree of trees) {
        const p = tree.placement;
        const distance = Math.hypot(
          p.x - position.x,
          p.y - position.y,
          p.z - position.z,
        );
        const previous = levels[tree.index];
        const level = treeDetailLevel(
          distance,
          previous,
          quality,
          tree.tiles.length,
        );
        if (level !== previous) {
          if (previous >= 0) tree.tiles[previous].dirty = true;
          tree.tiles[level].dirty = true;
          levels[tree.index] = level;
        }
        counts[level]++;
      }
      // A transition dirties only its old/new LOD bins. Distant coarse bins and
      // unrelated detail bins retain both their occupied bounds and GPU data.
      for (const tile of tiles) {
        if (!tile.dirty) continue;
        tile.dirty = false;
        tile.bounds.makeEmpty();
        let count = 0;
        for (const tree of tile.trees) {
          if (levels[tree.index] !== tile.level) continue;
          tile.bounds.union(tree.bounds);
          for (const batch of tile.parts) {
            batch.setMatrixAt(count, tree.matrix);
            batch.setColorAt(count, tree.placement.color);
          }
          count++;
        }
        tile.bounds.getBoundingSphere(tile.sphere);
        for (const batch of tile.parts) {
          batch.count = count;
          batch.visible = count > 0;
          if (count) {
            batch.instanceMatrix.needsUpdate = true;
            batch.instanceColor!.needsUpdate = true;
          }
        }
      }
      root.userData.treeLodCounts = counts;
    },
    // Geometry, material and textures are engine-owned. Only these instance
    // buffers belong to the world. Remove them before generic world disposal.
    dispose() {
      if (disposed) return;
      disposed = true;
      forest.traverse((object) => {
        if (object instanceof THREE.InstancedMesh) object.dispose();
      });
      forest.removeFromParent();
      forest.clear();
    },
  };
}
