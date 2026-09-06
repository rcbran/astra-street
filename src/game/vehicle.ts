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
  nitro: THREE.Group;
  dispose: () => void;
}
export async function loadCarAsset(): Promise<THREE.Group> {
  return (await new GLTFLoader().loadAsync('/assets/models/astra-s9.glb'))
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
          material.name === 'Livery'
        ) {
          material.color.set(player ? '#34383b' : color);
          if (player) {
            material.metalness = 0.8;
            material.roughness = 0.19;
            material.envMapIntensity = 1.25;
          }
        }
        materials.set(original, material);
      }
      return materials.get(original)!;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneMaterial)
      : cloneMaterial(object.material);
  });
  const shadowTexture = softShadowTexture(),
    shadowGeometry = new THREE.PlaneGeometry(2.7, 5.4);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
    opacity: 0.66,
  });
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.028, 0);
  const brakeGeometry = new THREE.BoxGeometry(1.62, 0.07, 0.035),
    brakeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff160b,
      toneMapped: false,
    });
  const brakeLight = new THREE.Mesh(brakeGeometry, brakeMaterial);
  brakeLight.position.set(0, 0.67, -2.25);
  const nitro = new THREE.Group();
  // Local origin stays at the exhaust when the flame length pulses.
  nitro.position.z = -2.25;
  const flameGeometry = new THREE.ConeGeometry(0.15, 1.8, 12, 1, true);
  flameGeometry.rotateX(-Math.PI / 2);
  flameGeometry.translate(0, 0, -0.9);
  const flameMaterial = new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { time: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 viewNormal;
      varying vec3 viewDirection;
      varying float along;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        viewNormal = normalize(normalMatrix * normal);
        viewDirection = -view.xyz;
        along = clamp(-position.z / 1.8, 0.0, 1.0);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      varying vec3 viewNormal;
      varying vec3 viewDirection;
      varying float along;
      void main() {
        float facing = abs(dot(normalize(viewNormal), normalize(viewDirection)));
        float core = smoothstep(0.1, 0.8, facing);
        vec3 color = mix(vec3(0.12, 0.44, 1.0), vec3(1.8, 1.35, 0.45), core);
        float pulse = 0.85 + 0.15 * sin(along * 30.0 - time * 53.0);
        float alpha = (1.0 - smoothstep(0.55, 1.0, along)) * pulse * 0.85;
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0xffe99a,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  for (const x of [-0.6, 0.6]) {
    const flame = new THREE.Mesh(flameGeometry, flameMaterial);
    flame.position.set(x, 0.35, 0);
    const core = new THREE.Mesh(flameGeometry, coreMaterial);
    core.position.copy(flame.position);
    core.scale.set(0.52, 0.52, 0.74);
    nitro.add(flame, core);
  }
  nitro.visible = false;
  group.add(model, shadow, brakeLight, nitro);
  let disposed = false;
  return {
    group,
    model,
    head: model.getObjectByName('driver_head'),
    wheels,
    frontWheels,
    brakeLight,
    nitro,
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
      flameGeometry.dispose();
      flameMaterial.dispose();
      coreMaterial.dispose();
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
  visual.group.rotation.y =
    frame.heading + driver.headingError + driver.slipAngle;
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
  visual.brakeLight.visible = wet || brake > 0.1;
  const flame = visual.nitro.children[0] as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.ShaderMaterial
  >;
  flame.material.uniforms.time.value = time;
  visual.nitro.scale.z = 0.9 + Math.sin(time * 47) * 0.14;
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
