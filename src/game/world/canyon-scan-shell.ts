import * as THREE from 'three';

/**
 * Preserve the scan's +Z-facing surface verbatim, reflect a shallow copy behind
 * its rearmost point, and stitch its open boundaries. UV seams are welded only
 * for edge discovery; all original front normals and UVs remain untouched.
 * The caller owns the returned geometry. The input remains caller-owned.
 */
export function closeCanyonScan(
  front: THREE.BufferGeometry,
  patch = [0.35, 0.58, 0.1, 0.12],
) {
  const p = front.getAttribute('position');
  const normal = front.getAttribute('normal');
  const uv = front.getAttribute('uv');
  front.computeBoundingBox();
  const size = front.boundingBox!.getSize(new THREE.Vector3());
  const backPlane = front.boundingBox!.min.z - 0.02;
  const rearScale = 0.18;
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = [];
  for (let rear = 0; rear < 2; rear++)
    for (let i = 0; i < p.count; i++) {
      positions.push(
        p.getX(i),
        p.getY(i),
        rear ? backPlane - (p.getZ(i) - backPlane) * rearScale : p.getZ(i),
      );
      const n = new THREE.Vector3(
        normal.getX(i),
        normal.getY(i),
        rear ? -normal.getZ(i) / rearScale : normal.getZ(i),
      ).normalize();
      normals.push(n.x, n.y, n.z);
      uvs.push(uv.getX(i), uv.getY(i));
    }
  const ids = new Map<string, number>();
  const welded: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const key = `${Math.round(p.getX(i) * 1e5)},${Math.round(p.getY(i) * 1e5)},${Math.round(p.getZ(i) * 1e5)}`;
    if (!ids.has(key)) ids.set(key, ids.size);
    welded.push(ids.get(key)!);
  }
  const edges = new Map<string, { a: number; b: number; count: number }>();
  const indices: number[] = [];
  const source = front.index
    ? Array.from(front.index.array)
    : Array.from({ length: p.count }, (_, i) => i);
  for (let i = 0; i < source.length; i += 3) {
    const [a, b, c] = source.slice(i, i + 3);
    indices.push(a, b, c, c + p.count, b + p.count, a + p.count);
    for (const [v, w] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const key = [welded[v], welded[w]].sort((x, y) => x - y).join(':');
      const edge = edges.get(key);
      if (edge) edge.count++;
      else edges.set(key, { a: v, b: w, count: 1 });
    }
  }
  let boundaryEdges = 0;
  for (const { a, b, count } of edges.values()) {
    if (count !== 1) continue;
    boundaryEdges++;
    // Separate side vertices provide hard edge normals and a finite UV strip.
    const start = positions.length / 3;
    const va = new THREE.Vector3().fromBufferAttribute(p, a);
    const vb = new THREE.Vector3().fromBufferAttribute(p, b);
    const vc = new THREE.Vector3(
      p.getX(a),
      p.getY(a),
      positions[(a + p.count) * 3 + 2],
    );
    const n = vc.clone().sub(va).cross(vb.clone().sub(va)).normalize();
    for (const [vertex, rear] of [
      [a, 0],
      [a, 1],
      [b, 0],
      [b, 1],
    ]) {
      const index = vertex + rear * p.count;
      positions.push(...positions.slice(index * 3, index * 3 + 3));
      normals.push(n.x, n.y, n.z);
      // Closure surfaces sample an inspected interior rock island, never the
      // padded gaps surrounding the source UV islands. Project in the side's
      // depth/height plane so the new thickness receives finite texture area.
      const depth = (positions[index * 3 + 2] - backPlane) / (size.z * 1.2);
      const vertical = p.getY(vertex) / size.y;
      uvs.push(
        patch[0] + (depth + 0.2) * patch[2],
        patch[1] + vertical * patch[3],
      );
    }
    indices.push(start, start + 1, start + 2, start + 2, start + 1, start + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.scanFrontVertices = p.count;
  geometry.userData.scanBoundaryEdges = boundaryEdges;
  return geometry;
}
