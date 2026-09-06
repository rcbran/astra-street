import * as THREE from 'three';

type Component = {
  vertices: number[];
  triangles: number[];
  center: THREE.Vector3;
  area: number;
};

/** Recover complete disconnected twig/leaf surfaces, including split UV seams. */
function components(geometry: THREE.BufferGeometry): Component[] {
  const p = geometry.getAttribute('position');
  const index = geometry.index;
  const parent = Array.from({ length: p.count }, (_, i) => i);
  const find = (v: number): number => {
    while (parent[v] !== v) {
      parent[v] = parent[parent[v]];
      v = parent[v];
    }
    return v;
  };
  const join = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  const welded = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const key = `${Math.round(p.getX(i) * 100000)},${Math.round(p.getY(i) * 100000)},${Math.round(p.getZ(i) * 100000)}`;
    const other = welded.get(key);
    if (other !== undefined) join(i, other);
    else welded.set(key, i);
  }
  const count = index?.count ?? p.count;
  const vertex = (i: number) => (index ? index.getX(i) : i);
  for (let i = 0; i < count; i += 3) {
    join(vertex(i), vertex(i + 1));
    join(vertex(i), vertex(i + 2));
  }
  const groups = new Map<number, Component>();
  for (let i = 0; i < p.count; i++) {
    const root = find(i);
    let c = groups.get(root);
    if (!c) {
      c = { vertices: [], triangles: [], center: new THREE.Vector3(), area: 0 };
      groups.set(root, c);
    }
    c.vertices.push(i);
    c.center.add(new THREE.Vector3().fromBufferAttribute(p, i));
  }
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  for (let i = 0; i < count; i += 3) {
    const group = groups.get(find(vertex(i)))!;
    group.triangles.push(vertex(i), vertex(i + 1), vertex(i + 2));
    a.fromBufferAttribute(p, vertex(i));
    b.fromBufferAttribute(p, vertex(i + 1));
    c.fromBufferAttribute(p, vertex(i + 2));
    group.area += b.sub(a).cross(c.sub(a)).length() * 0.5;
  }
  return [...groups.values()]
    .filter((c) => c.triangles.length)
    .map((c) => {
      c.center.divideScalar(c.vertices.length);
      return c;
    });
}

function thinFoliage(
  source: THREE.BufferGeometry,
  budget: number,
  growth: number,
) {
  const all = components(source);
  source.computeBoundingBox();
  const box = source.boundingBox!;
  const height = Math.max(0.01, box.max.y - box.min.y);
  const bins = new Map<string, Component[]>();
  for (const c of all) {
    const y = Math.min(7, Math.floor(((c.center.y - box.min.y) / height) * 8));
    const yaw =
      Math.floor(
        ((Math.atan2(c.center.z, c.center.x) + Math.PI) / (2 * Math.PI)) * 8,
      ) % 8;
    const key = `${y}:${yaw}`;
    const bin = bins.get(key) ?? [];
    bin.push(c);
    bins.set(key, bin);
  }
  // Favor substantial outward sprays within each sector; round-robin selection
  // prevents dense lower branches consuming the crown's complete budget.
  for (const bin of bins.values())
    bin.sort(
      (a, b) =>
        (b.area / b.triangles.length) *
          (1 + Math.hypot(b.center.x, b.center.z) * 0.2) -
        (a.area / a.triangles.length) *
          (1 + Math.hypot(a.center.x, a.center.z) * 0.2),
    );
  const kept: Component[] = [];
  let used = 0;
  const selected = new Set<Component>();
  const keep = (component: Component) => {
    if (
      selected.has(component) ||
      used + component.triangles.length / 3 > budget
    )
      return;
    selected.add(component);
    kept.push(component);
    used += component.triangles.length / 3;
  };
  // Preserve silhouette anchors before sampling the interior crown. These are
  // complete original sprays, not synthetic planes bridging the crown.
  const positions = source.getAttribute('position');
  for (let axis = 0; axis < 3; axis++)
    for (const sign of [-1, 1]) {
      let extreme = -Infinity,
        anchor = all[0];
      for (const component of all)
        for (const vertex of component.vertices) {
          const value = positions.getComponent(vertex, axis) * sign;
          if (value > extreme) {
            extreme = value;
            anchor = component;
          }
        }
      keep(anchor);
    }
  const ordered = [...bins.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (let round = 0; ordered.some(([, bin]) => round < bin.length); round++) {
    for (const [, bin] of ordered) {
      const c = bin[round];
      if (c) keep(c);
    }
  }
  if (!kept.length)
    throw new Error('Distant foliage budget is smaller than a complete twig.');
  const out = new THREE.BufferGeometry();
  // Preserve every original per-corner UV/normal; only positions grow locally.
  // No crown-scale planes, new triangles, atlas changes or reoriented sprays.
  for (const [name, attribute] of Object.entries(source.attributes)) {
    const values: number[] = [];
    for (const component of kept)
      for (const i of component.triangles) {
        for (let axis = 0; axis < attribute.itemSize; axis++) {
          let value = attribute.getComponent(i, axis);
          if (name === 'position') {
            const center = component.center.getComponent(axis);
            value = center + (value - center) * growth;
          }
          values.push(value);
        }
      }
    out.setAttribute(
      name,
      new THREE.Float32BufferAttribute(values, attribute.itemSize),
    );
  }
  out.computeBoundingBox();
  out.computeBoundingSphere();
  out.userData = {
    sourceComponents: all.length,
    keptComponents: kept.length,
    occupiedSectors: bins.size,
    sourceArea: all.reduce((sum, component) => sum + component.area, 0),
    selectedArea: kept.reduce(
      (sum, component) => sum + component.area * growth * growth,
      0,
    ),
    growth,
  };
  return out;
}

/**
 * Fourth conifer LOD, built once from an already transform-baked LOD2 group.
 * Caller owns returned geometries; materials/textures remain source-owned.
 * CPU extent checks cannot establish alpha coverage or acceptable LOD changes.
 */
export function createDistantTree(
  source: THREE.Group,
  triangleBudget = 2400,
): THREE.Group {
  const out = new THREE.Group();
  out.name = source.name.replace(/LOD2/, 'LOD3');
  const parts: THREE.Mesh[] = [];
  source.traverse((object) => {
    if (object instanceof THREE.Mesh) parts.push(object);
  });
  const foliage = (part: THREE.Mesh) => {
    if (Array.isArray(part.material))
      throw new Error('Expected one material per tree primitive.');
    return (
      part.material.userData.foliage === true ||
      (part.material instanceof THREE.MeshStandardMaterial &&
        (part.material.alphaTest > 0 || part.material.transparent))
    );
  };
  const leaves = parts.filter(foliage),
    wood = parts.filter((p) => !foliage(p));
  const triangles = (g: THREE.BufferGeometry) =>
    (g.index?.count ?? g.getAttribute('position').count) / 3;
  if (
    wood.reduce((sum, part) => sum + triangles(part.geometry), 0) >=
    triangleBudget - 100
  )
    throw new Error('Distant tree budget cannot preserve the source wood.');
  let woodCount = 0;
  for (const part of wood) {
    // Preserve the complete wood mesh. Collapsing the broadleaf's branches
    // produced fins in the gallery, so that species keeps its three source LODs.
    const geometry = part.geometry.clone();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    woodCount += triangles(geometry);
    const mesh = new THREE.Mesh(geometry, part.material);
    mesh.name = part.name;
    out.add(mesh);
  }
  const foliageBudget = Math.max(100, triangleBudget - woodCount);
  const total = leaves.reduce((sum, p) => sum + triangles(p.geometry), 0);
  for (const part of leaves) {
    const budget = Math.floor(
      (foliageBudget * triangles(part.geometry)) / total,
    );
    const geometry = thinFoliage(part.geometry, budget, 1.22);
    const mesh = new THREE.Mesh(geometry, part.material);
    mesh.name = part.name;
    out.add(mesh);
  }
  return out;
}
