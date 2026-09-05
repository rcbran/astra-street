import * as THREE from 'three';
import { Track, seeded } from '../tracks';
import type { Weather } from '../types';
import { mesh } from './geometry';
import { noiseTexture } from '../materials';
import { skyVertex, skyFragment } from '../shaders/sky';
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
            rain ? '#050b16' : sunset ? '#417792' : '#3985bd',
          ),
        },
        horizon: {
          value: new THREE.Color(
            rain ? '#34424f' : sunset ? '#f9c191' : '#dae9eb',
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
    geo = new THREE.PlaneGeometry(6500, 6500, 96, 96);
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
    const edge = Math.max(0, (r - 780) / 1500);
    const waves =
      Math.sin(x * 0.004 + 1) * Math.cos(z * 0.003) +
      Math.sin(x * 0.009) * Math.sin(z * 0.008) * 0.4 +
      Math.sin(x * 0.027 + Math.sin(z * 0.019)) * 0.08;
    let y = -0.5 + Math.max(0, edge) * (180 + waves * 170);
    if (track.circuit.id === 'riviera' && x > 520) y = -12;
    p.setY(i, y);
    const c = base.clone().multiplyScalar(0.7 + rand() * 0.3 + y / 1900);
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
