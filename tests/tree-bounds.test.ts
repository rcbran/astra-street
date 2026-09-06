import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import {
  createTreeBatches,
  treeDetailLevel,
  type TreePlacement,
} from '../src/game/world/tree-batches';
import type { TreeAssets } from '../src/game/world/tree-assets';

function fixture(levelCounts = [3]) {
  const material = new THREE.MeshStandardMaterial();
  const depth = new THREE.MeshDepthMaterial();
  const geometries: THREE.BufferGeometry[] = [];
  const species = levelCounts.map((count, index) => ({
    id: `test${index}`,
    height: 20,
    radius: Math.sqrt(8),
    lods: Array.from({ length: count }, (_, level) => {
      const height = 20 + level * 2;
      const geometry = new THREE.BoxGeometry(4, height, 4).translate(
        0,
        height / 2 - 0.5,
        0,
      );
      geometries.push(geometry);
      return new THREE.Group().add(
        new THREE.Mesh(geometry, material),
        new THREE.Mesh(geometry, material),
      );
    }),
  }));
  return {
    assets: {
      species,
      depthMaterials: new Map([[material, depth]]),
    } as unknown as TreeAssets,
    material,
    depth,
    geometries,
    dispose() {
      geometries.forEach((g) => g.dispose());
      material.dispose();
      depth.dispose();
    },
  };
}
function placement(x: number, species = 0): TreePlacement {
  return {
    x,
    y: 3,
    z: 0,
    yaw: 0.7,
    scale: 1.2,
    width: 1.3,
    color: new THREE.Color('white'),
    species,
  };
}
function batches(root: THREE.Group) {
  const result: THREE.InstancedMesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.InstancedMesh) result.push(o);
  });
  return result;
}
function occupiedRepresentatives(root: THREE.Group) {
  const bounds = new Set<THREE.Box3>();
  return batches(root).filter((b) => {
    if (!b.count || bounds.has(b.boundingBox!)) return false;
    bounds.add(b.boundingBox!);
    return true;
  });
}
function xs(batch: THREE.InstancedMesh) {
  const matrix = new THREE.Matrix4();
  return Array.from({ length: batch.count }, (_, i) => {
    batch.getMatrixAt(i, matrix);
    return matrix.elements[12];
  });
}
function verifyMembershipAndBounds(root: THREE.Group, expected: number[]) {
  const placed = occupiedRepresentatives(root)
    .flatMap(xs)
    .sort((a, b) => a - b);
  assert.deepEqual(
    placed,
    [...expected].sort((a, b) => a - b),
    'each placement occurs exactly once across LODs and bins',
  );
  const matrix = new THREE.Matrix4(),
    point = new THREE.Vector3();
  for (const batch of batches(root)) {
    assert.equal(batch.visible, batch.count > 0);
    assert.equal(batch.frustumCulled, true);
    assert.equal(batch.castShadow, batch.userData.treeDetail < 2);
    if (!batch.count) {
      assert.ok(batch.boundingBox!.isEmpty());
      assert.ok(batch.boundingSphere!.isEmpty());
    }
    const positions = batch.geometry.getAttribute('position');
    for (let instance = 0; instance < batch.count; instance++) {
      batch.getMatrixAt(instance, matrix);
      for (let vertex = 0; vertex < positions.count; vertex++) {
        point.fromBufferAttribute(positions, vertex).applyMatrix4(matrix);
        assert.ok(batch.boundingBox!.containsPoint(point));
        assert.ok(batch.boundingSphere!.containsPoint(point));
      }
    }
  }
}

test('LOD selection preserves three levels and supports a hysteretic optional fourth model', () => {
  for (const [quality, near, middle, distant] of [
    ['eco', 65, 185, 480],
    ['balanced', 100, 270, 520],
    ['ultra', 130, 350, 550],
  ] as const) {
    assert.equal(treeDetailLevel(near + 11, 0, quality), 0);
    assert.equal(treeDetailLevel(middle - 19, 2, quality), 2);
    assert.equal(treeDetailLevel(10000, 2, quality), 2);
    assert.equal(treeDetailLevel(distant + 31, 2, quality, 4), 2);
    assert.equal(treeDetailLevel(distant + 33, 2, quality, 4), 3);
    assert.equal(treeDetailLevel(distant - 31, 3, quality, 4), 3);
    assert.equal(treeDetailLevel(distant - 33, 3, quality, 4), 2);
    assert.equal(treeDetailLevel(distant, -1, quality, 4), 3);
    assert.equal(
      treeDetailLevel(0, 3, quality, 4),
      0,
      'teleport can skip levels',
    );
  }
});

test('per-LOD occupied bins retain crown/wind bounds and independent beauty/shadow frusta', () => {
  const f = fixture(),
    root = new THREE.Group();
  const positions = [10, 120, 155];
  const forest = createTreeBatches(
    root,
    f.assets,
    positions.map((x) => placement(x)),
  );
  forest.update(new THREE.Vector3(), 'balanced');
  assert.deepEqual(root.userData.treeLodCounts, [1, 2, 0]);
  verifyMembershipAndBounds(root, positions);
  const occupied = occupiedRepresentatives(root);
  const near = occupied.find((b) => b.userData.treeDetail === 0)!;
  const middle = occupied.find((b) => b.userData.treeDetail === 1)!;
  const radius = Math.sqrt(8) * 1.2 * 1.3 + 1;
  assert.equal(near.boundingBox!.min.x, 10 - radius);
  assert.equal(near.boundingBox!.max.x, 10 + radius);
  assert.equal(middle.boundingBox!.min.x, 120 - radius);
  assert.equal(middle.boundingBox!.max.x, 155 + radius);
  assert.equal(near.boundingBox!.min.y, 3 - 0.5 * 1.2 - 1);
  assert.equal(near.boundingBox!.max.y, 3 + 23.5 * 1.2 + 1);
  for (const batch of batches(root)) {
    const sibling = batches(root).find(
      (b) => b !== batch && b.boundingBox === batch.boundingBox,
    )!;
    assert.equal(batch.boundingSphere, sibling.boundingSphere);
    assert.equal(batch.customDepthMaterial, f.depth);
  }
  const beauty = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().makeOrthographic(-20, 45, 60, -20, -60, 60),
  );
  const shadow = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().makeOrthographic(90, 180, 60, -20, -60, 60),
  );
  assert.ok(beauty.intersectsSphere(near.boundingSphere!));
  assert.equal(beauty.intersectsSphere(middle.boundingSphere!), false);
  assert.ok(shadow.intersectsSphere(middle.boundingSphere!));
  assert.equal(
    middle.visible,
    true,
    'beauty rejection never disables shadow membership',
  );
  forest.update(new THREE.Vector3(-140, 0, 0), 'balanced');
  assert.deepEqual(root.userData.treeLodCounts, [0, 2, 1]);
  verifyMembershipAndBounds(root, positions);
  assert.equal(
    occupiedRepresentatives(root).filter((b) => b.userData.treeDetail === 1)
      .length,
    2,
    '80 m middle bins split remote trees',
  );
  forest.update(new THREE.Vector3(-1000, 0, 0), 'balanced');
  assert.deepEqual(root.userData.treeLodCounts, [0, 0, 3]);
  assert.equal(
    occupiedRepresentatives(root).length,
    1,
    '320 m far bin combines all three trees',
  );
  verifyMembershipAndBounds(root, positions);
  forest.dispose();
  f.dispose();
});

test('only old/new LOD bins repack; steady updates retain buffers, bounds and upload versions', () => {
  const f = fixture(),
    root = new THREE.Group(),
    positions = [10, 82, 95, 120, 700];
  const forest = createTreeBatches(
    root,
    f.assets,
    positions.map((x) => placement(x)),
  );
  forest.update(new THREE.Vector3(), 'balanced');
  const all = batches(root);
  const old = occupiedRepresentatives(root).find((b) => xs(b).includes(95))!;
  const next = occupiedRepresentatives(root).find((b) => xs(b).includes(120))!;
  const snapshots = all.map((b) => ({
    b,
    box: b.boundingBox,
    sphere: b.boundingSphere,
    matrix: b.instanceMatrix,
    color: b.instanceColor,
    mv: b.instanceMatrix.version,
    cv: b.instanceColor!.version,
  }));
  forest.update(new THREE.Vector3(-20, 0, 0), 'balanced');
  verifyMembershipAndBounds(root, positions);
  assert.deepEqual(xs(old), [82]);
  assert.deepEqual(xs(next), [95, 120]);
  for (const snap of snapshots) {
    assert.equal(snap.b.boundingBox, snap.box);
    assert.equal(snap.b.boundingSphere, snap.sphere);
    assert.equal(snap.b.instanceMatrix, snap.matrix);
    assert.equal(snap.b.instanceColor, snap.color);
    const changed =
      snap.box === old.boundingBox || snap.box === next.boundingBox;
    assert.equal(snap.b.instanceMatrix.version, snap.mv + (changed ? 1 : 0));
    assert.equal(snap.b.instanceColor!.version, snap.cv + (changed ? 1 : 0));
  }
  const versions = all.map((b) => b.instanceMatrix.version);
  forest.update(new THREE.Vector3(-21, 0, 0), 'balanced');
  forest.update(new THREE.Vector3(-25, 0, 0), 'balanced');
  assert.deepEqual(
    all.map((b) => b.instanceMatrix.version),
    versions,
  );
  forest.dispose();
  f.dispose();
});

test('mixed three/four-model species transition without duplicate placement and release only instance ownership', () => {
  const f = fixture([3, 4]),
    root = new THREE.Group();
  const forest = createTreeBatches(root, f.assets, [
    placement(700),
    placement(710, 1),
  ]);
  const all = batches(root);
  const disposed = new Map(all.map((b) => [b, 0]));
  for (const b of all)
    b.addEventListener('dispose', () => disposed.set(b, disposed.get(b)! + 1));
  let assetDisposals = 0;
  for (const resource of [...f.geometries, f.material, f.depth])
    resource.addEventListener('dispose', () => assetDisposals++);
  const check = (cameraX: number, counts: number[]) => {
    forest.update(new THREE.Vector3(cameraX, 0, 0), 'balanced');
    assert.deepEqual(root.userData.treeLodCounts, counts);
    verifyMembershipAndBounds(root, [700, 710]);
  };
  check(0, [0, 0, 1, 1]);
  const distant = occupiedRepresentatives(root).find(
    (b) => b.userData.treeDetail === 3,
  )!;
  assert.equal(
    distant.boundingBox!.max.y,
    3 + 25.5 * 1.2 + 1,
    'fourth model crown included',
  );
  check(210, [0, 0, 1, 1]); // 500 m remains distant under hysteresis.
  check(230, [0, 0, 2, 0]); // 480 m returns to LOD2.
  check(180, [0, 0, 2, 0]); // 530 m retains LOD2.
  check(150, [0, 0, 1, 1]); // 560 m crosses outward threshold.
  forest.dispose();
  forest.dispose();
  forest.update(new THREE.Vector3(710, 0, 0), 'ultra');
  assert.equal(root.children.length, 0);
  assert.ok([...disposed.values()].every((n) => n === 1));
  assert.equal(assetDisposals, 0);
  f.dispose();
});

test('optional distant bins coalesce across a 320 m far-bin boundary', () => {
  const f = fixture([4]),
    root = new THREE.Group();
  const positions = [310, 330];
  const forest = createTreeBatches(
    root,
    f.assets,
    positions.map((x) => placement(x)),
  );
  forest.update(new THREE.Vector3(-1000, 0, 0), 'balanced');
  assert.deepEqual(root.userData.treeLodCounts, [0, 0, 0, 2]);
  assert.equal(
    occupiedRepresentatives(root).length,
    1,
    'both trees share a 480 m distant bin',
  );
  verifyMembershipAndBounds(root, positions);
  forest.update(new THREE.Vector3(), 'balanced');
  assert.deepEqual(root.userData.treeLodCounts, [0, 0, 2, 0]);
  assert.equal(
    occupiedRepresentatives(root).length,
    2,
    '320 m LOD2 boundary splits the same trees',
  );
  verifyMembershipAndBounds(root, positions);
  forest.dispose();
  f.dispose();
});

test('static tree world transforms stay cached while parent motion updates occupied and empty LOD bins', () => {
  const f = fixture([4]);
  const scene = new THREE.Scene(),
    root = new THREE.Group();
  scene.add(root);
  const forest = createTreeBatches(root, f.assets, [
    placement(30),
    placement(700),
  ]);
  const group = root.getObjectByName('volumetric forest')!;
  const all = batches(root);
  let descendantUpdates = 0;
  for (const batch of all) {
    const update = batch.updateMatrixWorld.bind(batch);
    batch.updateMatrixWorld = (force) => {
      descendantUpdates++;
      update(force);
    };
  }
  forest.update(new THREE.Vector3(), 'balanced');
  scene.updateMatrixWorld(true);
  assert.equal(descendantUpdates, all.length);
  // Wet-road reflection repeats this operation in the same rendered frame.
  descendantUpdates = 0;
  scene.updateMatrixWorld(true);
  scene.updateMatrixWorld();
  assert.equal(descendantUpdates, 0);
  root.position.set(8, 3, -5);
  root.rotation.y = 0.7;
  root.scale.set(1.3, 0.9, 1.6);
  group.position.set(4, 0, -2);
  scene.updateMatrixWorld();
  assert.equal(descendantUpdates, all.length);
  const expected = new THREE.Matrix4().multiplyMatrices(
    root.matrixWorld,
    group.matrix,
  );
  for (const batch of all) assert.ok(batch.matrixWorld.equals(expected));
  descendantUpdates = 0;
  forest.update(new THREE.Vector3(700, 0, 0), 'ultra');
  scene.updateMatrixWorld(true);
  assert.equal(descendantUpdates, 0);
  verifyMembershipAndBounds(root, [30, 700]);
  for (const batch of all) assert.ok(batch.matrixWorld.equals(expected));
  forest.dispose();
  f.dispose();
});
