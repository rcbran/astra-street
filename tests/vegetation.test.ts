import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {
  createTreeBatches,
  treeDetailLevel,
} from '../src/game/world/tree-batches';
import type { TreeAssets } from '../src/game/world/tree-assets';
import { CIRCUITS, Track } from '../src/game/tracks';
import { Landscape } from '../src/game/world/landscape';

test('tree detail retains its level around boundaries and respects quality', () => {
  assert.equal(treeDetailLevel(105, 0, 'balanced'), 0);
  assert.equal(treeDetailLevel(105, 1, 'balanced'), 1);
  assert.equal(treeDetailLevel(265, 2, 'balanced'), 2);
  assert.equal(treeDetailLevel(245, 2, 'balanced'), 1);
  assert.equal(treeDetailLevel(125, 1, 'ultra'), 0);
  assert.equal(treeDetailLevel(75, 1, 'eco'), 1);
});

test('forest batches keep every tree exactly once and release only owned instances', () => {
  const geometry = new THREE.CylinderGeometry(0.5, 1, 20, 6);
  geometry.translate(0, 10, 0);
  const material = new THREE.MeshStandardMaterial();
  const lods = [0, 1, 2].map(() =>
    new THREE.Group().add(new THREE.Mesh(geometry, material)),
  );
  let geometryDisposed = 0,
    materialDisposed = 0,
    instancesDisposed = 0;
  geometry.addEventListener('dispose', () => geometryDisposed++);
  material.addEventListener('dispose', () => materialDisposed++);
  const assets = {
    species: [{ id: 'fir-test', lods, height: 20, radius: 1 }],
    depthMaterials: new Map(),
  } as unknown as TreeAssets;
  const root = new THREE.Group();
  const forest = createTreeBatches(
    root,
    assets,
    [20, 170, 450].map((x) => ({
      x,
      y: 0,
      z: 0,
      yaw: 0.5,
      scale: 1,
      width: 1,
      color: new THREE.Color('white'),
      species: 0,
    })),
  );
  root.traverse((o) => {
    if (o instanceof THREE.InstancedMesh)
      o.addEventListener('dispose', () => instancesDisposed++);
  });
  const count = () => {
    let total = 0;
    root.traverse((o) => {
      if (o instanceof THREE.InstancedMesh && o.visible) total += o.count;
    });
    return total;
  };
  forest.update(new THREE.Vector3(), 'balanced');
  assert.deepEqual(root.userData.treeLodCounts, [1, 1, 1]);
  assert.equal(count(), 3);
  forest.update(new THREE.Vector3(430, 0, 0), 'balanced');
  assert.equal(count(), 3);
  forest.update(new THREE.Vector3(430, 0, 0), 'ultra');
  assert.equal(count(), 3);
  forest.dispose();
  assert.equal(root.children.length, 0);
  assert.equal(instancesDisposed, 9);
  assert.equal(geometryDisposed, 0);
  assert.equal(materialDisposed, 0);
  geometry.dispose();
  material.dispose();
});

test('cliff footprints reject embedded vegetation across spatial cell edges', () => {
  const terrain = new Landscape(new Track(CIRCUITS[0]));
  terrain.registerVegetationObstacle(99, 99, 55);
  assert.equal(terrain.vegetationClear(120, 105), false);
  assert.equal(terrain.vegetationClear(159, 99, 8), false);
  assert.equal(terrain.vegetationClear(160, 99, 0), true);
  assert.equal(terrain.vegetationClear(-100, -100), true);
});
