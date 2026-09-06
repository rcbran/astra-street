import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Track, seeded } from '../tracks';
import type { Weather } from '../types';
import { canvasTexture } from '../materials';

interface Placement {
  x: number;
  z: number;
  y: number;
  yaw: number;
  length?: number;
  shade?: number;
}

/** World-owned meshes, materials and canvas maps: normal world disposal owns all of them. */
function tiledInstances(
  root: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  placements: Placement[],
  name: string,
  shadows = false,
) {
  const bins = new Map<string, Placement[]>();
  for (const placement of placements) {
    const key = `${Math.floor(placement.x / 240)}:${Math.floor(placement.z / 240)}`;
    const bin = bins.get(key) ?? [];
    bin.push(placement);
    bins.set(key, bin);
  }
  const transform = new THREE.Object3D();
  const color = new THREE.Color();
  for (const [key, bin] of bins) {
    const instances = new THREE.InstancedMesh(geometry, material, bin.length);
    instances.name = `${name}:${key}`;
    for (let i = 0; i < bin.length; i++) {
      const p = bin[i];
      transform.position.set(p.x, p.y, p.z);
      transform.rotation.set(0, p.yaw, 0);
      transform.scale.set(1, 1, p.length ?? 1);
      transform.updateMatrix();
      instances.setMatrixAt(i, transform.matrix);
      if (p.shade !== undefined)
        instances.setColorAt(i, color.setScalar(p.shade));
    }
    instances.castShadow = shadows;
    instances.receiveShadow = true;
    instances.computeBoundingSphere();
    root.add(instances);
  }
}

/** A folded W-beam, not a rectangular concrete barrier. The beam axis is local Z. */
function guardrailSection() {
  const profile = [
    [0.012, -0.165],
    [-0.025, -0.15],
    [-0.068, -0.1],
    [-0.052, -0.055],
    [0.02, 0],
    [-0.052, 0.055],
    [-0.068, 0.1],
    [-0.025, 0.15],
    [0.012, 0.165],
  ];
  const positions: number[] = [],
    uvs: number[] = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const a = profile[i],
      b = profile[i + 1];
    for (const [point, z] of [
      [a, -0.5],
      [b, -0.5],
      [a, 0.5],
      [a, 0.5],
      [b, -0.5],
      [b, 0.5],
    ] as [number[], number][]) {
      positions.push(point[0], point[1], z);
      uvs.push((point[1] + 0.165) * 3, z + 0.5);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

function combine(parts: THREE.BufferGeometry[]) {
  const result = mergeGeometries(parts, false)!;
  for (const part of parts) part.dispose();
  return result;
}

function painted(geometry: THREE.BufferGeometry, hex: number) {
  const color = new THREE.Color(hex);
  const values = new Float32Array(geometry.getAttribute('position').count * 3);
  for (let i = 0; i < values.length; i += 3) color.toArray(values, i);
  geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
  return geometry;
}

/** Continuous rural guardrails remain on the simulation's half-width + 7 m collision edge. */
export function buildRuralRoadside(
  root: THREE.Group,
  track: Track,
  weather: Weather,
) {
  if (track.circuit.id === 'marina') return;
  const wet = weather === 'rain';
  const half = track.circuit.width / 2;
  const random = seeded(track.circuit.id === 'forest' ? 7931 : 8931);
  const steelMap = canvasTexture(128, 128, (context) => {
    context.fillStyle = '#969d9e';
    context.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 1800; i++) {
      const light = 125 + Math.floor(random() * 50);
      context.fillStyle = `rgba(${light},${light + 3},${light + 4},.22)`;
      context.fillRect(
        random() * 128,
        random() * 128,
        1 + random() * 3,
        1 + random() * 2,
      );
    }
  });
  steelMap.wrapS = steelMap.wrapT = THREE.RepeatWrapping;
  const steel = new THREE.MeshStandardMaterial({
    map: steelMap,
    color: 0xd6dcda,
    metalness: 0.68,
    roughness: wet ? 0.38 : 0.61,
    side: THREE.DoubleSide,
    envMapIntensity: 0.5,
  });
  const reflectorMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.54,
    metalness: 0.03,
  });
  // Flanged steel posts, stand-off brackets and two hex bolt heads share one batch.
  const post = combine([
    new THREE.BoxGeometry(0.055, 0.9, 0.09).translate(0.115, -0.28, 0),
    new THREE.BoxGeometry(0.13, 0.9, 0.018).translate(0.115, -0.28, -0.045),
    new THREE.BoxGeometry(0.13, 0.9, 0.018).translate(0.115, -0.28, 0.045),
    new THREE.BoxGeometry(0.17, 0.19, 0.1).translate(0.1, 0, 0),
    new THREE.CylinderGeometry(0.016, 0.016, 0.018, 6)
      .rotateZ(Math.PI / 2)
      .translate(-0.077, -0.095, 0),
    new THREE.CylinderGeometry(0.016, 0.016, 0.018, 6)
      .rotateZ(Math.PI / 2)
      .translate(-0.077, 0.095, 0),
  ]);
  const delineator = combine([
    painted(
      new THREE.BoxGeometry(0.105, 1.05, 0.07).translate(0, 0.525, 0),
      0xdadbd0,
    ),
    painted(
      new THREE.BoxGeometry(0.108, 0.22, 0.073).translate(0, 0.83, 0),
      0x252d2b,
    ),
    painted(
      new THREE.BoxGeometry(0.057, 0.1, 0.076).translate(0, 0.845, 0),
      0xe8ae43,
    ),
    painted(
      new THREE.BoxGeometry(0.075, 0.018, 0.075).translate(0, 0.977, 0),
      0xf0edd8,
    ),
  ]);
  const rails: Placement[] = [],
    posts: Placement[] = [],
    markers: Placement[] = [];
  const count = Math.ceil(track.length / 4);
  const spacing = track.length / count;
  for (let i = 0; i < count; i++) {
    const a = track.sample(i * spacing),
      b = track.sample((i + 1) * spacing);
    for (const side of [-1, 1]) {
      const offset = side * (half + 7);
      const ax = a.x + a.nx * offset,
        az = a.z + a.nz * offset;
      const bx = b.x + b.nx * offset,
        bz = b.z + b.nz * offset;
      rails.push({
        x: (ax + bx) / 2,
        y: (a.y + b.y) / 2 + 0.68,
        z: (az + bz) / 2,
        yaw: Math.atan2(bx - ax, bz - az) + (side < 0 ? Math.PI : 0),
        length: Math.hypot(bx - ax, bz - az) + 0.045,
        shade: 0.91 + random() * 0.08,
      });
      posts.push({
        x: ax,
        y: a.y + 0.68,
        z: az,
        yaw: a.heading + (side < 0 ? Math.PI : 0),
      });
      if (i % 5 === 0) {
        const markerOffset = side * (half + 7.48);
        markers.push({
          x: a.x + a.nx * markerOffset,
          y: a.y - 0.025,
          z: a.z + a.nz * markerOffset,
          yaw: a.heading,
        });
      }
    }
  }
  tiledInstances(root, guardrailSection(), steel, rails, 'Rural guardrail');
  tiledInstances(root, post, steel, posts, 'Rural guardrail hardware', true);
  tiledInstances(
    root,
    delineator,
    reflectorMaterial,
    markers,
    'Road delineators',
    true,
  );

  // Restrained worn dashed paint leaves the existing road-edge lines untouched.
  const paintMap = canvasTexture(64, 256, (context) => {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 1700; i++) {
      context.clearRect(
        random() * 64,
        random() * 256,
        random() * 2 + 0.4,
        random() * 4 + 0.7,
      );
    }
  });
  const paint = new THREE.MeshStandardMaterial({
    map: paintMap,
    color: track.circuit.id === 'forest' ? 0xd6d4b8 : 0xcbb36e,
    alphaTest: 0.4,
    roughness: wet ? 0.48 : 0.94,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const stripes: Placement[] = [];
  for (let distance = 14; distance < track.length - 12; distance += 12) {
    const f = track.sample(distance);
    stripes.push({
      x: f.x,
      y: f.y + 0.025,
      z: f.z,
      yaw: f.heading,
      shade: 0.86 + random() * 0.12,
    });
  }
  tiledInstances(
    root,
    new THREE.PlaneGeometry(0.12, 4).rotateX(-Math.PI / 2),
    paint,
    stripes,
    'Worn centre paint',
  );
  root.userData.ruralRoadside = {
    guardrailSections: rails.length,
    posts: posts.length,
    delineators: markers.length,
    centreDashes: stripes.length,
  };
}
