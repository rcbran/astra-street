import * as THREE from 'three';
import type { DriverState } from './race-session';
import type { Track } from './tracks';

const SEGMENTS = 768;
/** Persistent drift marks in a fixed ring buffer: one draw, no growing objects. */
export class TireMarks {
  readonly mesh: THREE.Mesh;
  private positions = new Float32Array(SEGMENTS * 18);
  private previous: [number, number][] = [];
  private cursor = 0;
  private elapsed = 0;
  constructor() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshBasicMaterial({
        color: 0x080a0c,
        transparent: true,
        opacity: 0.43,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.mesh.frustumCulled = false;
  }
  update(dt: number, driver: DriverState, track: Track, drifting: boolean) {
    if (!drifting) {
      this.previous = [];
      return;
    }
    this.elapsed += dt;
    if (this.elapsed < 1 / 30) return;
    this.elapsed %= 1 / 30;
    const f = track.sample(driver.distance);
    const angle = f.heading + driver.headingError + driver.slipAngle;
    const nx = Math.cos(angle),
      nz = -Math.sin(angle);
    const cx = f.x + f.nx * driver.offset - Math.sin(angle) * 1.37;
    const cz = f.z + f.nz * driver.offset - Math.cos(angle) * 1.37;
    for (let i = 0; i < 2; i++) {
      const side = i ? 1 : -1;
      const x = cx + nx * side * 0.94,
        z = cz + nz * side * 0.94;
      const last = this.previous[i];
      if (last && Math.hypot(x - last[0], z - last[1]) < 6) {
        const y = f.y + 0.032,
          w = 0.105;
        this.positions.set(
          [
            last[0] - nx * w,
            y,
            last[1] - nz * w,
            last[0] + nx * w,
            y,
            last[1] + nz * w,
            x - nx * w,
            y,
            z - nz * w,
            x - nx * w,
            y,
            z - nz * w,
            last[0] + nx * w,
            y,
            last[1] + nz * w,
            x + nx * w,
            y,
            z + nz * w,
          ],
          (this.cursor++ % SEGMENTS) * 18,
        );
      }
      this.previous[i] = [x, z];
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
