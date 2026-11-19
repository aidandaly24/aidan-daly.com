// Fine surface detail stays attached to the solid furniture. A derivative
// filter fades the weave and page lines once they are smaller than a pixel.
import { TextureLoader } from './vendor/package/build/three.module.js';

let samples;
export function loadSurfaceSamples(onLoad) {
  samples ??= new TextureLoader().load(new URL('./props/set-material-samples.png',import.meta.url).href, onLoad);
  return samples;
}

const surfaceNoise = `
varying vec3 vSetSurface;
uniform sampler2D setMaterialSamples;
float sampledGrain(vec3 p, float tile, vec2 repeatSize) {
  vec3 face = abs(normalize(cross(dFdx(p),dFdy(p))));
  vec2 uv = (face.z > max(face.x,face.y) ? p.xy : face.x > face.y ? p.zy : p.xz) / repeatSize;
  vec2 size = vec2(.246, .976);
  return textureGrad(setMaterialSamples, vec2(tile*.25+.002,.012) + fract(uv)*size,
                     dFdx(uv)*size, dFdy(uv)*size).r - .502;
}
float setHash(vec3 p) {
  p = fract(p * .1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float setNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(
    mix(mix(setHash(i), setHash(i+vec3(1,0,0)), f.x),
        mix(setHash(i+vec3(0,1,0)), setHash(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(setHash(i+vec3(0,0,1)), setHash(i+vec3(1,0,1)), f.x),
        mix(setHash(i+vec3(0,1,1)), setHash(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float setFineWave(float phase) {
  return cos(phase) * (1.0 - smoothstep(.8, 3.14, fwidth(phase)));
}
`;

const treatments = {
  timber: `
    vec3 p = vSetSurface;
    float drift = setNoise(p * .026) * 1.3 + setNoise(p * .009) * 4.0;
    float grain = setFineWave(p.y * .59 + p.z * .20 + drift);
    float pore = setNoise(p * vec3(.024,.63,.32));
    diffuseColor.rgb *= 1.0 + .038 * grain + .115 * (pore - .5) + .52 * sampledGrain(p,2.0,vec2(92.,32.));
  `,
  paper: `
    vec3 p = vSetSurface;
    vec3 face = normalize(cross(dFdx(p), dFdy(p)));
    float edge = 1.0 - smoothstep(.25, .8, abs(face.y));
    float line = setFineWave(p.y*3.4 + setNoise(p*.013)*2.2);
    float sections = setNoise(vec3(p.y*.21,p.x*.008,p.z*.008));
    diffuseColor.rgb *= 1.0 + edge * (.042 * line + .13 * (sections-.5) + .56 * sampledGrain(p,1.0,vec2(130.,55.)));
  `,
  weave: `
    vec3 p = vSetSurface;
    float warp = setFineWave((p.y + .14*p.z) * 4.1);
    float weft = setFineWave((p.x + .37*p.z) * 3.5);
    float nap = setNoise(p * .40) - .5;
    diffuseColor.rgb *= 1.0 + .025 * warp + .020 * weft + .10 * nap + .64 * sampledGrain(p,0.0,vec2(32.,52.));
  `,
  vellum: `
    diffuseColor.rgb *= 1.0 + .58 * sampledGrain(vSetSurface,3.0,vec2(96.,68.));
  `,
  moss: `
    float leaves = setNoise(vSetSurface * .30) - .5;
    float shade = setNoise(vSetSurface * .060) - .5;
    diffuseColor.rgb *= 1.0 + .24 * leaves + .12 * shade;
  `,
};

export function finishMaterial(material, treatment) {
  if (!material || !treatments[treatment] || material.userData.setFinish || material.map) return;
  material.userData.setFinish = treatment;
  const oldCompile = material.onBeforeCompile;
  const oldKey = material.customProgramCacheKey();
  material.onBeforeCompile = function(shader, renderer) {
    oldCompile.call(this, shader, renderer);
    shader.uniforms.setMaterialSamples = {value:samples};
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSetSurface;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 setPoint = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          setPoint = instanceMatrix * setPoint;
        #endif
        vSetSurface = (modelMatrix * setPoint).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + surfaceNoise)
      .replace('#include <color_fragment>', '#include <color_fragment>\n{' + treatments[treatment] + '}');
  };
  material.customProgramCacheKey = () => oldKey + '/set-' + treatment;
  material.needsUpdate = true;
}
