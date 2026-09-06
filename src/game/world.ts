import { createWetRoad } from './world/wet-road';
import { mesh, box, instanced, ribbon, patch } from './world/geometry';
import { makeSky, buildMountains } from './world/atmosphere';
import { buildTrees } from './world/vegetation';
import { Landscape, buildLandscape } from './world/landscape';
import { buildRockFormations } from './world/rock-formations';
import { buildBuildings } from './world/buildings';
import { SPEED_TRAPS } from './street-score';
import {
  roadWearMaterial,
  concreteBarrierMaterial,
  paintedRunoffMaterial,
} from './world/track-surfaces';
import * as THREE from 'three';

import { Track, seeded } from './tracks';
import {
  canvasTexture,
  type SurfaceTextures,
  signTexture,
  softShadowTexture,
} from './materials';
import type { Weather } from './types';

export interface World {
  root: THREE.Group;
  sky: THREE.Mesh;
  road: THREE.MeshStandardMaterial;
  sun: THREE.DirectionalLight;
  rain: THREE.LineSegments | null;
  rainData: Float32Array | null;
  update: (dt: number, position: THREE.Vector3, time: number) => void;
  dispose: () => void;
}
export function buildWorld(
  track: Track,
  weather: Weather,
  textures: SurfaceTextures,
): World {
  const root = new THREE.Group(),
    wet = weather === 'rain',
    city = track.circuit.id === 'marina',
    sunset = weather === 'sunset',
    half = track.circuit.width / 2,
    rand = seeded(412);
  const sky = makeSky(weather);
  root.add(sky);
  const hemi = new THREE.HemisphereLight(
    wet ? 0x88a7ce : sunset ? 0xe6d7c1 : 0xd7ecff,
    wet ? 0x39404d : 0x6b7452,
    wet ? 1.05 : 0.78,
  );
  root.add(hemi);
  const sun = new THREE.DirectionalLight(
    wet ? 0xbdcfea : sunset ? 0xffdbc0 : 0xfff5df,
    wet ? 1.25 : sunset ? 3.5 : 3.2,
  );
  sun.position.set(-150, sunset ? 75 : 260, 210);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -75,
    right: 75,
    top: 75,
    bottom: -75,
    near: 1,
    far: 650,
  });
  sun.shadow.bias = -0.00018;
  sun.shadow.normalBias = 0.045;
  root.add(sun, sun.target);
  const landscape = new Landscape(track);
  buildLandscape(root, landscape, weather, textures);
  buildMountains(root, track, weather);
  buildRockFormations(root, track, weather, textures.rock, landscape);
  const road = new THREE.MeshStandardMaterial({
    map: textures.color,
    normalMap: textures.normal,
    normalScale: new THREE.Vector2(wet ? 0.1 : 0.24, wet ? 0.1 : 0.24),
    roughnessMap: wet ? null : textures.rough,
    roughness: wet ? 0.22 : 0.96,
    metalness: wet ? 0.32 : 0.015,
    color: wet ? 0x8e9aaa : 0xffffff,
    envMapIntensity: wet ? 1.5 : 0.45,
  });
  const runOff = paintedRunoffMaterial(track.circuit.id === 'forest', wet);
  const gravel = new THREE.MeshStandardMaterial({
    color: 0xa99f87,
    roughness: 1,
    map: textures.color,
  });
  const white = new THREE.MeshStandardMaterial({
    color: 0xe3e4d9,
    roughness: wet ? 0.35 : 0.8,
  });
  for (let s = 0; s < 512; s += 64) {
    for (const [a, b, m, y] of [
      [-half, half, road, 0],
      [-half - 4, -half, runOff, -0.016],
      [half, half + 4, runOff, -0.016],
      [-half - 10, -half - 4, gravel, -0.045],
      [half + 4, half + 10, gravel, -0.045],
    ] as [number, number, THREE.Material, number][]) {
      const r = mesh(ribbon(track, a, b, y, s, s + 64), m);
      r.receiveShadow = true;
      root.add(r);
    }
    for (const edge of [-half + 0.12, half - 0.12])
      root.add(
        mesh(
          ribbon(track, edge - 0.065, edge + 0.065, 0.019, s, s + 64),
          white,
        ),
      );
  }
  const wear = ribbon(track, -half, half, 0.021, 0, 512, track.circuit.width);
  const wearUv = wear.getAttribute('uv');
  for (let i = 0; i < wearUv.count; i++)
    wearUv.setXY(
      i,
      wearUv.getX(i) + 0.5,
      (wearUv.getY(i) * track.circuit.width) / 95,
    );
  root.add(mesh(wear, roadWearMaterial(wet)));
  const curbRed = new THREE.MeshStandardMaterial({
    color: 0xd74430,
    roughness: wet ? 0.34 : 0.75,
  });
  const curbWhite = new THREE.MeshStandardMaterial({
    color: 0xe4dfcc,
    roughness: wet ? 0.34 : 0.8,
  });
  const curbTransforms = [[], []] as Parameters<typeof instanced>[2][];
  const barriers: Parameters<typeof instanced>[2] = [],
    posts: Parameters<typeof instanced>[2] = [],
    fences: Parameters<typeof instanced>[2] = [],
    rails: Parameters<typeof instanced>[2] = [];
  const fenceTex = canvasTexture(128, 128, (c) => {
    c.clearRect(0, 0, 128, 128);
    c.strokeStyle = 'rgba(169,185,190,.75)';
    c.lineWidth = 1.3;
    for (let i = -128; i < 256; i += 16) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i + 128, 128);
      c.stroke();
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i - 128, 128);
      c.stroke();
    }
  });
  fenceTex.wrapS = fenceTex.wrapT = THREE.RepeatWrapping;
  fenceTex.repeat.set(2, 1);
  const fenceMat = new THREE.MeshStandardMaterial({
    map: fenceTex,
    transparent: true,
    alphaTest: 0.15,
    side: THREE.DoubleSide,
    roughness: 0.65,
    depthWrite: false,
    color: 0x8b9ca0,
  });
  const signMat = [
    new THREE.MeshBasicMaterial({
      map: signTexture('ASTRA  /  STREET', '#f1d4a1', '#17242d'),
    }),
    new THREE.MeshBasicMaterial({
      map: signTexture('APEX   PERFORMANCE', '#13201c', '#d6dfbd'),
    }),
    new THREE.MeshBasicMaterial({
      map: signTexture('RACE BEYOND.', '#ffffff', '#b43d29'),
    }),
  ];
  for (let s = 0; s < track.length; s += 4) {
    const f = track.sample(s);
    for (const side of [-1, 1]) {
      curbTransforms[Math.floor(s / 4) % 2].push({
        x: f.x + f.nx * side * (half + 0.5),
        y: 0.055,
        z: f.z + f.nz * side * (half + 0.5),
        ry: f.heading,
        sx: 1,
        sy: 1,
        sz: 1,
      });
      const offset = side * (half + 7);
      barriers.push({
        x: f.x + f.nx * offset,
        y: city ? 0.65 : 0.275,
        z: f.z + f.nz * offset,
        ry: f.heading,
        color: new THREE.Color(
          Math.floor(s / 24) % 5 === 0 ? 0xd5d4c9 : 0x939d97,
        ),
      });
      if (city && Math.floor(s / 4) % 2 === 0) {
        posts.push({
          x: f.x + f.nx * (offset + 0.1 * side),
          y: 2.65,
          z: f.z + f.nz * (offset + 0.1 * side),
        });
        fences.push({
          x: f.x + f.nx * offset,
          y: 2.55,
          z: f.z + f.nz * offset,
          ry: f.heading + Math.PI / 2,
        });
      }
      if (city && Math.floor(s / 4) % 6 === 0) {
        rails.push({
          x: f.x + f.nx * offset,
          y: 4.1,
          z: f.z + f.nz * offset,
          ry: f.heading,
        });
      }
      if (Math.floor(s / 4) % 35 === 0) {
        const sign = mesh(
          new THREE.PlaneGeometry(16, 1.55),
          signMat[Math.floor(s / 60) % 3],
          f.x + f.nx * (offset - side * 0.38),
          1.48,
          f.z + f.nz * (offset - side * 0.38),
        );
        sign.rotation.y = f.heading - (side * Math.PI) / 2;
        root.add(sign);
      }
    }
  }
  root.add(
    instanced(new THREE.BoxGeometry(1, 0.14, 4.1), curbRed, curbTransforms[0]),
    instanced(
      new THREE.BoxGeometry(1, 0.14, 4.1),
      curbWhite,
      curbTransforms[1],
    ),
  );
  root.add(
    instanced(
      new THREE.BoxGeometry(0.6, city ? 1.3 : 0.55, 4.08),
      concreteBarrierMaterial(wet),
      barriers,
      true,
    ),
  );
  root.add(
    instanced(
      new THREE.CylinderGeometry(0.045, 0.055, 3.1, 5),
      new THREE.MeshStandardMaterial({
        color: 0x889a9d,
        metalness: 0.55,
        roughness: 0.5,
      }),
      posts,
    ),
  );
  root.add(instanced(new THREE.PlaneGeometry(8.04, 2.9), fenceMat, fences));
  root.add(
    instanced(
      new THREE.BoxGeometry(0.06, 0.06, 24),
      new THREE.MeshStandardMaterial({ color: 0x8a9e9f }),
      rails,
    ),
  );
  // Rubbered-in racing line is transparent and follows the road curvature.
  const rubber = canvasTexture(128, 512, (c) => {
    c.clearRect(0, 0, 128, 512);
    for (let i = 0; i < 180; i++) {
      c.fillStyle = `rgba(0,0,0,${0.03 + rand() * 0.06})`;
      c.fillRect(
        20 + rand() * 90,
        rand() * 512,
        0.4 + rand() * 2,
        20 + rand() * 250,
      );
    }
  });
  rubber.wrapS = rubber.wrapT = THREE.RepeatWrapping;
  root.add(
    mesh(
      ribbon(track, -3.2, 3.2, 0.025, 0, 512, 5),
      new THREE.MeshBasicMaterial({
        map: rubber,
        transparent: true,
        depthWrite: false,
        opacity: wet ? 0.18 : 0.52,
      }),
    ),
  );
  const startTex = canvasTexture(128, 32, (c) => {
    for (let x = 0; x < 16; x++)
      for (let y = 0; y < 4; y++) {
        c.fillStyle = (x + y) % 2 ? '#1b2426' : '#e5e3da';
        c.fillRect(x * 8, y * 8, 8, 8);
      }
  });
  root.add(
    patch(
      track,
      0,
      0,
      track.circuit.width,
      2.2,
      new THREE.MeshStandardMaterial({ map: startTex, roughness: 0.6 }),
      0.04,
    ),
  );
  for (let i = 0; i < 10; i++) {
    const at = -12 - i * 9,
      off = (i % 2 ? 1 : -1) * 3;
    const g = new THREE.Group();
    const f = track.sample(at);
    g.position.set(f.x + f.nx * off, 0.09, f.z + f.nz * off);
    g.rotation.y = f.heading;
    g.add(
      box(2, 0.012, 0.1, white, 0, 0, 2),
      box(0.1, 0.012, 3.5, white, -1, 0, 0.3),
    );
    root.add(g);
  }
  // Trackside lighting uses emissive fixtures; no hundreds of real dynamic lights.
  const poles: Parameters<typeof instanced>[2] = [],
    fixtures: Parameters<typeof instanced>[2] = [],
    glows: Parameters<typeof instanced>[2] = [];
  for (let s = 0; s < track.length; s += city ? 65 : 145) {
    const f = track.sample(s);
    for (const side of [-1, 1]) {
      const o = side * (half + 8);
      poles.push({ x: f.x + f.nx * o, y: 7, z: f.z + f.nz * o });
      fixtures.push({
        x: f.x + f.nx * (o - side * 1.7),
        y: 13.8,
        z: f.z + f.nz * (o - side * 1.7),
        ry: f.heading,
      });
      if (wet)
        glows.push({
          x: f.x + f.nx * (o - side * 1.7),
          y: 13.74,
          z: f.z + f.nz * (o - side * 1.7),
          ry: f.heading,
        });
    }
  }
  root.add(
    instanced(
      new THREE.CylinderGeometry(0.12, 0.22, 14, 6),
      new THREE.MeshStandardMaterial({
        color: 0x8e9a9c,
        roughness: 0.7,
        metalness: 0.6,
      }),
      poles,
    ),
  );
  root.add(
    instanced(
      new THREE.BoxGeometry(3.6, 0.18, 1.5),
      new THREE.MeshStandardMaterial({
        color: 0xb5c2c4,
        emissive: 0xd0eaff,
        emissiveIntensity: wet ? 3 : 0,
      }),
      fixtures,
    ),
  );
  if (wet) {
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xb1ddff,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      map: softShadowTexture(),
    });
    for (let s = 0; s < track.length; s += 65)
      root.add(patch(track, s, 0, 10, 20, glowMat, 0.031));
  }
  // Start gantry and its compact red lights.
  const gf = track.sample(5),
    gantry = new THREE.Group();
  gantry.position.set(gf.x, 0, gf.z);
  gantry.rotation.y = gf.heading;
  root.add(gantry);
  const metal = new THREE.MeshStandardMaterial({
    color: 0x687a7d,
    roughness: 0.5,
    metalness: 0.65,
  });
  gantry.add(
    box(0.5, 8, 0.5, metal, -half - 3, 4),
    box(0.5, 8, 0.5, metal, half + 3, 4),
    box(track.circuit.width + 7, 1.8, 0.6, metal, 0, 7.3),
  );
  const gantrySign = mesh(
    new THREE.PlaneGeometry(track.circuit.width + 5, 1.65),
    new THREE.MeshBasicMaterial({
      map: signTexture('A S T R A  /  S T R E E T', '#ffc477', '#152129'),
    }),
    0,
    7.3,
    -0.32,
  );
  gantrySign.rotation.y = Math.PI;
  gantry.add(gantrySign);
  for (let i = 0; i < 5; i++)
    gantry.add(
      mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshStandardMaterial({
          color: 0x8b1b13,
          emissive: 0xee2b1d,
          emissiveIntensity: 1.4,
        }),
        -1.1 + i * 0.55,
        6.12,
        -0.5,
      ),
    );
  const gateMaterial = new THREE.MeshBasicMaterial({
    map: signTexture('S P E E D   C H E C K', '#20252a', '#edbc78'),
    side: THREE.DoubleSide,
  });
  for (const fraction of SPEED_TRAPS) {
    const f = track.sample(track.length * fraction);
    const gate = new THREE.Group();
    gate.position.set(f.x, 0, f.z);
    gate.rotation.y = f.heading;
    gate.add(
      box(0.18, 6.5, 0.18, metal, -half - 1, 3.25),
      box(0.18, 6.5, 0.18, metal, half + 1, 3.25),
      box(track.circuit.width + 2, 0.15, 0.15, metal, 0, 6.5),
      mesh(new THREE.PlaneGeometry(8, 0.9), gateMaterial, 0, 6.0),
    );
    root.add(gate);
  }
  if (track.circuit.id !== 'forest') buildBuildings(root, track, weather);
  buildTrees(
    root,
    track,
    weather,
    textures.trees,
    textures.conifers,
    landscape,
  );
  // Braking distance boards before stronger corners.
  for (let s = 150; s < track.length; s += 180) {
    const next = track.sample(s + 55);
    if (Math.abs(next.curvature) < 0.006) continue;
    for (const [d, txt] of [
      [0, '100'],
      [45, '50'],
    ] as const) {
      const f = track.sample(s + d);
      const sign = mesh(
        new THREE.PlaneGeometry(1.6, 2.1),
        new THREE.MeshBasicMaterial({
          map: signTexture(txt, '#162220', '#eeeee4'),
        }),
        f.x + f.nx * (half + 4.8),
        1.6,
        f.z + f.nz * (half + 4.8),
      );
      sign.rotation.y = f.heading + Math.PI;
      root.add(sign);
    }
  }
  let rain: THREE.LineSegments | null = null,
    rainData: Float32Array | null = null;
  if (wet) {
    rainData = new Float32Array(1100 * 6);
    for (let i = 0; i < rainData.length; i += 6) {
      const x = (rand() - 0.5) * 100,
        y = rand() * 45,
        z = (rand() - 0.5) * 100;
      rainData.set([x, y, z, x - 0.16, y - 1.1, z + 0.25], i);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(rainData, 3));
    rain = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: 0xaec6d7,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    );
    rain.frustumCulled = false;
    root.add(rain);
  }
  const wetRoad = wet ? createWetRoad(track, textures.normal) : null;
  if (wetRoad) root.add(wetRoad.mesh);
  let disposed = false;
  return {
    root,
    sky,
    road,
    sun,
    rain,
    rainData,
    update: (dt, pos, time) => {
      wetRoad?.update(time);
      sky.position.copy(pos);
      const sunOffset = wet
        ? new THREE.Vector3(-90, 180, 130)
        : sunset
          ? new THREE.Vector3(-180, 90, 195)
          : new THREE.Vector3(-160, 270, 180);
      sun.position.copy(pos).add(sunOffset);
      sun.target.position.copy(pos);
      if (rain && rainData) {
        rain.position.copy(pos);
        for (let i = 0; i < rainData.length; i += 6) {
          rainData[i + 1] -= dt * 26;
          rainData[i + 4] -= dt * 26;
          if (rainData[i + 1] < -4) {
            rainData[i + 1] += 48;
            rainData[i + 4] += 48;
          }
        }
        rain.geometry.attributes.position.needsUpdate = true;
      }
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      wetRoad?.mesh.removeFromParent();
      wetRoad?.dispose();
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>(),
        maps = new Set<THREE.Texture>();
      root.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          geometries.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            materials.add(m);
        }
      });
      for (const m of materials) {
        for (const v of Object.values(m))
          if (
            v instanceof THREE.Texture &&
            !Object.values(textures).includes(v)
          )
            maps.add(v);
        m.dispose();
      }
      geometries.forEach((g) => g.dispose());
      maps.forEach((t) => t.dispose());
      sun.shadow.map?.dispose();
      root.clear();
    },
  };
}
