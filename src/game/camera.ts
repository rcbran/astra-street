import * as THREE from 'three';
import type { DriverState } from './race-session';
import type { Track } from './tracks';
import type { Phase, Settings } from './types';
export class RaceCamera {
  readonly camera = new THREE.PerspectiveCamera(52, 1, 0.06, 2400);
  private position = new THREE.Vector3();
  private look = new THREE.Vector3();
  private targetPosition = new THREE.Vector3();
  private targetLook = new THREE.Vector3();
  private forward = new THREE.Vector3();
  private right = new THREE.Vector3();
  private origin = new THREE.Vector3();
  private previousOrigin = new THREE.Vector3();
  private movement = new THREE.Vector3();
  private snap = true;
  reset() {
    this.snap = true;
  }
  resize(aspect: number) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }
  update(
    dt: number,
    driver: DriverState,
    track: Track,
    phase: Phase,
    settings: Settings,
    menuTime: number,
    boosted: boolean,
  ) {
    const frame = track.sample(driver.distance),
      heading = frame.heading + driver.headingError;
    this.origin.set(
      frame.x + frame.nx * driver.offset,
      frame.y + 0.04,
      frame.z + frame.nz * driver.offset,
    );
    this.forward.set(Math.sin(heading), 0, Math.cos(heading));
    this.right.set(this.forward.z, 0, -this.forward.x);
    // Carry translation with the car; damping only the relative rig keeps the
    // chase distance consistent instead of adding speed / damping meters of lag.
    if (!this.snap) {
      this.movement.subVectors(this.origin, this.previousOrigin);
      this.position.add(this.movement);
      this.look.add(this.movement);
    }
    this.previousOrigin.copy(this.origin);
    if (phase === 'menu' || phase === 'loading') {
      const orbit = Math.sin(menuTime * 0.075) * 0.12;
      this.targetPosition
        .copy(this.origin)
        .addScaledVector(this.forward, 8.8 + orbit)
        .addScaledVector(this.right, -7.0 + orbit * 6);
      this.targetPosition.y += 2.8;
      this.targetLook
        .copy(this.origin)
        .addScaledVector(this.forward, -0.7)
        .addScaledVector(this.right, 0.8);
      this.targetLook.y += 0.58;
      this.camera.fov = 43;
    } else if (settings.camera === 'cockpit') {
      this.targetPosition.copy(this.origin).addScaledVector(this.forward, 0.9);
      this.targetPosition.y += 0.98;
      this.targetLook.copy(this.origin).addScaledVector(this.forward, 28);
      this.targetLook.y += 0.69;
      this.camera.fov = 65;
    } else {
      const ahead = track.sample(
        driver.distance + Math.max(6, driver.speed * 0.14),
      );
      this.targetPosition
        .copy(this.origin)
        .addScaledVector(this.forward, -20.8 - driver.speed * 0.02);
      this.targetPosition.y += 5.2 + driver.speed * 0.004;
      this.targetLook.set(
        ahead.x + ahead.nx * driver.offset * 0.75,
        1.02,
        ahead.z + ahead.nz * driver.offset * 0.75,
      );
      this.camera.fov =
        52 + Math.min(9, driver.speed * 0.075) + (boosted ? 3 : 0);
    }
    // A cockpit must move with the chassis. World-space damping would leave
    // the eye behind the seat at racing speed, inside the engine cover.
    const attached =
      settings.camera === 'cockpit' && phase !== 'menu' && phase !== 'loading';
    const amount = this.snap || attached ? 1 : 1 - Math.exp(-dt * 6.5);
    this.position.lerp(this.targetPosition, amount);
    this.look.lerp(this.targetLook, amount);
    this.camera.position.copy(this.position);
    this.camera.lookAt(this.look);
    this.camera.updateProjectionMatrix();
    this.snap = false;
  }
}
