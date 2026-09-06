import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export interface TreeSpecies {
  id: string;
  lods: THREE.Group[];
  height: number;
  radius: number;
}
/** Immutable models and textures live with the engine, across world changes. */
export interface TreeAssets {
  species: TreeSpecies[];
  geometries: Set<THREE.BufferGeometry>;
  materials: Set<THREE.Material>;
  textures: Set<THREE.Texture>;
  depthMaterials: Map<THREE.Material, THREE.MeshDepthMaterial>;
  update: (time: number, wind: number) => void;
  dispose: () => void;
}

// Gentle crown flex and small branch motion. The identical displacement is
// installed on the depth pass so moving foliage does not leave fixed shadows.
function animateTreeMaterial(
  material: THREE.Material,
  time: THREE.IUniform<number>,
  wind: THREE.IUniform<number>,
  foliage: boolean,
) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.treeTime = time;
    shader.uniforms.treeWind = wind;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float treeTime;
        uniform float treeWind;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec2 treeOrigin = vec2(0.0);
        #ifdef USE_INSTANCING
          treeOrigin = instanceMatrix[3].xz;
        #endif
        float treePhase = dot(treeOrigin, vec2(0.023, 0.037));
        float treeHeight = clamp(position.y / 20.0, 0.0, 1.8);
        float treeGust = sin(treeTime * 0.72 + treePhase) + 0.32 * sin(treeTime * 1.13 + treePhase * 1.7);
        transformed.x += treeHeight * treeHeight * treeGust * treeWind * 0.16;
        transformed.z += treeHeight * treeHeight * sin(treeTime * 0.6 + treePhase + 1.8) * treeWind * 0.11;
        ${foliage ? `transformed.xz += vec2(0.018, 0.012) * treeWind * treeHeight * sin(treeTime * 2.4 + dot(position, vec3(1.7, 2.3, 1.1)) + treePhase);` : ''}`,
      );
    if (foliage && material instanceof THREE.MeshStandardMaterial) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        // Thin needles transmit a little warm light into shadowed sprays.
        #if NUM_DIR_LIGHTS > 0
          float leafTransmission = pow(clamp(dot(-normal, directionalLights[0].direction), 0.0, 1.0), 2.0);
          reflectedLight.indirectDiffuse += diffuseColor.rgb * directionalLights[0].color * leafTransmission * 0.055;
        #endif`,
      );
    }
  };
  material.customProgramCacheKey = () => `astra-tree-wind-v1-${foliage}`;
}

export async function loadTreeAssets(): Promise<TreeAssets> {
  const loader = new GLTFLoader();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const depthMaterials = new Map<THREE.Material, THREE.MeshDepthMaterial>();
  const species: TreeSpecies[] = [];
  const time = { value: 0 },
    wind = { value: 1 };
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    depthMaterials.forEach((m) => m.dispose());
  };
  try {
    const files = ['fir_tree_01', 'pine_tree_01', 'tree_small_02'];
    for (const file of files) {
      const gltf = await loader.loadAsync(`/assets/models/trees/${file}.glb`);
      gltf.scene.updateMatrixWorld(true);
      const variants = new Map<string, THREE.Object3D[]>();
      const sourceGeometry = new Set<THREE.BufferGeometry>();
      gltf.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          sourceGeometry.add(object.geometry);
          const list = Array.isArray(object.material)
            ? object.material
            : [object.material];
          for (const material of list) {
            if (materials.has(material)) continue;
            materials.add(material);
            for (const texture of Object.values(material)) {
              if (!(texture instanceof THREE.Texture)) continue;
              texture.anisotropy = 8;
              textures.add(texture);
            }
            if (!(material instanceof THREE.MeshStandardMaterial)) continue;
            const foliage =
              material.userData.foliage === true ||
              material.alphaTest > 0 ||
              material.transparent;
            material.transparent = false;
            material.depthWrite = true;
            material.metalness = 0;
            material.roughness = 0.94;
            material.envMapIntensity = foliage ? 0.2 : 0.3;
            if (foliage) {
              material.alphaTest = 0.38;
              // Alpha-to-coverage made distant needle sprays thin and sparkly.
              // Keep hardware MSAA for geometry and explicit leaf cutouts here.
              material.alphaToCoverage = false;
              material.side = THREE.DoubleSide;
              material.normalScale.setScalar(0.45);
            }
            animateTreeMaterial(material, time, wind, foliage);
            const depth = new THREE.MeshDepthMaterial({
              depthPacking: THREE.RGBADepthPacking,
              map: material.map,
              alphaMap: material.alphaMap,
              alphaTest: material.alphaTest,
              side: material.side,
            });
            animateTreeMaterial(depth, time, wind, foliage);
            depthMaterials.set(material, depth);
          }
        }
        const match = object.name.match(/^(.+)_LOD([0-2])$/);
        if (!match) return;
        const lods = variants.get(match[1]) ?? [];
        lods[Number(match[2])] = object;
        variants.set(match[1], lods);
      });
      for (const [id, nodes] of variants) {
        if (nodes.length !== 3 || !nodes[0] || !nodes[1] || !nodes[2])
          throw new Error(`Incomplete tree LODs: ${id}`);
        const lods = nodes.map((node) => {
          const group = new THREE.Group();
          group.name = node.name;
          node.traverse((part) => {
            if (!(part instanceof THREE.Mesh)) return;
            // glTF empty transform nodes are Object3D, not Group. Bake their
            // complete Y-up transform once before sharing geometry in batches.
            const geometry = part.geometry
              .clone()
              .applyMatrix4(part.matrixWorld);
            geometries.add(geometry);
            const mesh = new THREE.Mesh(geometry, part.material);
            mesh.name = part.name;
            group.add(mesh);
          });
          return group;
        });
        const box = new THREE.Box3().setFromObject(lods[0]);
        const size = box.getSize(new THREE.Vector3());
        let radius = 0;
        for (const lod of lods)
          lod.traverse((part) => {
            if (!(part instanceof THREE.Mesh)) return;
            const positions = part.geometry.getAttribute('position');
            for (let i = 0; i < positions.count; i++)
              radius = Math.max(
                radius,
                Math.hypot(positions.getX(i), positions.getZ(i)),
              );
          });
        species.push({
          id,
          lods,
          height: size.y,
          radius,
        });
      }
      sourceGeometry.forEach((geometry) => {
        geometry.dispose();
        geometries.delete(geometry);
      });
    }
    if (!species.length)
      throw new Error('The forest model contains no tree variants.');
    return {
      species,
      geometries,
      materials,
      textures,
      depthMaterials,
      update: (elapsed, strength) => {
        time.value = elapsed;
        wind.value = strength;
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
