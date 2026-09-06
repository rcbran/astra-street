import * as THREE from 'three';
import { closeCanyonScan } from './canyon-scan-shell';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface CanyonScan {
  id: string;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
  bounds: THREE.Box3;
  triangles: number;
}
/** Engine-owned immutable scans; world instances borrow these resources. */
export interface CanyonScanAssets {
  scans: CanyonScan[];
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
  textures: Set<THREE.Texture>;
  dispose: () => void;
}

/** Takes ownership of loaded source resources and bakes their complete transforms. */
export function createCanyonScanAssets(
  sources: { id: string; scene: THREE.Group }[],
): CanyonScanAssets {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };
  // Collect everything first so failure in a later source cannot leak earlier
  // or unprocessed imports. Environment textures are attached only after load.
  for (const source of sources)
    source.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) textures.add(value);
      }
    });
  try {
    const scans = sources.map(({ id, scene }) => {
      scene.updateMatrixWorld(true);
      const parts: THREE.Mesh[] = [];
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) parts.push(object);
      });
      if (
        parts.length !== 1 ||
        !(parts[0].material instanceof THREE.MeshStandardMaterial)
      )
        throw new Error(
          `Expected one standard-material primitive in canyon scan ${id}`,
        );
      const part = parts[0];
      const material = part.material as THREE.MeshStandardMaterial;
      const front = part.geometry.clone().applyMatrix4(part.matrixWorld);
      geometries.add(front);
      const geometry = closeCanyonScan(
        front,
        id.endsWith('_02')
          ? [0.035, 0.66, 0.055, 0.12]
          : [0.35, 0.58, 0.1, 0.12],
      );
      front.dispose();
      geometries.delete(front);
      geometries.add(geometry);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      // The scan's native grey/brown albedo remains intact. This gentle authored
      // warm tint is reversible and can be reviewed in the actual game lighting.
      material.color.setRGB(1.12, 0.86, 0.65);
      material.roughness = 0.96;
      material.metalness = 0;
      material.envMapIntensity = 0.3;
      for (const texture of textures) texture.anisotropy = 8;
      return {
        id,
        geometry,
        material,
        bounds: geometry.boundingBox!.clone(),
        triangles:
          (geometry.index?.count ?? geometry.getAttribute('position').count) /
          3,
      };
    });
    for (const source of sources)
      source.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || !geometries.has(object.geometry))
          return;
        object.geometry.dispose();
        geometries.delete(object.geometry);
      });
    return { scans, geometries, materials, textures, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

export async function loadCanyonScanAssets(): Promise<CanyonScanAssets> {
  const loader = new GLTFLoader();
  const sources: { id: string; scene: THREE.Group }[] = [];
  try {
    for (const id of ['namaqualand_cliff_01', 'namaqualand_cliff_02']) {
      const gltf = await loader.loadAsync(`/assets/models/rocks/${id}.glb`);
      sources.push({ id, scene: gltf.scene });
    }
  } catch (error) {
    // Also release a successful first download if the second one fails.
    if (sources.length) createCanyonScanAssets(sources).dispose();
    throw error;
  }
  return createCanyonScanAssets(sources);
}
