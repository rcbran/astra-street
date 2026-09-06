import * as THREE from 'three';

/** Reposition intact needle sprays; never stretch their cutout textures. */
export function lowerConiferCrown(
  geometry: THREE.BufferGeometry,
  height: number,
  crownBase: number,
  foliage: boolean,
) {
  const position = geometry.getAttribute('position');
  const base = height * 0.07;
  const remap = (y: number) =>
    y < crownBase
      ? (y / crownBase) * base
      : base + ((y - crownBase) / (height - crownBase)) * (height - base);
  if (foliage) {
    // GLTF twig meshes contain separate connected cutout sprays. Union only
    // indexed triangle vertices so a spray translates as one rigid component.
    const parent = Int32Array.from({ length: position.count }, (_, i) => i);
    const find = (vertex: number): number => {
      let root = vertex;
      while (parent[root] !== root) root = parent[root];
      while (parent[vertex] !== vertex) {
        const next = parent[vertex];
        parent[vertex] = root;
        vertex = next;
      }
      return root;
    };
    const index = geometry.index;
    const count = index?.count ?? position.count;
    for (let i = 0; i < count; i += 3) {
      const a = find(index ? index.getX(i) : i);
      parent[find(index ? index.getX(i + 1) : i + 1)] = a;
      parent[find(index ? index.getX(i + 2) : i + 2)] = a;
    }
    const bounds = new Map<number, { min: number; max: number }>();
    for (let i = 0; i < position.count; i++) {
      const root = find(i),
        y = position.getY(i);
      const range = bounds.get(root) ?? { min: Infinity, max: -Infinity };
      range.min = Math.min(range.min, y);
      range.max = Math.max(range.max, y);
      bounds.set(root, range);
    }
    for (let i = 0; i < position.count; i++) {
      const range = bounds.get(find(i))!;
      const center = (range.min + range.max) / 2;
      // Keep oversized coarse sprays above the ground as well.
      const shift = Math.max(
        remap(center) - center,
        height * 0.035 - range.min,
      );
      position.setY(i, position.getY(i) + shift);
    }
  } else {
    // Wood follows the same crown-height mapping, retaining branch attachment
    // topology. Recompute normals for its changed slopes, leaving UVs intact.
    for (let i = 0; i < position.count; i++)
      position.setY(i, remap(position.getY(i)));
    geometry.computeVertexNormals();
  }
  position.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
