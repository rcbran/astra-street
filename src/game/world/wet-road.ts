import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import type { Track } from '../tracks';
import { ribbon } from './geometry';
/** A small planar reflection buffer. Ripple distortion and Fresnel keep it from reading as a mirror. */
export function createWetRoad(track: Track, normal: THREE.Texture) {
  const half = track.circuit.width / 2 - 0.18;
  const geometry = ribbon(track, -half, half, -0.04);
  geometry.rotateX(Math.PI / 2);
  const reflector = new Reflector(geometry, {
    textureWidth: 640,
    textureHeight: 360,
    multisample: 0,
    clipBias: 0.004,
    color: 0xffffff,
  });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.y = 0.077;
  const material = reflector.material as THREE.ShaderMaterial;
  material.transparent = true;
  material.depthWrite = false;
  material.uniforms.roadNormal = { value: normal };
  material.uniforms.time = { value: 0 };
  material.vertexShader = `
 uniform mat4 textureMatrix; varying vec4 reflectionUv; varying vec2 roadUv; varying vec3 viewDirection;
 void main(){vec4 world=modelMatrix*vec4(position,1.);reflectionUv=textureMatrix*vec4(position,1.);roadUv=uv;viewDirection=cameraPosition-world.xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  material.fragmentShader = `
 uniform sampler2D tDiffuse;uniform sampler2D roadNormal;uniform float time;
 varying vec4 reflectionUv;varying vec2 roadUv;varying vec3 viewDirection;
 void main(){vec2 projected=reflectionUv.xy/reflectionUv.w;vec2 n=texture2D(roadNormal,roadUv*.65).rg-.5;vec2 ripple=vec2(sin(roadUv.y*24.+time*1.7),cos(roadUv.x*27.+time))*0.00035;
 vec2 sampleUv=projected+n*.013+ripple;
 vec3 reflection=texture2D(tDiffuse,sampleUv).rgb*.4;
 reflection+=texture2D(tDiffuse,sampleUv+vec2(.0015,.003)).rgb*.15;
 reflection+=texture2D(tDiffuse,sampleUv-vec2(.0015,.003)).rgb*.15;
 reflection+=texture2D(tDiffuse,sampleUv+vec2(.003,0.)).rgb*.15;
 reflection+=texture2D(tDiffuse,sampleUv-vec2(.003,0.)).rgb*.15;
 float fresnel=pow(1.-abs(normalize(viewDirection).y),3.);
 float puddle=.75+.25*sin(roadUv.x*3.+sin(roadUv.y*.4));
 gl_FragColor=vec4(reflection,clamp((.08+fresnel*.5)*puddle,.06,.58));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
  return {
    mesh: reflector,
    update: (time: number) => {
      material.uniforms.time.value = time;
    },
    dispose: () => {
      reflector.dispose();
      geometry.dispose();
    },
  };
}
