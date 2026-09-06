import * as THREE from 'three';
import { Track, seeded } from '../tracks';
import type { Weather } from '../types';
import { mesh } from './geometry';
import { noiseTexture } from '../materials';
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
            rain ? '#050b16' : sunset ? '#527d97' : '#287bbb',
          ),
        },
        horizon: {
          value: new THREE.Color(
            rain ? '#34424f' : sunset ? '#edb774' : '#c5dbe5',
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

export function buildMountains(
  root: THREE.Group,
  track: Track,
  weather: Weather,
) {
  const rand = seeded(77),
    geo = new THREE.PlaneGeometry(6500, 6500, 196, 196);
  geo.rotateX(-Math.PI / 2);
  const p = geo.getAttribute('position'),
    colors = [];
  const detail = noiseTexture(256);
  detail.repeat.set(100, 100);
  const base = new THREE.Color(
    weather === 'rain'
      ? '#263842'
      : track.circuit.id === 'forest'
        ? '#526b5e'
        : '#728473',
  );
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      z = p.getZ(i),
      r = Math.hypot(x - 150, z);
    const edge = THREE.MathUtils.smoothstep(r, 820, 1800);
    const ridges = 1 - Math.abs(terrainNoise(x * 0.0018, z * 0.0018) * 2 - 1);
    const smaller = 1 - Math.abs(terrainNoise(x * 0.006, z * 0.006) * 2 - 1);
    let y =
      -2 +
      edge *
        (110 +
          ridges ** 3 * 680 +
          smaller ** 2 * 180 +
          terrainNoise(x * 0.03, z * 0.03) * 30);
    if (track.circuit.id === 'riviera' && x > 520) y = -12;
    p.setY(i, y);
    const c = base.clone().multiplyScalar(0.66 + rand() * 0.12 + y / 1600);
    if (track.circuit.id === 'forest')
      c.lerp(
        new THREE.Color('#c4c6bb'),
        THREE.MathUtils.smoothstep(y, 550, 850) * 0.7,
      );
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  root.add(
    mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: detail,
        bumpMap: detail,
        bumpScale: 2.3,
        vertexColors: true,
        roughness: 1,
        flatShading: false,
      }),
    ),
  );
}
