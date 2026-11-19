import {
  DataTexture, DataUtils, EquirectangularReflectionMapping, HalfFloatType,
  LinearFilter, LinearSRGBColorSpace, RGBAFormat, Vector3,
} from './vendor/package/build/three.module.js';

// An overcast room and a broad window give brass a visible reflection and
// soften the fill beneath the chair. Shared by both registered cameras.
export function studioEnvironment() {
  const width = 128, height = 64;
  const pixels = new Uint16Array(width * height * 4);
  const windowAxis = new Vector3(-.55, .65, .52).normalize();
  const direction = new Vector3();
  for (let y = 0; y < height; y++) {
    const elevation = ((y + .5) / height - .5) * Math.PI;
    for (let x = 0; x < width; x++) {
      const azimuth = ((x + .5) / width - .5) * 2 * Math.PI;
      direction.set(Math.cos(elevation) * Math.cos(azimuth), Math.sin(elevation), Math.cos(elevation) * Math.sin(azimuth));
      const sky = .26 + .39 * (direction.y + 1);
      const window = 3.4 * Math.pow(Math.max(0, direction.dot(windowAxis)), 18);
      const floor = Math.max(0, -direction.y) * .16;
      const offset = 4 * (x + y * width);
      pixels[offset] = DataUtils.toHalfFloat(sky + window + floor);
      pixels[offset + 1] = DataUtils.toHalfFloat(.94 * sky + .98 * window + .65 * floor);
      pixels[offset + 2] = DataUtils.toHalfFloat(.86 * sky + .94 * window + .4 * floor);
      pixels[offset + 3] = DataUtils.toHalfFloat(1);
    }
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat, HalfFloatType);
  texture.mapping = EquirectangularReflectionMapping;
  texture.colorSpace = LinearSRGBColorSpace;
  texture.magFilter = texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function lightSet(view, environment, portrait) {
  const {scene, w, h} = view;
  scene.environment = environment;
  scene.environmentIntensity = .42;
  const key = scene.children.find(child => child.isDirectionalLight);
  const fill = scene.children.find(child => child.isAmbientLight);
  if (fill) {
    fill.intensity = .82;
    fill.color.set(0xfff8ef);
  }
  const tilt = portrait ? .064 : .080;
  const distance = 3100;
  view.cam.position.set(0, distance * Math.sin(tilt), distance * Math.cos(tilt));
  view.cam.near = 5;
  view.cam.far = 9000;
  view.cam.lookAt(0,0,0);
  view.cam.updateMatrixWorld();
  view.cam.updateProjectionMatrix();
  if (!key) return;
  const target = key.target;
  target.position.set(w * .50, h * .31, 0);
  scene.add(target);
  key.position.copy(target.position).add(new Vector3(-570, 1040, 820));
  key.intensity = 1.38;
  key.color.set(0xfff7ed);
  key.castShadow = true;
  key.shadow.intensity = .61;
  key.shadow.mapSize.setScalar(portrait ? 1024 : 2048);
  const span = Math.max(w * .64, h * .58);
  Object.assign(key.shadow.camera, {left:-span, right:span, top:span, bottom:-span, near:20, far:3400});
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias = .9;
  key.shadow.bias = -.00015;
  key.shadow.radius = 2.0;
}

export function castActorShadow(actor) {
  actor.body.traverse(part => {
    if (part.isMesh) {
      part.castShadow = true;
      // Thin overlapping facial and hair surfaces use their authored shading.
      part.receiveShadow = false;
    }
  });
}
