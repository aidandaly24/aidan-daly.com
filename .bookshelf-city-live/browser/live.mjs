import { PCFShadowMap, WebGLRenderer } from './vendor/package/build/three.module.js';
import { batchScenery } from './set/batch.mjs';
import { createSoftLighting, softenSetShadows } from './soft-light.mjs';
import { buildDiorama } from './set/finished.mjs';
import { loadSurfaceSamples } from './surface-finish.mjs';
import { castActorShadow, lightSet, studioEnvironment } from './studio.mjs';
import { frameCity } from './framing.mjs';
import { City, dt } from './city.mjs';
import { createView } from './scene.mjs';
import { modelURL } from './vendor/actor.mjs';
import { lightActor } from './actor-lighting.mjs';

const figure = document.querySelector('figure');
const canvas = figure.querySelector('canvas');
const narrow = matchMedia('(max-aspect-ratio: 23/25)');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const seed = crypto.getRandomValues(new Uint32Array(1))[0];
const city = new City(seed, Number(narrow.matches), false);
// A still first frame should also show the two station actions.
for (const actor of city.a) {
  actor.work = .4;
  actor.age = actor.dwell * actor.work;
}
const views = new Map();
const heading = document.getElementById('coming-soon');
const masthead = document.querySelector('.masthead');
const footer = document.querySelector('.world footer');
let view;
let frame = 0;
let previousTime = null;
let remainder = 0;
let renderer;
let actors;
let environment;
let softLighting;

async function loadActor() {
  const [{GLTFLoader}, {MeshoptDecoder}, {clone}, {bindAidan}] = await Promise.all([
    import('./addons/loaders/GLTFLoader.js'),
    import('./addons/libs/meshopt_decoder.module.js'),
    import('./addons/utils/SkeletonUtils.js'),
    import('./native-rig.mjs'),
  ]);
  const {scene} = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(modelURL);
  lightActor(scene);
  actors = [bindAidan(clone(scene), 218), bindAidan(clone(scene), 218)];
  actors.forEach(castActorShadow);
  view.setActors(actors);
  canvas.dataset.character = 'aidan';
  render();
  figure.dataset.ready = 'true';
  updatePlayback();
}

function render() {
  view.sync(city);
  softLighting.render(view.scene, view.cam);
}
function advance(time) {
  // Low frame rates still run on wall time. A long foreground stall catches
  // up at most one second of simulation; resuming a hidden tab resets the clock.
  if (previousTime !== null) remainder += Math.min((time - previousTime) / 1000, 1);
  previousTime = time;
  while (remainder >= dt) {
    city.tick();
    remainder -= dt;
  }
  render();
  frame = requestAnimationFrame(advance);
}
function updatePlayback() {
  cancelAnimationFrame(frame);
  previousTime = null;
  if (renderer && (!modelURL || actors) && !renderer.getContext().isContextLost() && !document.hidden && !reduced.matches) {
    frame = requestAnimationFrame(advance);
  }
}
function resize() {
  const layout = Number(narrow.matches);
  city.setLayout(layout);
  if (!views.has(layout)) {
    const created = createView(layout, () => { if (view) render(); });
    const set = buildDiorama(layout, () => { if (view) render(); });
    created.setEnvironment(set);
    lightSet(created, environment, layout === 1);
    softenSetShadows(created,layout === 1);
    batchScenery(set);
    views.set(layout, created);
  }
  const next = views.get(layout);
  if (next !== view) {
    view = next;
    if (actors) view.setActors(actors);
    else if (modelURL) view.figs.forEach(figure => { figure.base.visible = false; });
  }
  const { top, width, height } = figure.getBoundingClientRect();
  frameCity(view.cam, layout, width, height,
    heading.getBoundingClientRect().bottom - top, footer.getBoundingClientRect().top - top,
    masthead.getBoundingClientRect().bottom - top);
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
  renderer.setSize(Math.ceil(width), Math.ceil(height), false);
  render();
}
try {
  renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
} catch (error) {
  console.warn('Bookshelf City could not start WebGL.', error);
}
if (renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  softLighting = createSoftLighting(renderer);
  environment = studioEnvironment();
  loadSurfaceSamples(() => { if (view) render(); });
  renderer.setClearColor(0, 0);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    delete figure.dataset.ready;
    updatePlayback();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    resize();
    if (actors) figure.dataset.ready = 'true';
    updatePlayback();
  });
  document.addEventListener('visibilitychange', updatePlayback);
  reduced.addEventListener('change', updatePlayback);
  narrow.addEventListener('change', resize);
  const observer = new ResizeObserver(resize);
  for (const element of [figure, heading, masthead, footer]) observer.observe(element);
  resize();
  canvas.dataset.character = modelURL ? 'loading' : 'mechanics';
  if (modelURL) loadActor().catch(error => {
    canvas.dataset.character = 'error';
    console.error('Bookshelf City could not load Aidan.', error);
  });
  updatePlayback();
}
