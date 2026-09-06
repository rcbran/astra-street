import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Track, seeded } from '../tracks';
import type { Weather } from '../types';
import { buildingTexture, signTexture } from '../materials';
import { box, mesh, instanced } from './geometry';
export function buildGrandstands(
  root: THREE.Group,
  track: Track,
  weather: Weather,
) {
  const steel = new THREE.MeshStandardMaterial({
    color: 0x939c9b,
    roughness: 0.65,
    metalness: 0.35,
  });
  const concrete = new THREE.MeshStandardMaterial({
    color: 0xaaa9a0,
    roughness: 0.94,
  });
  const roof = new THREE.MeshStandardMaterial({
    color: 0xe2e4df,
    roughness: 0.55,
    metalness: 0.35,
  });
  const rand = seeded(70),
    crowd: { x: number; y: number; z: number; color: THREE.Color }[] = [];
  for (const [at, side] of [
    [100, -1],
    [210, -1],
    [track.length * 0.29, 1],
    [track.length * 0.56, -1],
  ]) {
    const f = track.sample(at),
      g = new THREE.Group();
    g.position.set(f.x + f.nx * side * 34, 0, f.z + f.nz * side * 34);
    g.rotation.y = f.heading + (side === -1 ? 0 : Math.PI);
    root.add(g);
    for (let step = 0; step < 9; step++) {
      const stand = box(
        1.7,
        0.52,
        66,
        concrete,
        -step * 1.65,
        1 + step * 0.66,
        0,
      );
      stand.receiveShadow = true;
      g.add(stand);
      for (let row = 0; row < 91; row++) {
        if (rand() < 0.14) continue;
        crowd.push({
          x: -step * 1.65,
          y: 1.6 + step * 0.66,
          z: -32.5 + row * 0.72,
          color: new THREE.Color(
            [0x303d43, 0x8b3930, 0xb7b6a4, 0x263c55, 0x344b3c, 0x9a7943][
              Math.floor(rand() * 6)
            ],
          ),
        });
      }
    }
    const spectators = crowd.splice(0);
    g.add(
      instanced(
        new THREE.CylinderGeometry(0.15, 0.22, 0.51, 5),
        new THREE.MeshStandardMaterial({ roughness: 1 }),
        spectators,
      ),
      instanced(
        new THREE.IcosahedronGeometry(0.115, 0),
        new THREE.MeshStandardMaterial({ color: 0xb99678, roughness: 1 }),
        spectators.map(({ x, y, z }) => ({ x, y: y + 0.38, z })),
      ),
    );
    for (let j = -1; j <= 1; j++)
      g.add(box(0.3, 10, 0.3, steel, -14.3, 5, j * 31));
    const roofM = box(19, 0.18, 69, roof, -7.3, 10.3, 0);
    roofM.rotation.z = 0.08;
    roofM.castShadow = true;
    g.add(roofM);
    g.add(box(0.6, 2.2, 67, steel, 1.2, 1.1, 0));
  }
  // Pit building alongside the main straight.
  const f = track.sample(110);
  const pit = new THREE.Group();
  pit.position.set(f.x + f.nx * 35, 0, f.z + f.nz * 35);
  pit.rotation.y = f.heading;
  root.add(pit);
  pit.add(box(20, 8, 144, concrete, 0, 4, 0));
  pit.add(box(21, 0.5, 148, roof, 0, 8.3, 0));
  const glass = new THREE.MeshStandardMaterial({
    color: weather === 'rain' ? 0x223c50 : 0x7b9da7,
    metalness: 0.65,
    roughness: 0.15,
  });
  pit.add(box(0.15, 2.5, 141, glass, -10.1, 6.1, 0));
  const door = new THREE.MeshStandardMaterial({
    color: 0x263739,
    roughness: 0.7,
  });
  for (let i = 0; i < 18; i++) {
    pit.add(box(0.15, 3.6, 6.2, door, -10.1, 2, -67 + i * 7.8));
    pit.add(box(0.25, 0.5, 6.2, roof, -10.2, 4.05, -67 + i * 7.8));
  }
  const banner = mesh(
    new THREE.PlaneGeometry(140, 1.4),
    new THREE.MeshBasicMaterial({
      map: signTexture(
        'A S T R A   •   R A C I N G   C L U B',
        '#f0efdf',
        '#192a29',
      ),
    }),
    -10.24,
    8,
    0,
  );
  banner.rotation.y = -Math.PI / 2;
  pit.add(banner);
}

export function buildBuildings(
  root: THREE.Group,
  track: Track,
  weather: Weather,
) {
  const city = track.circuit.id === 'marina',
    rand = seeded(city ? 55 : 89);
  const night = weather === 'rain';
  const fac = buildingTexture(night);
  fac.wrapS = fac.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({
    map: fac,
    color: city ? 0x9da8af : 0xdfd4bc,
    roughness: 0.65,
    metalness: 0.15,
    emissive: night ? 0xeee0cf : 0x000000,
    emissiveMap: fac,
    emissiveIntensity: night ? 0.38 : 0,
  });
  const transforms = [];
  for (let i = 0; i < (city ? 190 : 0); i++) {
    const at = rand() * track.length,
      f = track.sample(at);
    const off =
      (rand() > 0.5 ? 1 : -1) * (city ? 70 + rand() * 430 : 100 + rand() * 170);
    const x = f.x + f.nx * off,
      z = f.z + f.nz * off;
    if (
      track.nearestDistance(x, z) < 45 ||
      (track.circuit.id === 'riviera' && x > 480)
    )
      continue;
    const h = city ? 16 + Math.pow(rand(), 1.7) * 160 : 8 + rand() * 24;
    transforms.push({
      x,
      y: h / 2 - 0.4,
      z,
      ry: city ? (Math.round(rand() * 4) * Math.PI) / 2 : f.heading,
      sx: city ? 15 + rand() * 25 : 12 + rand() * 15,
      sy: h,
      sz: city ? 15 + rand() * 25 : 12 + rand() * 15,
      color: new THREE.Color().setHSL(
        0.1 + rand() * 0.5,
        0.05 + rand() * 0.1,
        0.6 + rand() * 0.35,
      ),
    });
  }
  root.add(instanced(new THREE.BoxGeometry(1, 1, 1), mat, transforms));
  if (city) {
    const landmark = new THREE.Group();
    landmark.position.set(640, 0, -250);
    root.add(landmark);
    for (const z of [-90, 0, 90]) {
      landmark.add(box(28, 160, 48, mat, 0, 80, z));
    }
    const roof = box(
      65,
      8,
      255,
      new THREE.MeshStandardMaterial({
        color: 0xabbcbf,
        metalness: 0.7,
        roughness: 0.25,
        emissive: 0x16374a,
        emissiveIntensity: 0.3,
      }),
      0,
      164,
      0,
    );
    roof.rotation.z = -0.06;
    landmark.add(roof);
    // An illuminated observation wheel, using a single merged structural mesh.
    const ringGeo = new THREE.TorusGeometry(62, 0.65, 5, 72);
    const steel = new THREE.MeshStandardMaterial({
      color: 0x90a6af,
      metalness: 0.6,
      roughness: 0.3,
      emissive: 0x416780,
      emissiveIntensity: night ? 0.9 : 0,
    });
    const wheel = mesh(ringGeo, steel, -340, 70, 490);
    root.add(wheel);
    const spokes = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const g = new THREE.CylinderGeometry(0.18, 0.18, 62, 4);
      g.rotateZ(a);
      g.translate(-340 - Math.sin(a) * 31, 70 + Math.cos(a) * 31, 490);
      spokes.push(g);
    }
    root.add(mesh(mergeGeometries(spokes), steel));
  } else if (track.circuit.id === 'riviera') {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(4800, 6500, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0x5d9caa,
        roughness: 0.24,
        metalness: 0.55,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(2900, -1.1, 0);
    root.add(water);
    const boats = [];
    for (let i = 0; i < 20; i++) {
      boats.push({
        x: 600 + rand() * 400,
        y: 0.1,
        z: -200 + rand() * 800,
        ry: rand() * 0.6,
        sx: 3 + rand() * 2,
        sy: 1.2,
        sz: 9 + rand() * 7,
      });
    }
    root.add(
      instanced(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshStandardMaterial({ color: 0xe7e6dc, roughness: 0.4 }),
        boats,
      ),
    );
  }
}
