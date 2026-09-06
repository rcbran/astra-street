import * as THREE from 'three';
import { seeded, type Track } from './tracks';
import type { DriverState } from './race-session';

const CAPACITY = 384;
const DRY_LIFE = 1.35;
const smokeOpacity = (age: number) =>
  0.28 * Math.pow(Math.max(0, 1 - age / DRY_LIFE), 1.5);
const smokeSize = (age: number) =>
  1.15 + 2.8 * (1 - Math.exp(-Math.max(0, age) * 2.7));
/** A bounded pool of soft particles; all eight cars share one draw call. */
export class TireSpray {
  readonly points: THREE.Points;
  private positions = new Float32Array(CAPACITY * 3);
  private opacity = new Float32Array(CAPACITY);
  private size = new Float32Array(CAPACITY).fill(1.2);
  private age = new Float32Array(CAPACITY).fill(2);
  private velocity = new Float32Array(CAPACITY * 3);
  private disposed = false;
  private cursor = 0;
  private elapsed = 0;
  private random = seeded(379);

  constructor(private wet = true) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    geometry.setAttribute(
      'opacity',
      new THREE.BufferAttribute(this.opacity, 1).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    geometry.setAttribute(
      'size',
      new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage),
    );
    // Stable per-slot variation; no texture asset or per-frame noise allocation.
    const seeds = new Float32Array(CAPACITY);
    for (let i = 0; i < CAPACITY; i++)
      seeds[i] = (i * 2.39996323) % (Math.PI * 2);
    geometry.setAttribute('cloudSeed', new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        resolution: { value: 900 },
        tint: { value: new THREE.Color(wet ? 0xabbccb : 0xdeddd8) },
        smoke: { value: wet ? 0 : 1 },
      },
      vertexShader: /* glsl */ `
        attribute float opacity;
        attribute float size;
        attribute float cloudSeed;
        varying float phase;
        varying float expansion;
        uniform float smoke;
        varying float alpha;
        uniform float resolution;
        void main() {
          vec4 view = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * view;
          gl_PointSize = clamp(resolution * size / max(1.0, -view.z), 1.0, mix(90.0, 180.0, smoke));
          alpha = opacity;
          phase = cloudSeed;
          expansion = size;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float alpha;
        uniform vec3 tint;
        uniform float smoke;
        varying float phase;
        varying float expansion;
        void main() {
          float radius = length(gl_PointCoord - 0.5) * 2.0;
          float soft = 1.0 - smoothstep(0.05, 1.0, radius);
          float density = soft * soft;
          if (smoke > 0.5) {
            vec2 q = (gl_PointCoord - 0.5) * 2.0;
            // Broad, asymmetric wisps evolve as the puff expands. A soft outer
            // envelope hides the point-square boundary and avoids bright discs.
            vec2 warped = q + 0.12 * vec2(
              sin(q.y * 5.0 + phase + expansion * 0.7),
              sin(q.x * 4.0 - phase - expansion * 0.5));
            float body = 1.0 - smoothstep(0.0, 1.0, length(warped * vec2(0.9, 1.1)));
            float wisps = 0.76 + 0.24 * sin(warped.x * 7.0 + phase) * sin(warped.y * 6.0 - phase);
            density = body * wisps * (1.0 - smoothstep(0.65, 1.0, radius));
          }
          gl_FragColor = vec4(tint, density * alpha);
          #include <colorspace_fragment>
        }
      `,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
  }

  update(dt: number, drivers: DriverState[], track: Track, height: number) {
    if (this.disposed) return;
    const material = this.points.material as THREE.ShaderMaterial;
    material.uniforms.resolution.value = height;
    for (let i = 0; i < CAPACITY; i++) {
      this.age[i] += dt;
      const life = this.wet ? 0.8 : DRY_LIFE;
      this.opacity[i] = this.wet
        ? Math.max(0, 1 - this.age[i] / life) * 0.14
        : smokeOpacity(this.age[i]);
      this.size[i] = this.wet ? 1.2 : smokeSize(this.age[i]);
      if (this.age[i] > life) continue;
      const j = i * 3;
      this.positions[j] += this.velocity[j] * dt;
      this.positions[j + 1] += dt * (this.wet ? 1.2 : 0.65);
      this.positions[j + 2] += this.velocity[j + 2] * dt;
    }
    this.elapsed += dt;
    const interval = this.wet ? 1 / 25 : 1 / 90;
    if (this.elapsed >= interval) {
      // Catch up dry emissions across capped frames, bounded after a long frame.
      const stamps = this.wet
        ? 1
        : Math.min(8, Math.floor(this.elapsed / interval));
      // Subtraction avoids `%` rounding a precise frame multiple up to a
      // whole interval, which would detach the newest dry puff from its tire.
      this.elapsed = this.wet
        ? this.elapsed % interval
        : Math.max(
            0,
            this.elapsed - Math.floor(this.elapsed / interval) * interval,
          );
      for (const driver of drivers) {
        if (driver.speed < 20) continue;
        if (!this.wet && Math.abs(driver.slipAngle) < 0.12) continue;
        for (let stamp = 0; stamp < stamps; stamp++) {
          // Historical stamps have historical ages, avoiding a visible batch
          // of identical new puffs at each 30 FPS render boundary.
          const birthAge = this.wet
            ? 0
            : interval * (stamps - 1 - stamp) + this.elapsed;
          const f = track.sample(driver.distance - driver.speed * birthAge);
          const angle = f.heading + driver.headingError + driver.slipAngle;
          const tx = Math.sin(angle),
            tz = Math.cos(angle);
          for (let side = -1; side <= 1; side += 2) {
            const index = this.cursor++ % CAPACITY,
              j = index * 3;
            this.positions[j] =
              f.x + f.nx * driver.offset - tx * 1.37 + tz * side * 0.94;
            this.positions[j + 1] = f.y + 0.25 + this.random() * 0.2;
            this.positions[j + 2] =
              f.z + f.nz * driver.offset - tz * 1.37 - tx * side * 0.94;
            const momentum = this.wet ? 0.25 : 0.1;
            this.velocity[j] = f.tx * driver.speed * momentum + f.nx * side;
            this.velocity[j + 2] = f.tz * driver.speed * momentum + f.nz * side;
            this.age[index] = birthAge;
            if (!this.wet) {
              this.positions[j] += this.velocity[j] * birthAge;
              this.positions[j + 1] += 0.65 * birthAge;
              this.positions[j + 2] += this.velocity[j + 2] * birthAge;
              this.opacity[index] = smokeOpacity(birthAge);
            }
            this.size[index] = this.wet ? 1.2 : smokeSize(birthAge);
          }
        }
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.opacity.needsUpdate = true;
    this.points.geometry.attributes.size.needsUpdate = true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.points.removeFromParent();
    this.points.geometry.dispose();
    (this.points.material as THREE.ShaderMaterial).dispose();
  }
}
