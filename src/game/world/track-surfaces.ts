import * as THREE from 'three';
import { canvasTexture, noiseTexture } from '../materials';
import { seeded } from '../tracks';

/** Original trackside textures; their materials and maps belong to the world. */
export function concreteBarrierMaterial(wet: boolean) {
  const rand = seeded(183);
  const texture = canvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = '#d6d4cb';
    ctx.fillRect(0, 0, 512, 256);
    const grime = ctx.createLinearGradient(0, 0, 0, 256);
    grime.addColorStop(0, '#ffffff18');
    grime.addColorStop(0.45, '#343b3300');
    grime.addColorStop(1, '#343b3380');
    ctx.fillStyle = grime;
    ctx.fillRect(0, 0, 512, 256);
    // Aggregate, runoff streaks and a scuffed lower face stay subtle at speed.
    for (let i = 0; i < 4800; i++) {
      ctx.fillStyle = rand() > 0.5 ? '#ffffff13' : '#30382f16';
      ctx.fillRect(rand() * 512, rand() * 256, 1 + rand() * 3, 1 + rand() * 2);
    }
    for (let i = 0; i < 65; i++) {
      ctx.fillStyle = '#3e433c0b';
      ctx.fillRect(
        rand() * 512,
        rand() * 180,
        1 + rand() * 5,
        25 + rand() * 100,
      );
    }
    for (let i = 0; i < 28; i++) {
      ctx.fillStyle = '#20262416';
      ctx.fillRect(
        rand() * 512,
        160 + rand() * 80,
        8 + rand() * 70,
        1 + rand() * 3,
      );
    }
    ctx.fillStyle = '#343a3559';
    ctx.fillRect(0, 0, 2, 256);
    ctx.fillStyle = '#ffffff36';
    ctx.fillRect(2, 0, 2, 256);
    for (const x of [32, 480]) {
      ctx.fillStyle = '#6d736955';
      ctx.beginPath();
      ctx.arc(x, 44, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: texture,
    roughness: wet ? 0.62 : 0.92,
  });
}

export function paintedRunoffMaterial(forest: boolean, wet: boolean) {
  const aggregate = noiseTexture(128);
  return new THREE.MeshStandardMaterial({
    color: forest ? 0x696953 : 0x898374,
    map: aggregate,
    bumpMap: aggregate,
    bumpScale: 0.012,
    roughness: wet ? 0.5 : 0.95,
  });
}
