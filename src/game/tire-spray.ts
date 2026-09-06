import * as THREE from 'three';
import { seeded, type Track } from './tracks';
import type { DriverState } from './race-session';

const CAPACITY = 384;
/** A bounded pool of soft particles; all eight cars share one draw call. */
export class TireSpray {
  readonly points: THREE.Points;
  private positions = new Float32Array(CAPACITY * 3);
  private opacity = new Float32Array(CAPACITY);
  private age = new Float32Array(CAPACITY).fill(2);
  private velocity = new Float32Array(CAPACITY * 3);
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
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        resolution: { value: 900 },
        tint: { value: new THREE.Color(wet ? 0xabbccb : 0xf0efe8) },
      },
      vertexShader: /* glsl */ `
        attribute float opacity;
        varying float alpha;
        uniform float resolution;
        void main() {
          vec4 view = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * view;
          gl_PointSize = clamp(resolution * 1.2 / max(1.0, -view.z), 1.0, 90.0);
          alpha = opacity;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float alpha;
        uniform vec3 tint;
        void main() {
          float radius = length(gl_PointCoord - 0.5) * 2.0;
          float soft = 1.0 - smoothstep(0.05, 1.0, radius);
          gl_FragColor = vec4(tint, soft * soft * alpha);
          #include <colorspace_fragment>
        }
      `,
    });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
  }

  update(dt: number, drivers: DriverState[], track: Track, height: number) {
    const material = this.points.material as THREE.ShaderMaterial;
    material.uniforms.resolution.value = height;
    for (let i = 0; i < CAPACITY; i++) {
      this.age[i] += dt;
      const life = this.wet ? 0.8 : 1.4;
      this.opacity[i] =
        Math.max(0, 1 - this.age[i] / life) * (this.wet ? 0.14 : 0.48);
      if (this.age[i] > life) continue;
      const j = i * 3;
      this.positions[j] += this.velocity[j] * dt;
      this.positions[j + 1] += dt * 1.2;
      this.positions[j + 2] += this.velocity[j + 2] * dt;
    }
    this.elapsed += dt;
    const interval = this.wet ? 1 / 25 : 1 / 60;
    if (this.elapsed >= interval) {
      this.elapsed %= interval;
      for (const driver of drivers) {
        if (driver.speed < 20) continue;
        if (!this.wet && Math.abs(driver.slipAngle) < 0.12) continue;
        for (let stamp = 0; stamp < (this.wet ? 1 : 2); stamp++) {
          const f = track.sample(
            driver.distance - driver.speed * interval * stamp * 0.5,
          );
          const angle = f.heading + driver.headingError + driver.slipAngle;
          const tx = Math.sin(angle),
            tz = Math.cos(angle);
          for (const side of [-1, 1]) {
            const index = this.cursor++ % CAPACITY,
              j = index * 3;
            this.positions[j] =
              f.x + f.nx * driver.offset - tx * 1.37 + tz * side * 0.94;
            this.positions[j + 1] = 0.25 + this.random() * 0.2;
            this.positions[j + 2] =
              f.z + f.nz * driver.offset - tz * 1.37 - tx * side * 0.94;
            this.velocity[j] = f.tx * driver.speed * 0.25 + f.nx * side;
            this.velocity[j + 2] = f.tz * driver.speed * 0.25 + f.nz * side;
            this.age[index] = 0;
          }
        }
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.opacity.needsUpdate = true;
  }

  dispose() {
    this.points.removeFromParent();
    this.points.geometry.dispose();
    (this.points.material as THREE.ShaderMaterial).dispose();
  }
}
