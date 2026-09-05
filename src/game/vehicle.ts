import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { softShadowTexture } from './materials';
import type { DriverState } from './race-session';
import type { Track } from './tracks';

export interface CarVisual {
  group: THREE.Group;
  model: THREE.Group;
  head: THREE.Object3D | undefined;
  wheels: THREE.Object3D[];
  frontWheels: Set<THREE.Object3D>;
  brakeLight: THREE.Mesh;
  dispose: () => void;
}
export async function loadCarAsset(): Promise<THREE.Group> {
  return (await new GLTFLoader().loadAsync('/assets/models/astra-formula.glb'))
    .scene;
}
/** Each car shares immutable GLTF geometry and owns only its cloned materials and small effects. */
export function createCar(
  asset: THREE.Group,
  color: string,
  player = false,
): CarVisual {
  const group = new THREE.Group(),
    model = asset.clone(true),
    materials = new Map<THREE.Material, THREE.Material>();
  const wheels: THREE.Object3D[] = [],
    frontWheels = new Set<THREE.Object3D>();
  model.traverse((object) => {
    if (/^wheel_(FL|FR|RL|RR)$/.test(object.name)) {
      wheels.push(object);
      if (object.name.startsWith('wheel_F')) frontWheels.add(object);
    }
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = true;
    object.receiveShadow = true;
    const cloneMaterial = (original: THREE.Material) => {
      if (!materials.has(original)) {
        const material = original.clone();
        if (
          material instanceof THREE.MeshStandardMaterial &&
          material.name === 'Livery' &&
          !player
        )
          material.color.set(color);
        materials.set(original, material);
      }
      return materials.get(original)!;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial)
      : cloneMaterial(object.material);
  });
  const shadowTexture = softShadowTexture(),
    shadowGeometry = new THREE.PlaneGeometry(2.9, 6.4);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.66,
  });
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.028, 0);
  const brakeGeometry = new THREE.BoxGeometry(0.14, 0.12, 0.03),
    brakeMaterial = new THREE.MeshBasicMaterial({ color: 0xff442e });
  const brakeLight = new THREE.Mesh(brakeGeometry, brakeMaterial);
  brakeLight.position.set(0, 0.38, -2.7);
  group.add(model, shadow, brakeLight);
  let disposed = false;
  return {
    group,
    model,
    head: model.getObjectByName('driver_head'),
    wheels,
    frontWheels,
    brakeLight,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      materials.forEach((m) => m.dispose());
      shadowTexture.dispose();
      shadowGeometry.dispose();
      shadowMaterial.dispose();
      brakeGeometry.dispose();
      brakeMaterial.dispose();
    },
  };
}
export function updateCar(
  visual: CarVisual,
  driver: DriverState,
  track: Track,
  dt: number,
  time: number,
  wet: boolean,
  brake = 0,
  throttle = 0,
  cockpit = false,
) {
  const frame = track.sample(driver.distance);
  visual.group.position.set(
    frame.x + frame.nx * driver.offset,
    frame.y + 0.04,
    frame.z + frame.nz * driver.offset,
  );
  visual.group.rotation.y = frame.heading + driver.headingError;
  visual.model.rotation.z = THREE.MathUtils.damp(
    visual.model.rotation.z,
    -driver.steer * driver.speed * 0.0008,
    5,
    dt || 1,
  );
  visual.model.rotation.x = THREE.MathUtils.damp(
    visual.model.rotation.x,
    brake * 0.012 - throttle * 0.006,
    5,
    dt || 1,
  );
  const roll = (driver.distance / 0.36) % (Math.PI * 2);
  for (const wheel of visual.wheels)
    wheel.rotation.set(
      roll,
      visual.frontWheels.has(wheel) ? driver.steer * 0.3 : 0,
      0,
      'YXZ',
    );
  if (visual.head) visual.head.visible = !cockpit;
  visual.brakeLight.visible = wet
    ? Math.floor(time * 3) % 2 === 0
    : brake > 0.1;
}
export function disposeCarAsset(asset: THREE.Group) {
  const geometry = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  asset.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      geometry.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
    }
  });
  materials.forEach((m) => {
    for (const value of Object.values(m))
      if (value instanceof THREE.Texture) textures.add(value);
    m.dispose();
  });
  textures.forEach((t) => t.dispose());
  geometry.forEach((g) => g.dispose());
}
