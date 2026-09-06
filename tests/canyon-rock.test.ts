import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Track, CIRCUITS } from '../src/game/tracks';
import { Landscape } from '../src/game/world/landscape';
import { buildCanyonRockFormations } from '../src/game/world/canyon-rock';

test('all canyon rock bounds clear the entire paved route, including nearby bends', () => {
  const track = new Track(CIRCUITS.find((c) => c.id === 'riviera')!);
  const root = new THREE.Group();
  const texture = new THREE.Texture();
  buildCanyonRockFormations(
    root,
    track,
    'sunset',
    { color: texture, normal: texture, rough: texture },
    new Landscape(track),
  );
  const frames = Array.from({ length: 2049 }, (_, i) =>
    track.sample((i / 2048) * track.length),
  );
  const matrix = new THREE.Matrix4(),
    position = new THREE.Vector3(),
    scale = new THREE.Vector3(),
    rotation = new THREE.Quaternion();
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  let instances = 0;
  for (const child of root.children) {
    assert.ok(child instanceof THREE.InstancedMesh);
    geometries.add(child.geometry);
    assert.ok(child.material instanceof THREE.MeshStandardMaterial);
    materials.add(child.material);
    assert.equal(child.material.map, texture);
    const p = child.geometry.getAttribute('position');
    for (const name of ['position', 'normal', 'color'])
      assert.ok(
        [...child.geometry.getAttribute(name).array].every(Number.isFinite),
      );
    for (let j = 0; j < child.count; j++) {
      instances++;
      child.getMatrixAt(j, matrix);
      matrix.decompose(position, rotation, scale);
      let radius = 0;
      for (let i = 0; i < p.count; i++)
        radius = Math.max(
          radius,
          Math.hypot(p.getX(i) * scale.x, p.getZ(i) * scale.z),
        );
      for (let i = 0; i < frames.length - 1; i++) {
        const a = frames[i],
          b = frames[i + 1],
          dx = b.x - a.x,
          dz = b.z - a.z;
        const u = Math.max(
          0,
          Math.min(
            1,
            ((position.x - a.x) * dx + (position.z - a.z) * dz) /
              (dx * dx + dz * dz),
          ),
        );
        const distance = Math.hypot(
          position.x - a.x - u * dx,
          position.z - a.z - u * dz,
        );
        assert.ok(
          distance - radius > track.circuit.width / 2 + 13,
          'rock footprint enters roadside clearance',
        );
      }
    }
    child.dispose();
  }
  assert.ok(instances > 0);
  assert.equal(root.userData.rockInstances, instances);
  assert.ok(geometries.size <= 12);
  assert.equal(materials.size, 1);
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  texture.dispose();
});
