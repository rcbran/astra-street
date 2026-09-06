import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { bindEnvironmentLighting } from '../src/game/environment-lighting';

test('shared lighting preserves material response through repeated weather changes', () => {
  const material = new THREE.MeshStandardMaterial({ envMapIntensity: 0.2 });
  const geometry = new THREE.BoxGeometry();
  const root = new THREE.Group().add(
    new THREE.Mesh(geometry, material),
    new THREE.Mesh(geometry, material),
  );
  const map = new THREE.Texture(),
    rotation = new THREE.Euler(0, 1.5, 0);
  bindEnvironmentLighting(root, map, rotation, 0.75);
  assert.equal(material.envMap, map);
  assert.ok(Math.abs(material.envMapIntensity - 0.15) < 1e-10);
  bindEnvironmentLighting(root, map, rotation, 0.24);
  assert.ok(Math.abs(material.envMapIntensity - 0.048) < 1e-10);
  bindEnvironmentLighting(root, map, rotation, 1);
  assert.equal(material.envMapIntensity, 0.2);
  assert.equal(material.envMapRotation.y, 1.5);
  let mapDisposed = false;
  map.addEventListener('dispose', () => {
    mapDisposed = true;
  });
  material.dispose();
  assert.equal(
    mapDisposed,
    false,
    'disposing a material keeps the engine map alive',
  );
  geometry.dispose();
  map.dispose();
});
