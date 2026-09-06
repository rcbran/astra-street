import * as THREE from 'three';
import { Track } from '../tracks';
import {
  groundSurfaces,
  rockSurfaces,
  type SurfaceTextures,
} from '../materials';
import type { Weather } from '../types';

// Coherent, deterministic relief. No noise sampling or terrain allocation in
// the render loop; trees and rocks share the same interpolated height field.
export function terrainNoise(x: number, z: number): number {
  const hash = (a: number, b: number) => {
    const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const ix = Math.floor(x),
    iz = Math.floor(z);
  let fx = x - ix,
    fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(hash(ix, iz), hash(ix + 1, iz), fx),
    THREE.MathUtils.lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), fx),
    fz,
  );
}

export class Landscape {
  readonly step = 12;
  readonly min = -1452;
  readonly count = 251;
  readonly heights = new Float32Array(this.count * this.count);
  readonly distances = new Float32Array(this.count * this.count);
  readonly coastal: boolean;
  readonly forest: boolean;
  private readonly vegetationObstacles = new Map<
    string,
    { x: number; z: number; radius: number }[]
  >();
  registerVegetationObstacle(x: number, z: number, radius: number) {
    const obstacle = { x, z, radius };
    // A tree clearance margin up to 20 m is included in the indexed bounds.
    const reach = radius + 20;
    for (
      let iz = Math.floor((z - reach) / 100);
      iz <= Math.floor((z + reach) / 100);
      iz++
    )
      for (
        let ix = Math.floor((x - reach) / 100);
        ix <= Math.floor((x + reach) / 100);
        ix++
      ) {
        const key = `${ix},${iz}`;
        const cell = this.vegetationObstacles.get(key) ?? [];
        cell.push(obstacle);
        this.vegetationObstacles.set(key, cell);
      }
  }
  vegetationClear(x: number, z: number, margin = 2) {
    const nearby = this.vegetationObstacles.get(
      `${Math.floor(x / 100)},${Math.floor(z / 100)}`,
    );
    return !nearby?.some(
      (rock) =>
        Math.hypot(x - rock.x, z - rock.z) <
        rock.radius + Math.min(20, Math.max(0, margin)),
    );
  }
  constructor(readonly track: Track) {
    this.coastal = track.circuit.id === 'riviera';
    this.forest = track.circuit.id === 'forest';
    const city = track.circuit.id === 'marina';
    for (let z = 0; z < this.count; z++)
      for (let x = 0; x < this.count; x++) {
        const wx = this.min + x * this.step,
          wz = this.min + z * this.step;
        const d = track.nearestDistance(wx, wz);
        const rolling = terrainNoise(wx * 0.009, wz * 0.009);
        const shoulder = THREE.MathUtils.smoothstep(
          d,
          track.circuit.width / 2 + 17,
          95,
        );
        // Long foothills make room for forest instead of a steep wall immediately
        // beyond the road. Domain-warped folds break up the smooth noise mounds.
        const warpX =
          wx + (terrainNoise(wx * 0.0013 + 18, wz * 0.0013) - 0.5) * 120;
        const warpZ =
          wz + (terrainNoise(wx * 0.0013, wz * 0.0013 + 73) - 0.5) * 120;
        const ridge =
          1 - Math.abs(terrainNoise(warpX * 0.0028, warpZ * 0.0021) * 2 - 1);
        const foothill = THREE.MathUtils.smoothstep(
          d,
          city ? 390 : 65,
          city ? 850 : 230,
        );
        const rise =
          (1 - Math.exp(-Math.max(0, d - 60) / 640)) *
          (this.forest ? 265 : 220);
        const folds = terrainNoise(warpX * 0.009, warpZ * 0.011);
        const drainage = Math.max(0, 1 - Math.abs(folds * 2 - 1)) ** 6;
        let height =
          -0.24 +
          shoulder * (3 + rolling * (this.forest ? 13 : 11)) +
          foothill *
            (rise * (0.68 + ridge * 0.42) +
              terrainNoise(warpX * 0.021, warpZ * 0.019) * 6 -
              drainage * Math.min(17, rise * 0.12));
        if (city && d < 370) height = -0.24;
        if (this.coastal)
          height = THREE.MathUtils.lerp(
            height,
            -3.5,
            THREE.MathUtils.smoothstep(wx, 465, 525),
          );
        this.heights[z * this.count + x] = height;
        this.distances[z * this.count + x] = d;
      }
  }
  slope(x: number, z: number) {
    const dx =
      (this.height(x + this.step, z) - this.height(x - this.step, z)) /
      (2 * this.step);
    const dz =
      (this.height(x, z + this.step) - this.height(x, z - this.step)) /
      (2 * this.step);
    return Math.hypot(dx, dz);
  }
  height(x: number, z: number) {
    const gx = THREE.MathUtils.clamp(
      (x - this.min) / this.step,
      0,
      this.count - 1.001,
    );
    const gz = THREE.MathUtils.clamp(
      (z - this.min) / this.step,
      0,
      this.count - 1.001,
    );
    const ix = Math.floor(gx),
      iz = Math.floor(gz),
      i = iz * this.count + ix;
    const tx = gx - ix,
      tz = gz - iz;
    // Match PlaneGeometry's two triangles in each cell. Bilinear sampling
    // floats roots above a saddle-shaped quad or buries them below its faces.
    return tx + tz <= 1
      ? this.heights[i] * (1 - tx - tz) +
          this.heights[i + 1] * tx +
          this.heights[i + this.count] * tz
      : this.heights[i + this.count + 1] * (tx + tz - 1) +
          this.heights[i + 1] * (1 - tz) +
          this.heights[i + this.count] * (1 - tx);
  }
}

export function buildLandscape(
  root: THREE.Group,
  landscape: Landscape,
  weather: Weather,
  textures: SurfaceTextures,
) {
  const span = (landscape.count - 1) * landscape.step;
  const geometry = new THREE.PlaneGeometry(
    span,
    span,
    landscape.count - 1,
    landscape.count - 1,
  );
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(landscape.min + span / 2, 0, landscape.min + span / 2);
  const positions = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const colors: number[] = [];
  const rockWeights: number[] = [];
  // Authored albedo supplies the soil, moss and litter palette. Strong green
  // vertex tinting used to multiply that into near-black ground in linear light.
  const rockColor = new THREE.Color().setRGB(0.86, 0.87, 0.83);
  const base = landscape.forest
    ? new THREE.Color().setRGB(0.34, 0.42, 0.24)
    : new THREE.Color().setRGB(0.88, 0.9, 0.83);
  const leaf = landscape.forest
    ? new THREE.Color().setRGB(0.22, 0.31, 0.16)
    : new THREE.Color().setRGB(0.74, 0.81, 0.68);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i),
      h = landscape.height(x, z);
    positions.setY(i, h);
    // Shared ground samplers repeat 1200 times: a 2.8 m physical texture tile.
    uv.setXY(i, x / 3360, z / 3360);
    const patches = terrainNoise(x * 0.019, z * 0.019);
    const c = base
      .clone()
      .lerp(leaf, THREE.MathUtils.smoothstep(patches, 0.24, 0.76) * 0.85);
    const slope = landscape.slope(x, z);
    const rock = THREE.MathUtils.smoothstep(
      slope,
      landscape.forest ? 0.9 : 0.75,
      landscape.forest ? 1.65 : 1.6,
    );
    c.lerp(rockColor, rock);
    c.multiplyScalar(0.85 + terrainNoise(x * 0.13, z * 0.13) * 0.25);
    rockWeights.push(rock);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute(
    'terrainRock',
    new THREE.Float32BufferAttribute(rockWeights, 1),
  );
  geometry.computeVertexNormals();
  const floor = groundSurfaces(textures, landscape.forest);
  const material = new THREE.MeshStandardMaterial({
    map: floor.color,
    normalMap: floor.normal,
    roughnessMap: floor.rough,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: weather === 'rain' ? 0.91 : 1,
    vertexColors: true,
    envMapIntensity: 0.25,
  });
  // World-space triplanar rock avoids grass stretched vertically over steep
  // slopes. The engine owns the shared rock sampler; this world owns no new maps.
  const stone = rockSurfaces(textures, landscape.forest);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.terrainRockMap = { value: stone.color };
    shader.uniforms.terrainRockNormal = { value: stone.normal };
    shader.uniforms.terrainRockRough = { value: stone.rough };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float terrainRock;
        varying float vTerrainRock;
        varying vec3 vTerrainPosition;
        varying vec3 vTerrainNormal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vTerrainRock = terrainRock;
        vTerrainPosition = position;
        vTerrainNormal = normal;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D terrainRockMap;
        uniform sampler2D terrainRockNormal;
        uniform sampler2D terrainRockRough;
        varying float vTerrainRock;
        varying vec3 vTerrainPosition;
        varying vec3 vTerrainNormal;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 terrainWeights = pow(abs(normalize(vTerrainNormal)), vec3(4.0));
        terrainWeights /= max(dot(terrainWeights, vec3(1.0)), 0.0001);
        vec3 terrainP = vTerrainPosition / 24.0;
        vec3 terrainStone = texture2D(terrainRockMap, terrainP.yz).rgb * terrainWeights.x
          + texture2D(terrainRockMap, terrainP.xz).rgb * terrainWeights.y
          + texture2D(terrainRockMap, terrainP.xy).rgb * terrainWeights.z;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuse * terrainStone, vTerrainRock);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        vec3 stoneNX = texture2D(terrainRockNormal, terrainP.yz).xyz * 2.0 - 1.0;
        vec3 stoneNY = texture2D(terrainRockNormal, terrainP.xz).xyz * 2.0 - 1.0;
        vec3 stoneNZ = texture2D(terrainRockNormal, terrainP.xy).xyz * 2.0 - 1.0;
        stoneNX.xy *= 0.65; stoneNY.xy *= 0.65; stoneNZ.xy *= 0.65;
        vec3 stoneNormal = normalize(
          vec3(stoneNX.z * sign(vTerrainNormal.x), stoneNX.x, stoneNX.y) * terrainWeights.x +
          vec3(stoneNY.x, stoneNY.z * sign(vTerrainNormal.y), stoneNY.y) * terrainWeights.y +
          vec3(stoneNZ.x, stoneNZ.y, stoneNZ.z * sign(vTerrainNormal.z)) * terrainWeights.z);
        normal = normalize(mix(normal, mat3(viewMatrix) * stoneNormal, vTerrainRock));`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float stoneRoughness = texture2D(terrainRockRough, terrainP.yz).r * terrainWeights.x +
          texture2D(terrainRockRough, terrainP.xz).r * terrainWeights.y +
          texture2D(terrainRockRough, terrainP.xy).r * terrainWeights.z;
        roughnessFactor = mix(roughnessFactor, max(0.55, stoneRoughness) * roughness, vTerrainRock);`,
      );
  };
  material.customProgramCacheKey = () => 'astra-terrain-triplanar-v2';
  const ground = new THREE.Mesh(geometry, material);
  ground.receiveShadow = true;
  ground.name = 'sculpted landscape';
  root.add(ground);
}
