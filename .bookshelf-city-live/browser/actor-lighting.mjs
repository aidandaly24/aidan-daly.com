import { Color, ShaderChunk } from './vendor/package/build/three.module.js';

const studioMaterials = /^(?:Aidan (?:v11 bounded upper-fold skin|skin - spatially varied|corrected seated finger nails)|Warm sclera |GarmentV11 \| (?:WarmWhite_FineCotton|Folded_Cotton_Hem)|Cotton_TwinNeedleThread)/;
const key = new Color(0xffe4ce).multiplyScalar(5.2).toArray().join(', ');

// The view has one directional slot. Reuse it in these shaders so the
// character and the props retain their shared depth test in a single pass.
const studioLights = ShaderChunk.lights_fragment_begin
  .replace('getDirectionalLightInfo( directionalLight, directLight );', `
      directLight.color = vec3(${key});
      directLight.direction = normalize(mat3(viewMatrix) * vec3(0.22, 0.68, 0.71));
      directLight.visible = true;
  `)
  .replace('getAmbientLightIrradiance( ambientLightColor )',
    'getAmbientLightIrradiance( vec3(0.32) )');

const studioView = ShaderChunk.tonemapping_pars_fragment
  .replace('uniform float toneMappingExposure;', 'const float toneMappingExposure = 2.0;');

function compileStudio(shader) {
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\n' + studioView)
    .replace('#include <lights_fragment_begin>', studioLights)
    .replace('#include <tonemapping_fragment>', 'gl_FragColor.rgb = AgXToneMapping(gl_FragColor.rgb);');
}

// Keep the GLB's linear complexion and cotton inputs and calibrate the
// incident light and display transform ahead of the browser's sRGB output.
export function lightActor(model) {
  model.traverse(object => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (/^Aidan hair[ |]/.test(material.name) && !material.userData.setHair) {
        // Preserve the native fiber color differences in the room's warmer fill.
        material.color.r *= 1.83;
        material.color.g *= 1.32;
        material.color.b *= 1.04;
        material.userData.setHair = true;
      }
      if (!material.isMeshStandardMaterial || !studioMaterials.test(material.name)) continue;
      material.toneMapped = false;
      material.onBeforeCompile = compileStudio;
    }
  });
}
