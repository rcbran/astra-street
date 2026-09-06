import * as THREE from 'three';

type Quality = 'eco' | 'balanced' | 'ultra';
const vertex = `varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const depthHelpers = `
uniform sampler2D tDepth;
uniform mat4 inverseProjection;
uniform vec2 depthTexel;
vec3 viewPosition(vec2 uv) {
  uv = (floor(uv / depthTexel) + 0.5) * depthTexel;
  float depth = texture2D(tDepth, uv).r;
  vec4 p = inverseProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}`;
const aoFragment = `
varying vec2 vUv;
uniform vec2 texel;
uniform mat4 projection;
${depthHelpers}
void main() {
  float depth = texture2D(tDepth, vUv).r;
  if (depth >= 0.999999) { gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); return; }
  vec3 p = viewPosition(vUv);
  float distance = -p.z;
  if (distance > 180.0) { gl_FragColor = vec4(0.0, distance / 180.0, 0.0, 1.0); return; }
  // Use the nearest same-surface derivative on either side of an edge. This
  // avoids reconstructing a giant fake normal across a tree/sky silhouette.
  vec3 left = viewPosition(vUv - vec2(texel.x * 4.0, 0.0));
  vec3 right = viewPosition(vUv + vec2(texel.x * 4.0, 0.0));
  vec3 down = viewPosition(vUv - vec2(0.0, texel.y * 4.0));
  vec3 up = viewPosition(vUv + vec2(0.0, texel.y * 4.0));
  vec3 dx = abs(left.z-p.z) < abs(right.z-p.z) ? p-left : right-p;
  vec3 dy = abs(down.z-p.z) < abs(up.z-p.z) ? p-down : up-p;
  vec3 n = normalize(cross(dx, dy));
  if (dot(n, -p) < 0.0) n = -n;
  float radius = 2.2;
  vec2 screenRadius = vec2(projection[0][0], projection[1][1]) * radius / max(distance, 1.0) * 0.5;
  float occ = 0.0;
  // Fixed golden-angle disk; no frame-varying noise, history or foliage ghosting.
  for (int i = 0; i < 12; i++) {
    float fi = float(i) + 0.5;
    float angle = fi * 2.39996323;
    vec2 uv = vUv + vec2(cos(angle), sin(angle)) * sqrt(fi / 12.0) * screenRadius;
    if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) continue;
    vec3 delta = viewPosition(uv) - p;
    float len = length(delta);
    float horizon = max((dot(n, delta) - (0.035 + distance * 0.001)) / max(len, 0.001) - 0.06, 0.0);
    occ += horizon * (1.0 - smoothstep(radius * 0.25, radius, len));
  }
  occ = clamp(occ * (3.0 / 12.0), 0.0, 1.0) * (1.0 - smoothstep(110.0, 180.0, distance));
  gl_FragColor = vec4(occ, distance / 180.0, 0.0, 1.0);
}`;
const compositeFragment = `
varying vec2 vUv;
uniform sampler2D tBeauty;
uniform sampler2D tAO;
uniform vec2 aoTexel;
${depthHelpers}
void main() {
  vec4 beauty = texture2D(tBeauty, vUv);
  float distance = -viewPosition(vUv).z;
  float sum = 0.0, weights = 0.0;
  // Depth-aware cross filter smooths the half-resolution AO without bleeding
  // it from trunks onto the sky or between cars and the road behind them.
  for (int i=0; i<5; i++) {
    vec2 offset = i==0 ? vec2(0.0) : i==1 ? vec2(1.0,0.0) : i==2 ? vec2(-1.0,0.0) : i==3 ? vec2(0.0,1.0) : vec2(0.0,-1.0);
    vec2 sampleAO = texture2D(tAO, vUv + offset * aoTexel).rg;
    float weight = exp(-abs(sampleAO.g * 180.0 - distance) * 2.0) * (i==0 ? 2.0 : 1.0);
    sum += sampleAO.r * weight; weights += weight;
  }
  float ao = weights > 0.0001 ? sum / weights : 0.0;
  gl_FragColor = vec4(beauty.rgb * (1.0 - 0.26 * ao), beauty.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

/** Optional depth-derived contact shading. Owns only targets/fullscreen resources. */
export class ScenePresentation {
  private readonly beauty: THREE.WebGLRenderTarget;
  private readonly ao: THREE.WebGLRenderTarget;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly geometry = new THREE.BufferGeometry();
  private readonly quad: THREE.Mesh;
  private readonly aoMaterial: THREE.ShaderMaterial;
  private readonly composite: THREE.ShaderMaterial;
  private readonly inverseProjection = new THREE.Matrix4();
  private readonly projection = new THREE.Matrix4();
  private readonly viewport = new THREE.Vector4();
  private readonly scissor = new THREE.Vector4();
  private width = 0;
  private height = 0;
  readonly supported: boolean;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.supported =
      renderer.extensions.has('EXT_color_buffer_float') &&
      !renderer.capabilities.logarithmicDepthBuffer &&
      !renderer.capabilities.reversedDepthBuffer;
    this.beauty = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      samples: Math.min(4, renderer.capabilities.maxSamples),
      depthBuffer: true,
      resolveDepthBuffer: true,
      stencilBuffer: false,
    });
    this.beauty.texture.name = 'scene presentation beauty';
    this.beauty.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.beauty.depthTexture = new THREE.DepthTexture(
      1,
      1,
      THREE.UnsignedIntType,
    );
    this.ao = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    this.ao.texture.name = 'half resolution contact shading';
    const common = {
      tDepth: { value: this.beauty.depthTexture },
      depthTexel: { value: new THREE.Vector2(1, 1) },
      inverseProjection: { value: this.inverseProjection },
    };
    this.aoMaterial = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: aoFragment,
      uniforms: {
        ...common,
        projection: { value: this.projection },
        texel: { value: new THREE.Vector2(1, 1) },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.composite = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: compositeFragment,
      uniforms: {
        ...common,
        tBeauty: { value: this.beauty.texture },
        tAO: { value: this.ao.texture },
        aoTexel: { value: new THREE.Vector2(1, 1) },
      },
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
    });
    this.geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    );
    this.quad = new THREE.Mesh(this.geometry, this.aoMaterial);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  /** Dimensions are physical drawing-buffer pixels, independent of CSS/DPR. */
  resize(width: number, height: number) {
    width = Math.max(1, Math.floor(width));
    height = Math.max(1, Math.floor(height));
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    const aw = Math.max(1, Math.ceil(width / 2)),
      ah = Math.max(1, Math.ceil(height / 2));
    this.beauty.setSize(width, height);
    this.ao.setSize(aw, ah);
    this.aoMaterial.uniforms.texel.value.set(1 / width, 1 / height);
    this.aoMaterial.uniforms.depthTexel.value.set(1 / width, 1 / height);
    this.composite.uniforms.aoTexel.value.set(1 / aw, 1 / ah);
  }

  render(scene: THREE.Scene, camera: THREE.Camera, quality: Quality) {
    const r = this.renderer;
    if (quality === 'eco' || !this.supported || r.getRenderTarget() !== null) {
      r.render(scene, camera);
      return;
    }
    if (!this.width) {
      const size = r.getDrawingBufferSize(new THREE.Vector2());
      this.resize(size.x, size.y);
    }
    const target = r.getRenderTarget(),
      autoClear = r.autoClear,
      autoReset = r.info.autoReset,
      scissorTest = r.getScissorTest();
    r.getViewport(this.viewport);
    r.getScissor(this.scissor);
    if (autoReset) r.info.reset();
    r.info.autoReset = false;
    r.autoClear = true;
    r.setScissorTest(false);
    this.projection.copy(camera.projectionMatrix);
    this.inverseProjection.copy(camera.projectionMatrixInverse);
    try {
      // The beauty pass uses real materials, so leaf alpha tests and Reflector
      // recursion contribute the same coverage/depth as the ordinary scene.
      r.setRenderTarget(this.beauty);
      r.render(scene, camera);
      this.quad.material = this.aoMaterial;
      r.setRenderTarget(this.ao);
      r.render(this.scene, this.camera);
      this.quad.material = this.composite;
      r.setRenderTarget(target);
      r.setViewport(this.viewport);
      r.render(this.scene, this.camera);
    } finally {
      r.setRenderTarget(target);
      r.setViewport(this.viewport);
      r.setScissor(this.scissor);
      r.setScissorTest(scissorTest);
      r.autoClear = autoClear;
      r.info.autoReset = autoReset;
    }
  }

  dispose() {
    this.beauty.dispose();
    this.ao.dispose();
    this.geometry.dispose();
    this.aoMaterial.dispose();
    this.composite.dispose();
    this.scene.clear();
  }
}
