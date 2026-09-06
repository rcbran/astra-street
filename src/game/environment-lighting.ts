import * as THREE from 'three';

const authoredIntensity = new WeakMap<THREE.MeshStandardMaterial, number>();

/** Three uses scene.environmentIntensity instead of a material's setting when
 * envMap is null. Bind the shared engine-owned map explicitly so bark, leaves,
 * ground and car paint retain their independently authored light response. */
export function bindEnvironmentLighting(
  root: THREE.Object3D,
  environment: THREE.Texture,
  rotation: THREE.Euler,
  weatherIntensity: number,
) {
  const seen = new Set<THREE.MeshStandardMaterial>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      if (
        !(material instanceof THREE.MeshStandardMaterial) ||
        seen.has(material)
      )
        continue;
      seen.add(material);
      if (!authoredIntensity.has(material))
        authoredIntensity.set(material, material.envMapIntensity);
      if (material.envMap !== environment) {
        material.envMap = environment;
        material.needsUpdate = true;
      }
      material.envMapIntensity =
        authoredIntensity.get(material)! * weatherIntensity;
      material.envMapRotation.copy(rotation);
    }
  });
}
