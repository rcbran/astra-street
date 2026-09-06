import * as THREE from 'three';
import { seeded } from '../tracks';

/** Original botanical geometry. Individual curved leaves have thickness; no
 * plant-sized billboard or intersecting whole-bush cards are used. Geometries
 * are caller-owned and intended for shared, spatially culled instance batches. */
class PlantMesh {
  private positions: number[] = [];
  private colors: number[] = [];
  triangle(
    a: THREE.Vector3,
    b: THREE.Vector3,
    c: THREE.Vector3,
    color: THREE.Color,
  ) {
    for (const p of [a, b, c]) {
      this.positions.push(p.x, p.y, p.z);
      this.colors.push(color.r, color.g, color.b);
    }
  }
  stem(
    a: THREE.Vector3,
    b: THREE.Vector3,
    r0: number,
    r1: number,
    color: THREE.Color,
    sides = 5,
  ) {
    const axis = b.clone().sub(a).normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(axis);
    if (right.lengthSq() < 0.001) right.set(1, 0, 0);
    right.normalize();
    const front = axis.clone().cross(right).normalize();
    const point = (center: THREE.Vector3, r: number, angle: number) =>
      center
        .clone()
        .addScaledVector(right, Math.cos(angle) * r)
        .addScaledVector(front, Math.sin(angle) * r);
    for (let i = 0; i < sides; i++) {
      const t0 = (i / sides) * Math.PI * 2,
        t1 = ((i + 1) / sides) * Math.PI * 2;
      const p0 = point(a, r0, t0),
        p1 = point(a, r0, t1),
        p2 = point(b, r1, t0),
        p3 = point(b, r1, t1);
      this.triangle(p0, p1, p2, color);
      this.triangle(p1, p3, p2, color);
    }
  }
  leaf(
    base: THREE.Vector3,
    tip: THREE.Vector3,
    width: number,
    roll: number,
    color: THREE.Color,
  ) {
    const axis = tip.clone().sub(base),
      length = axis.length();
    const direction = axis.clone().normalize();
    const side = new THREE.Vector3(0, 1, 0).cross(direction);
    if (side.lengthSq() < 0.001) side.set(1, 0, 0);
    side.normalize().applyAxisAngle(direction, roll);
    const normal = direction.clone().cross(side).normalize();
    const center = base.clone().addScaledVector(axis, 0.49);
    const left = center.clone().addScaledVector(side, width / 2);
    const right = center.clone().addScaledVector(side, -width / 2);
    // A shallow raised vein and curved underside give the leaf real volume and
    // different surface normals around its perimeter instead of a flat quad.
    const ridge = center.clone().addScaledVector(normal, length * 0.08);
    const underside = center.clone().addScaledVector(normal, -length * 0.014);
    const ring = [base, left, tip, right];
    const lower = color.clone().multiplyScalar(0.7);
    for (let i = 0; i < ring.length; i++) {
      this.triangle(ring[i], ridge, ring[(i + 1) % ring.length], color);
      this.triangle(ring[(i + 1) % ring.length], underside, ring[i], lower);
    }
  }
  finish() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(this.positions, 3),
    );
    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(this.colors, 3),
    );
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }
}

/** A loose tussock roughly one metre tall before instance scaling. Each blade
 * bends and twists independently; default world scales should be 0.2–0.8. */
export function grassClumpGeometry(seed = 171) {
  const rand = seeded(seed),
    plant = new PlantMesh();
  for (let blade = 0; blade < 13; blade++) {
    const yaw = rand() * Math.PI * 2,
      height = 0.3 + rand() * 0.7;
    const radial = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
    const base = radial.clone().multiplyScalar(rand() * 0.13);
    const side = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw));
    const color = new THREE.Color().setHSL(
      0.2 + rand() * 0.07,
      0.3 + rand() * 0.12,
      0.2 + rand() * 0.12,
    );
    let previousLeft = base.clone().addScaledVector(side, -0.009),
      previousRight = base.clone().addScaledVector(side, 0.009);
    for (let segment = 1; segment <= 4; segment++) {
      const t = segment / 4;
      const center = base
        .clone()
        .addScaledVector(radial, t * t * height * 0.48);
      center.y = height * (t - 0.14 * t * t);
      const twist = side.clone().applyAxisAngle(radial, t * 0.75);
      const width = 0.018 * (1 - t) * (1 + Math.sin(t * Math.PI));
      const left = center.clone().addScaledVector(twist, -width),
        right = center.clone().addScaledVector(twist, width);
      plant.triangle(previousLeft, left, previousRight, color);
      if (segment < 4) plant.triangle(previousRight, left, right, color);
      previousLeft = left;
      previousRight = right;
    }
  }
  return plant.finish();
}

/** Radial, arching fern fronds with paired pinnate leaflets. Unit diameter is
 * about 1.8m; scaling 0.45–0.85 makes typical roadside ground ferns. */
export function fernGeometry(seed = 292) {
  const rand = seeded(seed),
    plant = new PlantMesh();
  const rachisColor = new THREE.Color('#5b6630');
  for (let frond = 0; frond < 9; frond++) {
    const yaw = (frond / 9) * Math.PI * 2 + rand() * 0.3;
    const radial = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
    const lateral = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw));
    const length = 0.52 + rand() * 0.45,
      height = 0.38 + rand() * 0.28;
    const at = (t: number) =>
      radial
        .clone()
        .multiplyScalar(length * t)
        .setY(0.025 + height * Math.sin(t * Math.PI * 0.75));
    let previous = at(0);
    const color = new THREE.Color().setHSL(
      0.23 + rand() * 0.055,
      0.4 + rand() * 0.1,
      0.19 + rand() * 0.07,
    );
    for (let pair = 1; pair <= 12; pair++) {
      const t = pair / 13,
        base = at(t);
      plant.stem(
        previous,
        base,
        0.006 * (1 - t * 0.7),
        0.006 * (1 - t * 0.8),
        rachisColor,
        4,
      );
      previous = base;
      const leafletLength = Math.sin(t * Math.PI) * (0.13 + length * 0.11);
      for (const side of [-1, 1]) {
        const tip = base
          .clone()
          .addScaledVector(lateral, side * leafletLength)
          .addScaledVector(radial, 0.035 + t * 0.055);
        tip.y += 0.015 + (rand() - 0.5) * 0.06;
        plant.leaf(
          base,
          tip,
          leafletLength * 0.29,
          side * (0.16 + rand() * 0.4),
          color.clone().multiplyScalar(0.88 + rand() * 0.25),
        );
      }
    }
    plant.leaf(previous, at(1), 0.032, 0, color);
  }
  return plant.finish();
}

/** Open, branched broadleaf understory shrub. Leaves sit along individual twig
 * shoots, leaving holes between sprays and an irregular crown from every yaw. */
export function shrubGeometry(seed = 383) {
  const rand = seeded(seed),
    plant = new PlantMesh();
  const bark = new THREE.Color('#5b5036');
  for (let stem = 0; stem < 5; stem++) {
    const yaw = (stem / 5) * Math.PI * 2 + (rand() - 0.5) * 0.6;
    const radial = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));
    const start = new THREE.Vector3(
      (rand() - 0.5) * 0.08,
      0,
      (rand() - 0.5) * 0.08,
    );
    const end = radial
      .clone()
      .multiplyScalar(0.28 + rand() * 0.23)
      .setY(0.62 + rand() * 0.42);
    const middle = start.clone().lerp(end, 0.5).addScaledVector(radial, -0.05);
    plant.stem(start, middle, 0.017, 0.01, bark);
    plant.stem(middle, end, 0.01, 0.002, bark);
    for (let shoot = 0; shoot < 6; shoot++) {
      const t = 0.3 + shoot / 8;
      const base = start.clone().lerp(end, t);
      const shootYaw = yaw + (shoot % 2 ? 1 : -1) * (1 + rand() * 0.5);
      const direction = new THREE.Vector3(
        Math.cos(shootYaw),
        0.5 + rand() * 0.7,
        Math.sin(shootYaw),
      ).normalize();
      const length = 0.22 + rand() * 0.18;
      const tip = base.clone().addScaledVector(direction, length);
      plant.stem(base, tip, 0.004, 0.001, bark, 4);
      const lateral = new THREE.Vector3(
        -direction.z,
        0,
        direction.x,
      ).normalize();
      for (let leaf = 0; leaf < 7; leaf++) {
        const u = 0.18 + leaf * 0.11;
        const node = base.clone().lerp(tip, u);
        const leafLength = (0.095 + rand() * 0.06) * (1.13 - u * 0.35);
        const side = leaf % 2 ? 1 : -1;
        const leafTip = node
          .clone()
          .addScaledVector(lateral, side * leafLength * 0.8)
          .addScaledVector(direction, leafLength * 0.4);
        leafTip.y += (rand() - 0.4) * 0.06;
        const color = new THREE.Color().setHSL(
          0.22 + rand() * 0.055,
          0.34 + rand() * 0.13,
          0.16 + rand() * 0.1,
        );
        plant.leaf(
          node,
          leafTip,
          leafLength * 0.5,
          side * (rand() * 0.6 - 0.3),
          color,
        );
      }
      plant.leaf(
        tip.clone().addScaledVector(direction, -0.05),
        tip.clone().addScaledVector(direction, 0.085),
        0.045,
        rand() * 0.6,
        new THREE.Color('#45622d'),
      );
    }
  }
  return plant.finish();
}
