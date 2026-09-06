import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCanyonScanAssets } from '../src/game/world/canyon-scan-assets';

function source(id: string) {
  const geometry = new THREE.BoxGeometry(4, 6, 2);
  const texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughnessMap: texture,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(1, 3, -2);
  const scene = new THREE.Group().add(mesh);
  scene.position.set(20, -4, 12);
  scene.rotation.y = 0.7;
  scene.scale.set(2, 1.5, 3);
  const events = { geometry: 0, material: 0, texture: 0 };
  geometry.addEventListener('dispose', () => events.geometry++);
  material.addEventListener('dispose', () => events.material++);
  texture.addEventListener('dispose', () => events.texture++);
  return { id, scene, geometry, material, texture, mesh, events };
}

test('scan import bakes the full hierarchy without mutating source vertices and owns shared resources once', () => {
  const input = source('test-cliff');
  input.scene.updateMatrixWorld(true);
  const original = input.geometry.getAttribute('position').array.slice();
  const expected = input.geometry.clone().applyMatrix4(input.mesh.matrixWorld);
  const assets = createCanyonScanAssets([input]);
  assert.deepEqual(input.geometry.getAttribute('position').array, original);
  assert.deepEqual(
    assets.scans[0].geometry
      .getAttribute('position')
      .array.slice(0, original.length),
    expected.getAttribute('position').array,
  );
  assert.equal(assets.geometries.size, 1);
  assert.equal(assets.materials.size, 1);
  assert.equal(assets.textures.size, 1);
  assert.deepEqual(input.events, { geometry: 1, material: 0, texture: 0 });
  assert.equal(assets.scans[0].triangles, 24);
  let bakedDisposals = 0;
  assets.scans[0].geometry.addEventListener('dispose', () => bakedDisposals++);
  // A later engine environment binding remains owned by the engine.
  const environment = new THREE.Texture();
  let environmentDisposals = 0;
  environment.addEventListener('dispose', () => environmentDisposals++);
  input.material.envMap = environment;
  assets.dispose();
  assets.dispose();
  assert.deepEqual(input.events, { geometry: 1, material: 1, texture: 1 });
  assert.equal(bakedDisposals, 1);
  assert.equal(environmentDisposals, 0);
  environment.dispose();
  expected.dispose();
});

test('a malformed scan releases every loaded source, including later sources and already baked geometry', () => {
  const first = source('first'),
    malformed = source('malformed'),
    last = source('last');
  malformed.scene.add(new THREE.Mesh(malformed.geometry, malformed.material));
  let bakedDisposals = 0;
  const clone = first.geometry.clone.bind(first.geometry);
  first.geometry.clone = () => {
    const geometry = clone();
    geometry.addEventListener('dispose', () => bakedDisposals++);
    return geometry;
  };
  assert.throws(
    () => createCanyonScanAssets([first, malformed, last]),
    /one standard-material primitive/,
  );
  for (const input of [first, malformed, last])
    assert.deepEqual(input.events, { geometry: 1, material: 1, texture: 1 });
  assert.equal(bakedDisposals, 1);
});
