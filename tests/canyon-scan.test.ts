import * as THREE from 'three';
import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanyonScanAssets } from '../src/game/world/canyon-scan-assets';
import { buildCanyonScanFormations } from '../src/game/world/canyon-scan-formations';
import { Landscape } from '../src/game/world/landscape';
import { Track, CIRCUITS } from '../src/game/tracks';

interface ScanDocument {
  accessors: {
    bufferView: number;
    count: number;
    type: 'SCALAR' | 'VEC2' | 'VEC3' | 'VEC4';
    componentType: 5123 | 5125 | 5126;
    byteOffset?: number;
  }[];
  bufferViews: { byteOffset?: number; byteStride?: number }[];
  meshes: {
    primitives: { attributes: Record<string, number>; indices: number }[];
  }[];
  nodes: Record<string, unknown>[];
}

test('actual canyon scan shells preserve fronts, close boundaries, clear the whole road and release only owned buffers', () => {
  const sources = ['namaqualand_cliff_01', 'namaqualand_cliff_02'].map((id) => {
    const file = fs.readFileSync(
      new URL(`../public/assets/models/rocks/${id}.glb`, import.meta.url),
    );
    const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
    const jl = view.getUint32(12, true),
      j = JSON.parse(
        new TextDecoder().decode(file.subarray(20, 20 + jl)),
      ) as ScanDocument,
      bin = new DataView(
        file.buffer,
        file.byteOffset + 28 + jl,
        file.byteLength - 28 - jl,
      );
    // These authored derivatives bake all transforms. Reject a future export
    // that would make this CPU geometry fixture differ from GLTFLoader.
    assert.equal(j.nodes.length, 1);
    for (const key of ['translation', 'rotation', 'scale', 'matrix'])
      assert.equal(j.nodes[0][key], undefined);
    const read = (index: number) => {
      const a = j.accessors[index],
        v = j.bufferViews[a.bufferView],
        n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
      const array = new Float32Array(a.count * n);
      const bytes = { 5126: 4, 5125: 4, 5123: 2 }[a.componentType];
      for (let i = 0; i < a.count; i++)
        for (let k = 0; k < n; k++) {
          const p =
            (v.byteOffset ?? 0) +
            (a.byteOffset ?? 0) +
            i * (v.byteStride ?? n * bytes) +
            k * bytes;
          array[i * n + k] =
            a.componentType === 5126
              ? bin.getFloat32(p, true)
              : a.componentType === 5125
                ? bin.getUint32(p, true)
                : bin.getUint16(p, true);
        }
      return new THREE.BufferAttribute(array, n);
    };
    const primitive = j.meshes[0].primitives[0],
      geometry = new THREE.BufferGeometry();
    for (const [gl, attr] of Object.entries({
      POSITION: 'position',
      NORMAL: 'normal',
      TEXCOORD_0: 'uv',
      TANGENT: 'tangent',
    }))
      geometry.setAttribute(attr, read(primitive.attributes[gl]));
    geometry.setIndex(Array.from(read(primitive.indices).array));
    const material = new THREE.MeshStandardMaterial({
      map: new THREE.Texture(),
      normalMap: new THREE.Texture(),
      roughnessMap: new THREE.Texture(),
    });
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(geometry, material));
    return { id, scene, geometry };
  });
  const originals = sources.map((s) => s.geometry.clone());
  const assets = createCanyonScanAssets(sources);
  assets.scans.forEach((scan, i) => {
    const original = originals[i];
    for (const attribute of ['position', 'uv']) {
      const a = original.getAttribute(attribute),
        b = scan.geometry.getAttribute(attribute);
      for (let k = 0; k < a.array.length; k++)
        assert.equal(
          a.array[k],
          b.array[k],
          `${scan.id} original ${attribute} preserved`,
        );
    }
    original.computeBoundingBox();
    const p = scan.geometry.getAttribute('position'),
      frontCount = original.getAttribute('position').count;
    for (let k = frontCount; k < frontCount * 2; k++)
      assert(
        p.getZ(k) < original.boundingBox!.min.z,
        'rear stays behind every original front vertex',
      );
    original.dispose();
  });
  let sharedDisposals = 0;
  for (const resource of [
    ...assets.geometries,
    ...assets.materials,
    ...assets.textures,
  ])
    resource.addEventListener('dispose', () => sharedDisposals++);
  const track = new Track(CIRCUITS.find((c) => c.id === 'riviera')!);
  const topology = assets.scans.map((scan) => {
    const p = scan.geometry.getAttribute('position'),
      edges = new Map<string, number>();
    const key = (i: number) =>
      [p.getX(i), p.getY(i), p.getZ(i)]
        .map((v) => Math.round(v * 1e5))
        .join(',');
    const idx = scan.geometry.index!.array;
    for (let i = 0; i < idx.length; i += 3)
      for (const [a, b] of [
        [idx[i], idx[i + 1]],
        [idx[i + 1], idx[i + 2]],
        [idx[i + 2], idx[i]],
      ]) {
        const k = [key(a), key(b)].sort().join(':');
        edges.set(k, (edges.get(k) ?? 0) + 1);
      }
    const open = [...edges.values()].filter((n) => n === 1).length;
    assert.equal(open, 0);
    return {
      id: scan.id,
      triangles: scan.triangles,
      boundaryEdges: scan.geometry.userData.scanBoundaryEdges,
      openEdges: open,
      nonManifoldEdges: [...edges.values()].filter((n) => n > 2).length,
      bounds: scan.bounds,
    };
  });
  const reports = [];
  for (let cycle = 0; cycle < 2; cycle++) {
    const root = new THREE.Group(),
      landscape = new Landscape(track),
      obstacles: { x: number; z: number; radius: number }[] = [];
    const register = landscape.registerVegetationObstacle.bind(landscape);
    landscape.registerVegetationObstacle = (x, z, radius) => {
      obstacles.push({ x, z, radius });
      register(x, z, radius);
    };
    const formations = buildCanyonScanFormations(
      root,
      track,
      landscape,
      assets,
    );
    assert(formations.triangles <= 960000);
    assert(formations.count > 30);
    let clearance = Infinity;
    for (const o of obstacles) {
      let distance = Infinity;
      for (let i = 0; i < track.count; i++) {
        const a = track.frames[i],
          b = track.frames[i + 1],
          dx = b.x - a.x,
          dz = b.z - a.z;
        const u = THREE.MathUtils.clamp(
          ((o.x - a.x) * dx + (o.z - a.z) * dz) / (dx * dx + dz * dz),
          0,
          1,
        );
        distance = Math.min(
          distance,
          Math.hypot(o.x - a.x - u * dx, o.z - a.z - u * dz),
        );
      }
      clearance = Math.min(
        clearance,
        distance - o.radius - track.circuit.width / 2,
      );
      assert(!landscape.vegetationClear(o.x, o.z));
    }
    assert(clearance >= 14);
    let vertexChecks = 0,
      batches = 0,
      bufferDisposals = 0,
      ownedDisposals = 0,
      actualTriangles = 0;
    const matrix = new THREE.Matrix4(),
      v = new THREE.Vector3();
    root.traverse((object) => {
      if (!(object instanceof THREE.InstancedMesh)) return;
      batches++;
      object.addEventListener('dispose', () => bufferDisposals++);
      if (!assets.geometries.has(object.geometry)) {
        object.geometry.addEventListener('dispose', () => ownedDisposals++);
      }
      const p = object.geometry.getAttribute('position');
      actualTriangles +=
        ((object.geometry.index?.count ?? p.count) / 3) * object.count;
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix);
        for (let k = 0; k < p.count; k++) {
          v.fromBufferAttribute(p, k).applyMatrix4(matrix);
          assert(Number.isFinite(v.x + v.y + v.z));
          assert(
            obstacles.some(
              (o) => Math.hypot(v.x - o.x, v.z - o.z) <= o.radius + 0.0001,
            ),
            'all scan and backing vertices inside registered clearance footprint',
          );
          vertexChecks++;
        }
      }
    });
    assert.equal(actualTriangles, formations.triangles);
    reports.push({
      cycle,
      scanInstances: formations.count,
      registeredFootprints: obstacles.length,
      triangles: formations.triangles,
      batches,
      minPavedEdgeClearance: clearance,
      vertexChecks,
    });
    formations.dispose();
    formations.dispose();
    assert.equal(root.children.length, 0);
    assert.equal(sharedDisposals, 0);
    assert.equal(bufferDisposals, batches);
    assert.equal(ownedDisposals, 0);
  }
  assets.dispose();
  assets.dispose();
  assert.equal(
    sharedDisposals,
    assets.geometries.size + assets.materials.size + assets.textures.size,
  );
  assert.deepEqual({ ...reports[0], cycle: 1 }, reports[1]);
  assert.equal(topology.length, 2);
});
