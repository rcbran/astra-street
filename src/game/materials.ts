import * as THREE from 'three';
export function canvasTexture(
  width: number,
  height: number,
  paint: (ctx: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  paint(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
export function signTexture(
  text: string,
  color = '#efede5',
  background = '#13201d',
) {
  return canvasTexture(1024, 128, (c) => {
    c.fillStyle = background;
    c.fillRect(0, 0, 1024, 128);
    c.fillStyle = color;
    c.font = 'italic 800 69px Arial';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 512, 66);
  });
}
export function buildingTexture(night: boolean, seed = 2) {
  let v = seed;
  const rand = () => {
    v = (v * 16807) % 2147483647;
    return v / 2147483647;
  };
  return canvasTexture(256, 512, (c) => {
    c.fillStyle = night ? '#121c28' : '#7d919c';
    c.fillRect(0, 0, 256, 512);
    for (let y = 0; y < 512; y += 18)
      for (let x = 0; x < 256; x += 21) {
        const r = rand();
        c.fillStyle = night
          ? r > 0.38
            ? r > 0.8
              ? '#bcd8e5'
              : '#c6b58a'
            : '#152331'
          : r > 0.4
            ? '#506a79'
            : '#8fa5ae';
        c.fillRect(x + 3, y + 3, 14, 11);
      }
    c.fillStyle = night ? '#07111c' : '#687c85';
    for (let x = 0; x < 256; x += 64) c.fillRect(x, 0, 3, 512);
  });
}
export function noiseTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  let s = 19;
  for (let i = 0; i < data.length; i += 4) {
    s = (s * 16807) % 2147483647;
    const v = 180 + (s % 76);
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, size, size);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  return t;
}
export function softShadowTexture() {
  return canvasTexture(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 12, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.7)');
    g.addColorStop(0.5, 'rgba(0,0,0,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  });
}
export interface SurfaceTextures {
  color: THREE.Texture;
  normal: THREE.Texture;
  rough: THREE.Texture;
  grass: THREE.Texture;
  grassNormal: THREE.Texture;
  grassRough: THREE.Texture;
  trees: THREE.Texture;
  conifers: THREE.Texture;
  rock: THREE.Texture;
}
export async function loadRoadTextures(): Promise<SurfaceTextures> {
  const loader = new THREE.TextureLoader();
  const [
    color,
    normal,
    rough,
    grass,
    grassNormal,
    grassRough,
    trees,
    conifers,
    rock,
  ] = await Promise.all([
    loader.loadAsync('/assets/textures/asphalt_track_diff_1k.jpg'),
    loader.loadAsync('/assets/textures/asphalt_track_nor_gl_1k.jpg'),
    loader.loadAsync('/assets/textures/asphalt_track_rough_1k.jpg'),
    loader.loadAsync('/assets/textures/sparse_grass_diff_1k.jpg'),
    loader.loadAsync('/assets/textures/sparse_grass_nor_gl_1k.jpg'),
    loader.loadAsync('/assets/textures/sparse_grass_rough_1k.jpg'),
    loader.loadAsync('/assets/textures/trees.png'),
    loader.loadAsync('/assets/textures/conifers.png'),
    loader.loadAsync('/assets/textures/cliff-rock.png'),
  ]);
  for (const texture of [color, grass, trees, conifers, rock])
    texture.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [
    color,
    normal,
    rough,
    grass,
    grassNormal,
    grassRough,
    rock,
  ]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
  }
  for (const texture of [grass, grassNormal, grassRough])
    texture.repeat.set(1200, 1200);
  trees.anisotropy = 4;
  conifers.anisotropy = 4;
  return {
    color,
    normal,
    rough,
    grass,
    grassNormal,
    grassRough,
    trees,
    conifers,
    rock,
  };
}
