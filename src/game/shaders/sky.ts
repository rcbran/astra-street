export const skyVertex = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const skyFragment = /* glsl */ `
  varying vec3 vWorld;
  uniform vec3 top, horizon, sunDir, sunColor;
  uniform float sunStrength, cloud;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 cell = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(cell), hash(cell + vec2(1, 0)), f.x),
               mix(hash(cell + vec2(0, 1)), hash(cell + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    vec3 direction = normalize(vWorld - cameraPosition);
    float height = max(direction.y, 0.0);
    vec3 color = mix(horizon, top, pow(height, 0.45));
    float sun = max(dot(direction, sunDir), 0.0);
    color += sunColor * (pow(sun, 1600.0) * 7.0 + pow(sun, 14.0) * 0.23) * sunStrength;
    vec2 uv = direction.xz / max(direction.y, 0.07) * 2.0;
    float clouds = noise(uv * 0.8) * 0.6 + noise(uv * 2.0) * 0.28 + noise(uv * 4.0) * 0.12;
    float mask = smoothstep(0.52, 0.78, clouds) * smoothstep(0.015, 0.18, height)
               * (1.0 - smoothstep(0.65, 1.0, height));
    color = mix(color, horizon * 1.12, mask * cloud * 2.0);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
