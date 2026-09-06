import * as THREE from 'three';
import { Track } from '../tracks';
import type { Weather } from '../types';
import { mesh } from './geometry';
import { skyVertex, skyFragment } from '../shaders/sky';
import { terrainNoise } from './landscape';
export function makeSky(weather: Weather) {
  const sunset = weather === 'sunset',
    rain = weather === 'rain';
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1800, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        top: {
          value: new THREE.Color(
            rain ? '#050b16' : sunset ? '#b88e67' : '#287bbb',
          ),
        },
        horizon: {
          value: new THREE.Color(
            rain ? '#34424f' : sunset ? '#f5c68f' : '#c5dbe5',
          ),
        },
        sunDir: {
          value: new THREE.Vector3(-0.6, sunset ? 0.16 : 0.6, 0.65).normalize(),
        },
        sunColor: { value: new THREE.Color(sunset ? '#ffe4bb' : '#fffcdf') },
        sunStrength: { value: rain ? 0 : 1 },
        cloud: { value: rain ? 0.6 : 0.12 },
      },
      vertexShader: skyVertex,
      fragmentShader: skyFragment,
    }),
  );
  sky.frustumCulled = false;
  return sky;
}

// Domain-warped continuous ridgelines: broad ranges first, then eroded gullies.
// Random independent vertex heights used to make the skyline read as triangles.
function mountainElevation(
  x: number,
  z: number,
  coastal: boolean,
  setback: number,
) {
  const edge = Math.min(
    THREE.MathUtils.smoothstep(Math.hypot(x - 150, z), 1100, 2300),
    THREE.MathUtils.smoothstep(setback, 650, 1550),
  );
  const wx = x + (terrainNoise(x * 0.0007 + 41, z * 0.0007) - 0.5) * 500;
  const wz = z + (terrainNoise(x * 0.0007, z * 0.0007 + 81) - 0.5) * 420;
  // Broad massif + oblique subsidiary ridges. Splitting the relief between
  // scales avoids one huge rounded mound punctuated by needle-like noise peaks.
  const mass =
    terrainNoise(wx * 0.0009 + 12, wz * 0.0011 + 48) * 0.64 +
    terrainNoise(wx * 0.0019 + 37, wz * 0.0015) * 0.36;
  const crest = 1 - Math.abs(terrainNoise(wx * 0.0028, wz * 0.0018) * 2 - 1);
  const spur =
    1 - Math.abs(terrainNoise(wx * 0.0065 + 71, wz * 0.0042) * 2 - 1);
  const channel =
    Math.max(0, 1 - Math.abs(terrainNoise(wx * 0.009, wz * 0.007) * 2 - 1)) **
    5;
  let height =
    -4 +
    edge *
      (105 +
        mass ** 1.25 * (coastal ? 330 : 390) +
        crest ** 1.7 * 105 +
        spur ** 1.4 * 52 -
        channel * 38);
  if (coastal)
    height = THREE.MathUtils.lerp(
      height,
      -14,
      THREE.MathUtils.smoothstep(x, 470, 560),
    );
  return height;
}

// Coherent mineral grain and bedding, shared across each range. This original
// small data texture is world-owned and disposed with the mountain material.
function mountainRockTexture() {
  const size = 256,
    data = new Uint8Array(size * size * 4);
  for (let z = 0; z < size; z++)
    for (let x = 0; x < size; x++) {
      const grain = terrainNoise(x * 0.37, z * 0.37);
      const mineral = terrainNoise(x * 0.067 + 14, z * 0.081);
      const bedding = Math.sin(
        z * 0.22 + terrainNoise(x * 0.028, z * 0.012) * 4,
      );
      const joint = Math.max(0, terrainNoise(x * 0.17, z * 0.025) - 0.67) * 115;
      const value = THREE.MathUtils.clamp(
        149 + grain * 41 + mineral * 25 + bedding * 9 - joint,
        90,
        225,
      );
      const i = (z * size + x) * 4;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  const texture = new THREE.DataTexture(data, size, size);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.repeat.set(80, 80);
  texture.needsUpdate = true;
  texture.name = 'original mountain mineral bedding';
  return texture;
}

export function buildMountains(
  root: THREE.Group,
  track: Track,
  weather: Weather,
) {
  const coastal = track.circuit.id === 'riviera';
  const forest = track.circuit.id === 'forest';
  const geo = new THREE.PlaneGeometry(6500, 6500, 260, 260);
  geo.rotateX(-Math.PI / 2);
  const p = geo.getAttribute('position'),
    colors: number[] = [];
  const detail = mountainRockTexture();
  const base = new THREE.Color(
    weather === 'rain' ? '#394a4e' : forest ? '#526555' : '#8a7258',
  );
  const rock = new THREE.Color(
    weather === 'rain' ? '#566367' : forest ? '#64736e' : '#a3896b',
  );
  const snow = new THREE.Color('#b9c5c4');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i),
      setback = track.nearestDistance(x, z),
      y = mountainElevation(x, z, coastal, setback);
    p.setY(i, y);
    const slope =
      Math.hypot(
        mountainElevation(x + 12, z, coastal, setback) -
          mountainElevation(x - 12, z, coastal, setback),
        mountainElevation(x, z + 12, coastal, setback) -
          mountainElevation(x, z - 12, coastal, setback),
      ) / 24;
    const exposed = Math.max(
      THREE.MathUtils.smoothstep(slope, 0.48, 1.3),
      THREE.MathUtils.smoothstep(y, 300, 560) * 0.8,
    );
    const c = base.clone().lerp(rock, exposed);
    // Rock joints and drainage remain readable under haze at range scale.
    const drainage =
      Math.max(0, 1 - Math.abs(terrainNoise(x * 0.009, z * 0.007) * 2 - 1)) **
      5;
    c.multiplyScalar(
      0.78 + terrainNoise(x * 0.006, z * 0.005) * 0.25 - drainage * 0.1,
    );
    if (forest) {
      const snowPatch = THREE.MathUtils.smoothstep(
        terrainNoise(x * 0.012 + 38, z * 0.009),
        0.55,
        0.82,
      );
      c.lerp(
        snow,
        THREE.MathUtils.smoothstep(y, 500, 610) *
          (1 - THREE.MathUtils.smoothstep(slope, 0.55, 1.15)) *
          snowPatch *
          0.55,
      );
    }
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mountains = mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: detail,
      bumpMap: detail,
      bumpScale: 0.9,
      vertexColors: true,
      roughness: 1,
      envMapIntensity: 0.2,
    }),
  );
  mountains.name = 'eroded mountain ranges';
  root.add(mountains);
}
