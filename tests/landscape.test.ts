import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as THREE from 'three';
import { CIRCUITS, Track } from '../src/game/tracks';
import { Landscape } from '../src/game/world/landscape';

test('sculpted terrain keeps every route and its paved runoff unobstructed', () => {
  for (const circuit of CIRCUITS) {
    const track = new Track(circuit),
      terrain = new Landscape(track);
    for (let i = 0; i < 512; i++) {
      const f = track.sample((i / 512) * track.length);
      for (const offset of [-circuit.width / 2 - 4, 0, circuit.width / 2 + 4]) {
        assert.ok(
          terrain.height(f.x + f.nx * offset, f.z + f.nz * offset) < -0.1,
          `${circuit.id} terrain enters paved corridor at ${i}`,
        );
      }
    }
    assert.ok(Math.max(...terrain.heights) > 180);
    if (terrain.coastal)
      assert.ok(terrain.height(550, 0) < -1.1, 'ocean remains exposed');
  }
});

test('tree root heights agree with rendered terrain triangles on uneven cells', () => {
  const terrain = new Landscape(new Track(CIRCUITS[0]));
  const geometry = new THREE.PlaneGeometry(terrain.step, terrain.step, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(
    terrain.min + terrain.step / 2,
    0,
    terrain.min + terrain.step / 2,
  );
  // A saddle makes bilinear interpolation visibly disagree with the mesh.
  const heights = [1, 4, 8, 2];
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < 4; i++) {
    positions.setY(i, heights[i]);
    terrain.heights[(i >> 1) * terrain.count + (i % 2)] = heights[i];
  }
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.updateMatrixWorld();
  const ray = new THREE.Raycaster();
  for (const [tx, tz] of [
    [0.2, 0.3],
    [0.8, 0.7],
    [0.3, 0.7],
    [0.7, 0.2],
  ]) {
    const x = terrain.min + tx * terrain.step,
      z = terrain.min + tz * terrain.step;
    ray.set(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(mesh)[0];
    assert.ok(hit);
    assert.ok(Math.abs(terrain.height(x, z) - hit.point.y) < 1e-5);
  }
  geometry.dispose();
  material.dispose();
});
