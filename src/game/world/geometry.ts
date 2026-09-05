import * as THREE from 'three';
import { Track } from '../tracks';
const _obj = new THREE.Object3D();
export function mesh(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

export function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
) {
  return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
}

export function instanced(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  transforms: {
    x: number;
    y: number;
    z: number;
    rx?: number;
    ry?: number;
    rz?: number;
    sx?: number;
    sy?: number;
    sz?: number;
    color?: THREE.Color;
  }[],
  cast = false,
) {
  const m = new THREE.InstancedMesh(geo, mat, transforms.length);
  transforms.forEach((t, i) => {
    _obj.position.set(t.x, t.y, t.z);
    _obj.rotation.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0);
    _obj.scale.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
    _obj.updateMatrix();
    m.setMatrixAt(i, _obj.matrix);
    if (t.color) m.setColorAt(i, t.color);
  });
  m.castShadow = cast;
  m.receiveShadow = true;
  m.computeBoundingSphere();
  return m;
}

export function ribbon(
  track: Track,
  left: number,
  right: number,
  y: number,
  start = 0,
  end = 512,
  uvScale = 2.5,
) {
  const segments = 512;
  const vertices: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let i = start; i <= end; i++) {
    const f = track.sample((i / segments) * track.length);
    for (const offset of [left, right]) {
      vertices.push(f.x + f.nx * offset, f.y + y, f.z + f.nz * offset);
      uvs.push(offset / uvScale, ((i / segments) * track.length) / uvScale);
    }
  }
  for (let i = 0; i < end - start; i++) {
    const a = i * 2;
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export function patch(
  track: Track,
  at: number,
  offset: number,
  width: number,
  length: number,
  mat: THREE.Material,
  height = 0.06,
) {
  const f = track.sample(at);
  const m = mesh(
    new THREE.PlaneGeometry(width, length),
    mat,
    f.x + f.nx * offset,
    f.y + height,
    f.z + f.nz * offset,
  );
  m.rotation.set(-Math.PI / 2, 0, -f.heading);
  return m;
}
