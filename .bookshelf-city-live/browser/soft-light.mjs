import {
  BasicShadowMap, BufferGeometry, DepthTexture, Float32BufferAttribute, Mesh,
  NearestFilter, NoBlending, OrthographicCamera, Scene, ShaderChunk, ShaderMaterial,
  UnsignedIntType, Vector2, WebGLRenderTarget,
} from './vendor/package/build/three.module.js';

// Precomputed disc positions avoid evaluating trig for every tap.
function disc(total, phase) {
  return Array.from({length: total}, (_, i) => {
    const a = i * 2.39996323 + phase, r = Math.sqrt((i + .5) / total);
    return 'vec2(' + (r*Math.cos(a)).toFixed(6) + ',' + (r*Math.sin(a)).toFixed(6) + ')';
  }).join(', ');
}

function softShadowChunk(compact) {
  const probes = compact ? 7 : 11, taps = compact ? 12 : 20;
  const replacement = `
  const vec2 areaProbes[${probes}] = vec2[](${disc(probes, .77)});
  const vec2 areaSamples[${taps}] = vec2[](${disc(taps, 0)});
  float getShadow(sampler2D shadowMap, vec2 mapSize, float intensity, float bias, float penumbra, vec4 projected) {
    vec3 coord = projected.xyz / projected.w;
    #ifdef USE_REVERSED_DEPTH_BUFFER
      coord.z = 1.0 - coord.z;
    #endif
    coord.z += bias;
    vec2 dx = dFdx(coord.xy), dy = dFdy(coord.xy);
    float det = dx.x*dy.y - dx.y*dy.x;
    vec2 dz = vec2(dFdx(coord.z), dFdy(coord.z));
    vec2 slope = abs(det) < 1.e-12 ? vec2(0.0) :
      clamp(vec2(dy.y*dz.x - dx.y*dz.y, dx.x*dz.y - dy.x*dz.x)/det, vec2(-2.0), vec2(2.0));
    if (any(lessThan(coord,vec3(0.0))) || any(greaterThan(coord,vec3(1.0)))) return 1.0;
    vec2 texel = 1.0 / mapSize;
    float search = .0135 * mapSize.x;
    float sum = 0.0, count = 0.0;
    for(int i=0;i<${probes};i++){
      vec2 delta = areaProbes[i] * texel * search;
      float depth = texture2D(shadowMap, coord.xy + delta).r;
      #ifdef USE_REVERSED_DEPTH_BUFFER
        depth = 1.0-depth;
      #endif
      float distance = coord.z + dot(slope,delta) - depth;
      if(distance > .00016){ sum += distance; count += 1.0; }
    }
    // A narrow caster can sit between blocker probes. Retain a small
    // near-field filter in that case, rather than dropping the shadow.
    float radius = clamp(penumbra * sum/max(1.0,count), .85, .0165*mapSize.x);
    float visibility = 0.0;
    for(int i=0;i<${taps};i++){
      vec2 delta = texel * radius * areaSamples[i];
      float depth = texture2D(shadowMap, coord.xy + delta).r;
      #ifdef USE_REVERSED_DEPTH_BUFFER
        depth = 1.0-depth;
      #endif
      visibility += smoothstep(-.00013,.00006,depth - coord.z - dot(slope,delta));
    }
    return mix(1.0, visibility / float(${taps}), intensity);
  }`;
  const chunk = ShaderChunk.shadowmap_pars_fragment;
  const start = chunk.indexOf('#else\n\t\tfloat getShadow( sampler2D shadowMap');
  const end = chunk.indexOf('\n\t#endif\n\t#if NUM_SUN_LIGHT_SHADOWS',start);
  if (start<0 || end<0) throw Error('Unsupported shadow shader in the bundled Three.js renderer.');
  return chunk.slice(0,start) + '#else\n' + replacement + chunk.slice(end);
}

export function softenSetShadows(view, compact) {
  const key = view.scene.children.find(o=>o.isDirectionalLight && o.castShadow);
  if(!key) return;
  const shadow = key.shadow, camera = shadow.camera;
  shadow.radius = .26 * (camera.far-camera.near)*shadow.mapSize.x / (camera.right-camera.left);
  shadow.intensity = .73;
  const chunk = softShadowChunk(compact);
  const seen = new Set();
  view.scene.traverse(o=>{
    if(!o.isMesh || !o.receiveShadow) return;
    for(const m of Array.isArray(o.material) ? o.material : [o.material]){
      if(seen.has(m) || m.userData.areaShadow) continue;
      seen.add(m);
      m.userData.areaShadow = true;
      const compile = m.onBeforeCompile, cache = m.customProgramCacheKey();
      m.onBeforeCompile = function(shader,renderer){
        compile.call(this,shader,renderer);
        shader.fragmentShader = shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',chunk);
      };
      m.customProgramCacheKey = () => cache + '/area-shadow-' + Number(compact);
      m.needsUpdate = true;
    }
  });
}

// Screen-space ambient visibility uses the shaded frame's *actual* depth,
// including animated joints, desk legs, leaf clusters, book spines and props.
// Neighbourhoods use scene units, so rotating or resizing keeps their scale.
export function createSoftLighting(renderer) {
  renderer.shadowMap.type = BasicShadowMap;
  const depth = new DepthTexture(1,1,UnsignedIntType);
  depth.minFilter = depth.magFilter = NearestFilter;
  const shaded = new WebGLRenderTarget(1,1,{depthTexture:depth,samples:2});
  const bufferSize = new Vector2();
  const material = new ShaderMaterial({
    uniforms: {
      colorFrame:{value:shaded.texture},depthFrame:{value:depth},pixel:{value:new Vector2()},
      viewExtent:{value:new Vector2()},depthRange:{value:1},
    },
    depthTest:false,depthWrite:false,blending:NoBlending,
    vertexShader:`varying vec2 imageUV;
      void main(){imageUV=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`
      uniform sampler2D colorFrame,depthFrame;
      uniform vec2 pixel,viewExtent;
      uniform float depthRange;
      varying vec2 imageUV;
      float heightAt(vec2 uv){return -texture2D(depthFrame,uv).r*depthRange;}
      void main(){
        vec4 base=texture2D(colorFrame,imageUV);
        float z=heightAt(imageUV);
        float ao=0.0;
        if(base.a>.01 && z>-.99999*depthRange){
          float l=z-heightAt(imageUV-vec2(pixel.x,0.)),r=heightAt(imageUV+vec2(pixel.x,0.))-z;
          float d=z-heightAt(imageUV-vec2(0.,pixel.y)),u=heightAt(imageUV+vec2(0.,pixel.y))-z;
          vec3 n=normalize(vec3(-(abs(l)<abs(r)?l:r)/(pixel.x*viewExtent.x),
                                -(abs(d)<abs(u)?d:u)/(pixel.y*viewExtent.y),1.));
          const vec2 directions[8]=vec2[](${disc(8,.25)});
          for(int i=0;i<8;i++){
            vec2 direction=normalize(directions[i]);
            float horizon=0.0;
            for(int j=0;j<2;j++){
              vec2 offset=direction*(j==0?6.5:23.5);
              vec2 uv=imageUV+offset/viewExtent;
              if(any(lessThan(uv,vec2(0))) || any(greaterThan(uv,vec2(1)))) continue;
              vec3 v=vec3(offset,heightAt(uv)-z);
              float dist=length(v);
              float blocked=max(0.0,dot(n,v)/dist-.09) * (1.-smoothstep(10.,65.,dist));
              horizon=max(horizon,blocked);
            }
            ao+=horizon;
          }
        }
        // Keep warm bounced light in contact shadows; only a fraction of
        // irradiance is indirect. Premultiplied coverage is preserved.
        base.rgb *= 1.0 - vec3(.59,.67,.73)*(ao/8.0);
        if(base.a>0.0) base.rgb /= base.a;
        gl_FragColor=base;
        #include <colorspace_fragment>
        gl_FragColor.rgb *= gl_FragColor.a;
      }`,
  });
  const tri = new BufferGeometry();
  tri.setAttribute('position',new Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  const pass=new Scene();
  const triangle=new Mesh(tri,material);
  triangle.frustumCulled=false;pass.add(triangle);
  const passCamera=new OrthographicCamera();
  return {
    render(scene,camera){
      renderer.getDrawingBufferSize(bufferSize);
      if(shaded.width!==bufferSize.x || shaded.height!==bufferSize.y) {
        shaded.setSize(bufferSize.x,bufferSize.y);
        material.uniforms.pixel.value.set(1/bufferSize.x,1/bufferSize.y);
      }
      material.uniforms.viewExtent.value.set((camera.right-camera.left)/camera.zoom,(camera.top-camera.bottom)/camera.zoom);
      material.uniforms.depthRange.value=camera.far-camera.near;
      const target=renderer.getRenderTarget();
      renderer.setRenderTarget(shaded);
      renderer.render(scene,camera);
      renderer.setRenderTarget(target);
      renderer.render(pass,passCamera);
    },
    dispose(){shaded.dispose();tri.dispose();material.dispose();},
  };
}
