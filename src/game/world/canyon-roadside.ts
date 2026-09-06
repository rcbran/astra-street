import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Track } from '../tracks';
import type { Weather } from '../types';
import { canvasTexture } from '../materials';
import { SPEED_TRAPS } from '../street-score';
import { instanced, mesh, patch } from './geometry';

type Placement = Parameters<typeof instanced>[2][number];

/** Spatial batches remain frustum-cullable; all resources belong to the world. */
function batches(
  root: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  placements: Placement[],
  name: string,
  shadows = false,
) {
  const tiles = new Map<string, Placement[]>();
  for (const p of placements) {
    const key = `${Math.floor(p.x / 240)}:${Math.floor(p.z / 240)}`;
    const tile = tiles.get(key) ?? [];
    tile.push(p);
    tiles.set(key, tile);
  }
  for (const [key, tile] of tiles) {
    const batch = instanced(geometry, material, tile, shadows);
    batch.name = `${name}:${key}`;
    root.add(batch);
  }
}

function combine(parts: THREE.BufferGeometry[]) {
  const result = mergeGeometries(parts, false)!;
  parts.forEach((part) => part.dispose());
  return result;
}

/** A world-owned soft glow, sharing the existing spatial batching/disposal path. */
function lampHalos(root: THREE.Group, poles: Placement[], weather: Weather) {
  const width = 4.4,
    height = 2.8,
    lensBias = 0.24;
  const geometry = new THREE.PlaneGeometry(width, height);
  // Billboard offsets rotate with the camera, not the instance. A sphere and
  // its enclosing cube conservatively cover every view, including lens bias.
  const radius = Math.hypot(width / 2, height / 2, lensBias) + 0.01;
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius);
  geometry.boundingBox = new THREE.Box3(
    new THREE.Vector3(-radius, -radius, -radius),
    new THREE.Vector3(radius, radius, radius),
  );
  const material = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: true,
    uniforms: {
      haloColor: { value: new THREE.Color(0xffc982) },
      coreColor: { value: new THREE.Color(0xffefd1) },
      strength: {
        value: weather === 'clear' ? 0.24 : weather === 'sunset' ? 0.62 : 0.72,
      },
    },
    vertexShader: /* glsl */ `
      varying vec2 haloUv;
      varying float visibility;
      void main() {
        haloUv = uv;
        vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        visibility = 1.0 - smoothstep(180.0, 350.0, -center.z);
        // A small forward offset avoids the opaque lens clipping its own glow;
        // terrain, trees, cars and other occluders still participate in depth.
        center.xyz += vec3(position.xy, ${lensBias.toFixed(2)});
        gl_Position = projectionMatrix * center;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 haloColor;
      uniform vec3 coreColor;
      uniform float strength;
      varying vec2 haloUv;
      varying float visibility;
      void main() {
        vec2 q = (haloUv - 0.5) * 2.0;
        float r2 = dot(q, q);
        float edge = 1.0 - smoothstep(0.45, 1.0, r2);
        float skirt = exp(-r2 * 4.0) * 0.42;
        float core = exp(-dot(q * vec2(2.0, 5.0), q * vec2(2.0, 5.0)) * 2.0);
        gl_FragColor = vec4(mix(haloColor, coreColor, core),
          (skirt + core * 0.85) * edge * strength * visibility);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const centers = poles.map((pole) => ({
    x: pole.x + Math.cos(pole.ry ?? 0) * 1.55,
    y: pole.y + 7.47,
    z: pole.z - Math.sin(pole.ry ?? 0) * 1.55,
  }));
  batches(root, geometry, material, centers, 'Canyon lamp halos');
}

/** Flush painted curbs follow the spline exactly, including the closed seam. */
function curbs(root: THREE.Group, track: Track, material: THREE.Material) {
  const half = track.circuit.width / 2;
  const count = Math.ceil(track.length / 4 / 2) * 2;
  const red = new THREE.Color(0xe63720),
    white = new THREE.Color(0xf4eee0);
  for (let start = 0; start < count; start += 32) {
    const positions: number[] = [],
      colors: number[] = [];
    for (let i = start; i < Math.min(start + 32, count); i++) {
      const a = track.sample((i * track.length) / count);
      const b = track.sample(((i + 1) * track.length) / count);
      const color = i % 2 ? white : red;
      for (const side of [-1, 1]) {
        const inner = side * half,
          outer = side * (half + 1.15);
        const points = [
          [a.x + a.nx * inner, a.y + 0.03, a.z + a.nz * inner],
          [a.x + a.nx * outer, a.y + 0.03, a.z + a.nz * outer],
          [b.x + b.nx * inner, b.y + 0.03, b.z + b.nz * inner],
          [b.x + b.nx * outer, b.y + 0.03, b.z + b.nz * outer],
        ];
        for (const index of side > 0
          ? [0, 2, 1, 1, 2, 3]
          : [0, 1, 2, 1, 3, 2]) {
          positions.push(...points[index]);
          colors.push(color.r, color.g, color.b);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const curb = mesh(geometry, material);
    curb.name = 'Canyon red and white curb';
    curb.receiveShadow = true;
    root.add(curb);
  }
  return count * 2;
}

export function buildCanyonRoadside(
  root: THREE.Group,
  track: Track,
  weather: Weather,
) {
  const half = track.circuit.width / 2;
  const wet = weather === 'rain';
  const metal = new THREE.MeshStandardMaterial({
    color: 0x262f2c,
    metalness: 0.35,
    roughness: 0.68,
  });
  const pale = new THREE.MeshStandardMaterial({
    color: 0xe8e3cd,
    roughness: 0.6,
  });
  const curbMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: wet ? 0.4 : 0.87,
  });
  const curbSections = curbs(root, track, curbMaterial);
  const bollards: Placement[] = [],
    poles: Placement[] = [];
  // These posts visibly trace the unchanged continuous simulation collision boundary.
  const count = Math.ceil(track.length / 8);
  for (let i = 0; i < count; i++) {
    const f = track.sample((i * track.length) / count);
    for (const side of [-1, 1])
      bollards.push({
        x: f.x + f.nx * side * (half + 7),
        y: f.y - 0.045,
        z: f.z + f.nz * side * (half + 7),
        ry: f.heading,
      });
  }
  for (let distance = 28, i = 0; distance < track.length; distance += 68, i++) {
    const f = track.sample(distance),
      side = i % 2 ? -1 : 1;
    poles.push({
      x: f.x + f.nx * side * (half + 7.5),
      y: f.y - 0.045,
      z: f.z + f.nz * side * (half + 7.5),
      ry: f.heading + (side > 0 ? Math.PI : 0),
    });
  }
  batches(
    root,
    new THREE.BoxGeometry(0.22, 0.95, 0.22).translate(0, 0.475, 0),
    metal,
    bollards,
    'Canyon boundary bollards',
    true,
  );
  batches(
    root,
    new THREE.BoxGeometry(0.225, 0.15, 0.225).translate(0, 0.77, 0),
    pale,
    bollards,
    'Canyon bollard reflectors',
  );
  const poleGeometry = combine([
    new THREE.CylinderGeometry(0.09, 0.15, 7.8, 6).translate(0, 3.9, 0),
    new THREE.BoxGeometry(2.1, 0.13, 0.13).translate(0.95, 7.65, 0),
    new THREE.BoxGeometry(1.25, 0.16, 0.42).translate(1.55, 7.57, 0),
  ]);
  batches(root, poleGeometry, metal, poles, 'Canyon light poles', true);
  // Emissive surfaces only: no unbounded point-light or shadow-map cost.
  const glow = new THREE.MeshStandardMaterial({
    color: 0xffedbf,
    emissive: 0xffd48d,
    emissiveIntensity: weather === 'clear' ? 1.2 : 2.4,
    roughness: 0.45,
  });
  batches(
    root,
    new THREE.BoxGeometry(1.16, 0.07, 0.34).translate(1.55, 7.47, 0),
    glow,
    poles,
    'Canyon lamp lenses',
  );
  lampHalos(root, poles, weather);

  const roadMap = canvasTexture(512, 1024, (context) => {
    context.clearRect(0, 0, 512, 1024);
    context.fillStyle = '#f4eee0';
    for (const y of [175, 320, 465]) {
      context.beginPath();
      context.moveTo(42, y + 84);
      context.lineTo(256, y);
      context.lineTo(470, y + 84);
      context.lineTo(470, y + 120);
      context.lineTo(256, y + 37);
      context.lineTo(42, y + 120);
      context.closePath();
      context.fill();
    }
    context.textAlign = 'center';
    context.font = '900 94px sans-serif';
    context.fillText('SPEED', 256, 790);
    context.fillText('CHECK', 256, 904);
  });
  const paint = new THREE.MeshStandardMaterial({
    map: roadMap,
    alphaTest: 0.4,
    roughness: wet ? 0.5 : 0.94,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  for (const fraction of SPEED_TRAPS) {
    const stencil = patch(
      track,
      fraction * track.length - 15,
      0,
      Math.min(7, track.circuit.width - 4),
      24,
      paint,
      0.035,
    );
    // Plane UV top must face forward (+Z), readable from the approaching car.
    stencil.rotation.z += Math.PI;
    stencil.name = 'Canyon speed check approach';
    stencil.receiveShadow = true;
    root.add(stencil);
  }

  const signMap = canvasTexture(1024, 256, (context) => {
    context.fillStyle = '#125b46';
    context.fillRect(0, 0, 1024, 256);
    context.strokeStyle = '#e5e9d8';
    context.lineWidth = 6;
    context.strokeRect(12, 12, 1000, 232);
    context.fillStyle = '#f2f3df';
    context.textAlign = 'center';
    context.font = '700 66px sans-serif';
    context.fillText('CANYON RUN', 512, 96);
    context.font = '500 37px sans-serif';
    context.fillText('SCENIC LOOP', 512, 155);
    for (const x of [175, 849]) {
      context.beginPath();
      context.moveTo(x - 22, 192);
      context.lineTo(x, 217);
      context.lineTo(x + 22, 192);
      context.moveTo(x, 170);
      context.lineTo(x, 214);
      context.stroke();
    }
  });
  const signMaterial = new THREE.MeshStandardMaterial({
    map: signMap,
    roughness: 0.8,
  });
  const gantries: Placement[] = [];
  for (const fraction of [0.32, 0.68]) {
    const f = track.sample(track.length * fraction);
    gantries.push({ x: f.x, y: f.y, z: f.z, ry: f.heading });
  }
  const gantryGeometry = combine([
    new THREE.BoxGeometry(0.3, 8.4, 0.3).translate(-half - 7.4, 4.2, 0),
    new THREE.BoxGeometry(0.3, 8.4, 0.3).translate(half + 7.4, 4.2, 0),
    new THREE.BoxGeometry(track.circuit.width + 15, 0.28, 0.3).translate(
      0,
      8.1,
      0,
    ),
    new THREE.BoxGeometry(12.2, 2.5, 0.2).translate(0, 7.6, 0),
  ]);
  batches(
    root,
    gantryGeometry,
    metal,
    gantries,
    'Canyon wayfinding gantries',
    true,
  );
  batches(
    root,
    new THREE.PlaneGeometry(12, 2.35).rotateY(Math.PI).translate(0, 7.6, -0.11),
    signMaterial,
    gantries,
    'Canyon green wayfinding signs',
  );
  root.userData.canyonRoadside = {
    curbSections,
    bollards: bollards.length,
    lamps: poles.length,
    wayfindingGantries: gantries.length,
    speedCheckStencils: SPEED_TRAPS.length,
  };
}
