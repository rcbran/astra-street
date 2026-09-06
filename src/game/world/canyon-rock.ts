import * as THREE from 'three';
import { Track, seeded } from '../tracks';
import type { Weather } from '../types';
import { instanced } from './geometry';
import { Landscape, terrainNoise } from './landscape';

type Transform = Parameters<typeof instanced>[2][number];
type StoneTextures = {
  color: THREE.Texture;
  normal: THREE.Texture;
  rough: THREE.Texture;
};

// A sandstone buttress, not a scaled terrain mound. Vertical ribs run through
// uneven bedding; erosion removes individual beds between those ribs. Every
// profile has a different fractured rim and overhang pattern. Dimensions are
// normalized here; world-space material projection keeps the grain in metres.
export function canyonButtressGeometry(seed: number) {
  const rand = seeded(seed);
  const sides = 64;
  const levels = 40;
  const phase = rand() * 80;
  const joints = Array.from({ length: 5 }, (_, i) => ({
    angle: (i / 5 + rand() * 0.07) * Math.PI * 2,
    width: 0.055 + rand() * 0.06,
    depth: 0.055 + rand() * 0.075,
  }));
  const shelves = [
    0.23 + rand() * 0.1,
    0.53 + rand() * 0.12,
    0.83 + rand() * 0.06,
  ];
  const squareness = 4 + rand() * 2;
  const positions: number[] = [],
    colors: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const rings = Array.from({ length: levels + 1 }, (_, i) => ({
    t: i / levels,
    roof: 1,
  }));
  rings.push({ t: 1, roof: 0.72 }, { t: 1, roof: 0.36 }, { t: 1, roof: 0 });
  for (const { t, roof } of rings) {
    for (let side = 0; side <= sides; side++) {
      const a = ((side % sides) / sides) * Math.PI * 2;
      const ca = Math.cos(a),
        sa = Math.sin(a);
      // Rounded rectangular faces keep broad planes between worn corners.
      // Joints persist vertically; only three irregular shelves interrupt them.
      const block =
        1 /
        Math.pow(
          Math.pow(Math.abs(ca), squareness) +
            Math.pow(Math.abs(sa), squareness),
          1 / squareness,
        );
      let cleft = 0;
      for (const joint of joints) {
        const delta = Math.atan2(
          Math.sin(a - joint.angle),
          Math.cos(a - joint.angle),
        );
        cleft += Math.exp(-Math.pow(delta / joint.width, 2)) * joint.depth;
      }
      let shelf = 0,
        recess = 0;
      for (let bed = 0; bed < shelves.length; bed++) {
        const h = shelves[bed] + ca * 0.022 + sa * 0.016;
        // Shelf strength varies around a face, avoiding a continuous torus.
        const strength =
          0.35 + 0.65 * terrainNoise(ca * 2 + phase + bed * 7, sa * 2);
        shelf +=
          (1 - THREE.MathUtils.smoothstep(t, h - 0.035, h + 0.015)) *
          0.023 *
          strength;
        recess += Math.exp(-Math.pow((t - h - 0.018) / 0.018, 2)) * strength;
      }
      const chip = terrainNoise(ca * 9 + phase, sa * 9 + t * 15);
      const flank = terrainNoise(ca * 2 + phase, sa * 2 + phase);
      const radius =
        (0.285 * block +
          flank * 0.065 -
          cleft +
          shelf -
          recess * 0.014 +
          (chip - 0.5) * 0.016 +
          (1 - THREE.MathUtils.smoothstep(t, 0, 0.2)) * 0.055 -
          THREE.MathUtils.smoothstep(t, 0.92, 1) * 0.025) *
        roof;
      const rim = 0.83 + terrainNoise(ca * 3 + phase, sa * 3 + phase) * 0.28;
      const y = t * rim - 0.055 + (1 - roof) * 0.025;
      positions.push(ca * radius, y, sa * radius);
      uv.push(side / sides, t);
      // Linear-space tint: the scan already contains the warm rock colour.
      // Broad mineral bands are intentionally stronger than the tiny grain.
      const pale = THREE.MathUtils.smoothstep(
        terrainNoise(ca * 2 + phase, sa * 2 + t * 3.5),
        0.45,
        0.7,
      );
      const shade =
        (0.83 + pale * 0.17) * (1 - Math.min(0.32, cleft * 2) - recess * 0.15);
      colors.push(
        shade,
        shade * (0.68 + pale * 0.3),
        shade * (0.48 + pale * 0.48),
      );
    }
  }
  for (let y = 0; y < rings.length - 1; y++)
    for (let x = 0; x < sides; x++) {
      const a = y * (sides + 1) + x,
        b = a + sides + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

// Fallen blocks use low, fractured convex meshes instead of miniature towers.
function canyonBoulderGeometry(seed: number) {
  const geometry = new THREE.IcosahedronGeometry(0.55, 2);
  const p = geometry.getAttribute('position');
  const colors: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const n = terrainNoise(x * 6 + seed, z * 6 + y * 3);
    const r = 0.82 + n * 0.35;
    p.setXYZ(i, x * r, y * r * 0.8 + 0.28, z * r);
    colors.push(0.9 + n * 0.1, 0.82 + n * 0.12, 0.68 + n * 0.2);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

// All three channels share projection, scale and blending. Normal detail is
// reoriented around each geometric plane so flat normal texels leave the
// sculpted silhouette normals unchanged. No texture clones or per-frame work.
function canyonStoneMaterial(textures: StoneTextures, weather: Weather) {
  const material = new THREE.MeshStandardMaterial({
    map: textures.color,
    normalMap: textures.normal,
    roughnessMap: textures.rough,
    vertexColors: true,
    roughness: weather === 'rain' ? 0.79 : 0.96,
    envMapIntensity: 0.42,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
      varying vec3 vStonePosition;
      varying vec3 vStoneNormal;`,
      )
      .replace(
        '#include <defaultnormal_vertex>',
        `#include <defaultnormal_vertex>
      vStoneNormal = inverseTransformDirection(transformedNormal, viewMatrix);`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      vec4 stoneWorld = vec4(position, 1.0);
      #ifdef USE_INSTANCING
        stoneWorld = instanceMatrix * stoneWorld;
      #endif
      vStonePosition = (modelMatrix * stoneWorld).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
      varying vec3 vStonePosition;
      varying vec3 vStoneNormal;`,
      )
      .replace(
        '#include <map_fragment>',
        `
      vec3 stoneN = normalize(vStoneNormal);
      vec3 stoneWeights = pow(abs(stoneN), vec3(5.0));
      stoneWeights /= max(dot(stoneWeights, vec3(1.0)), 0.0001);
      vec3 stoneP = vStonePosition / 9.0;
      vec3 stoneAlbedo = texture2D(map, stoneP.zy).rgb * stoneWeights.x
        + texture2D(map, stoneP.xz).rgb * stoneWeights.y
        + texture2D(map, stoneP.xy).rgb * stoneWeights.z;
      diffuseColor.rgb *= stoneAlbedo;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `
      vec3 stoneX = texture2D(normalMap, stoneP.zy).xyz * 2.0 - 1.0;
      vec3 stoneY = texture2D(normalMap, stoneP.xz).xyz * 2.0 - 1.0;
      vec3 stoneZ = texture2D(normalMap, stoneP.xy).xyz * 2.0 - 1.0;
      vec3 stoneDetail = vec3(stoneX.z * stoneN.x, stoneX.y + stoneN.y, stoneX.x + stoneN.z) * stoneWeights.x
        + vec3(stoneY.x + stoneN.x, stoneY.z * stoneN.y, stoneY.y + stoneN.z) * stoneWeights.y
        + vec3(stoneZ.x + stoneN.x, stoneZ.y + stoneN.y, stoneZ.z * stoneN.z) * stoneWeights.z;
      normal = normalize(mat3(viewMatrix) * normalize(mix(stoneN, stoneDetail, 0.7)));`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `
      float stoneRough = texture2D(roughnessMap, stoneP.zy).g * stoneWeights.x
        + texture2D(roughnessMap, stoneP.xz).g * stoneWeights.y
        + texture2D(roughnessMap, stoneP.xy).g * stoneWeights.z;
      float roughnessFactor = roughness * max(0.55, stoneRough);`,
      );
  };
  material.customProgramCacheKey = () => 'astra-sculpted-canyon-v1';
  return material;
}

export function buildCanyonRockFormations(
  root: THREE.Group,
  track: Track,
  weather: Weather,
  textures: StoneTextures,
  landscape: Landscape,
) {
  const rand = seeded(9482);
  const material = canyonStoneMaterial(textures, weather);
  const geometries = [
    ...Array.from({ length: 8 }, (_, i) =>
      canyonButtressGeometry(921 + i * 71),
    ),
    ...Array.from({ length: 4 }, (_, i) => canyonBoulderGeometry(53 + i * 29)),
  ];
  const groups: Transform[][] = geometries.map(() => []);
  // nearestDistance samples every twelfth frame. This added sampling margin
  // exceeds half of that spacing; the enclosing circle then protects *all*
  // triangles, including other bends on the closed track, not just this frame.
  const clearance = track.circuit.width / 2 + 13 + (track.length / 2048) * 6;
  const place = (
    x: number,
    z: number,
    width: number,
    height: number,
    depth: number,
    heading: number,
    variant: number,
    pale = false,
  ) => {
    const geometry = geometries[variant];
    const p = geometry.getAttribute('position');
    let radius = 0;
    for (let i = 0; i < p.count; i++)
      radius = Math.max(
        radius,
        Math.hypot(p.getX(i) * width, p.getZ(i) * depth),
      );
    if (track.nearestDistance(x, z) < radius + clearance) return false;
    let base = landscape.height(x, z);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      base = Math.min(
        base,
        landscape.height(x + Math.cos(a) * radius, z + Math.sin(a) * radius),
      );
    }
    groups[variant].push({
      x,
      y: base - 2,
      z,
      ry: heading,
      sx: width,
      sy: height,
      sz: depth,
      color: new THREE.Color().setRGB(
        pale ? 1.35 : 0.94 + rand() * 0.06,
        pale ? 1.55 : 0.85 + rand() * 0.1,
        pale ? 1.7 : 0.8 + rand() * 0.12,
      ),
    });
    landscape.registerVegetationObstacle(x, z, radius);
    return true;
  };
  for (let at = 0; at < track.length; at += 64) {
    for (const side of [-1, 1]) {
      const f = track.sample(at + rand() * 15);
      const variant = Math.floor(rand() * 8);
      const width = 52 + rand() * 32,
        depth = 60 + rand() * 32;
      const setback =
        86 + terrainNoise(f.x * 0.009 + side * 20, f.z * 0.009) * 31;
      const x = f.x + f.nx * side * setback,
        z = f.z + f.nz * side * setback;
      const height =
        78 + terrainNoise(f.x * 0.008 + 17, f.z * 0.009 + side * 30) * 95;
      const placed = place(
        x,
        z,
        width,
        height,
        depth,
        f.heading + rand() * 0.35,
        variant,
      );
      if (!placed) continue;
      // Off-centre attached towers break broad walls into separate vertical
      // masses; lower buttresses and fallen blocks give a legible human scale.
      place(
        x + f.tx * 29 - f.nx * side * 24,
        z + f.tz * 29 - f.nz * side * 24,
        30 + rand() * 18,
        height * (0.45 + rand() * 0.28),
        35 + rand() * 17,
        f.heading + 0.3,
        (variant + 3) % 8,
      );
      for (let j = 0; j < 4; j++) {
        const along = (rand() - 0.5) * 84;
        const near = 34 + rand() * 27;
        const pale = j === 0 && Math.floor(at / 64) % 7 === (side > 0 ? 0 : 3);
        const s = pale ? 32 + rand() * 15 : 5 + rand() ** 2 * 17;
        place(
          x + f.tx * along - f.nx * side * near,
          z + f.tz * along - f.nz * side * near,
          s * 1.4,
          s * (pale ? 1.15 : 0.9),
          s * 1.1,
          rand() * Math.PI * 2,
          8 + j,
          pale,
        );
      }
    }
  }
  let count = 0;
  for (let i = 0; i < groups.length; i++) {
    const tiles = new Map<string, Transform[]>();
    for (const t of groups[i]) {
      const key = `${Math.floor(t.x / 160)},${Math.floor(t.z / 160)}`;
      const tile = tiles.get(key) ?? [];
      tile.push(t);
      tiles.set(key, tile);
    }
    if (!groups[i].length) geometries[i].dispose();
    for (const transforms of tiles.values()) {
      const batch = instanced(geometries[i], material, transforms, true);
      batch.name = 'sculpted sandstone canyon';
      root.add(batch);
      count += transforms.length;
    }
  }
  if (!count) material.dispose();
  root.userData.rockInstances = count;
}
