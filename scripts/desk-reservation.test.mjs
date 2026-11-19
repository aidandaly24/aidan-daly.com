import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {City, dt} from '../.bookshelf-city-live/browser/city.mjs';
import {createView} from '../.bookshelf-city-live/browser/scene.mjs';
import {createBookshelfSet} from '../.bookshelf-city-live/browser/set/index.mjs';
import {registerSetDepth} from '../.bookshelf-city-live/browser/contact-support.mjs';
import {bindAidan} from '../.bookshelf-city-live/browser/native-rig.mjs';
import {GLTFLoader} from '../.bookshelf-city-live/browser/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from '../.bookshelf-city-live/browser/addons/libs/meshopt_decoder.module.js';
import {clone} from '../.bookshelf-city-live/browser/addons/utils/SkeletonUtils.js';
import {Vector3} from '../.bookshelf-city-live/browser/vendor/package/build/three.module.js';

const bytes=await readFile(new URL('../.bookshelf-city-live/actor/aidan.glb',import.meta.url));
const {scene:model}=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(
  bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const position=o=>o.getWorldPosition(new Vector3());

for(const layout of [0,1]) {
  test('keep working through a reserved passage and leave the seat when clear in layout '+layout,()=>{
    const city=new City(8,layout);
    for(const a of city.a) {a.work=.4;a.age=.4*a.dwell;}
    const view=createView(layout);
    const set=createBookshelfSet(layout);
    registerSetDepth(set,layout);view.setEnvironment(set);
    const rigs=city.a.map(()=>bindAidan(clone(model),218));
    view.setActors(rigs);
    const fingers=rigs.map(rig=>{
      const all=[];
      rig.body.traverse(o=>{if(o.isBone && /^(index|middle|ring)_01\.[LR]$/.test(o.userData.name??o.name))all.push(o);});
      assert.equal(all.length,6);
      return all;
    });
    let subject=null, first, last, snapshots=0, maxPalmTravel=0, maxFingerBend=0, goal, rise;
    for(let n=0;n<60*320;n++) {
      city.tick();
      if(!subject) subject=city.a.find(a=>a.job==='type'&&a.kind==='work'&&
        a.goal===null&&city.queue.includes(a.i)&&a.age-.70*a.dwell>6);
      if(!subject) continue;
      const a=subject;
      if(a.goal===null) {
        assert.equal(a.kind,'work');assert.equal(a.work,.70);assert.equal(city.lock.desk,a.i);
        if(n%6) continue;
        view.sync(city);
        const rig=rigs[a.i],p=position(rig.palms[0]);
        const frame={p,digits:fingers[a.i].map(o=>o.quaternion.clone()),pelvis:position(rig.body.getObjectByName('hips'))};
        if(!first) first=frame;
        assert(first.pelvis.distanceTo(frame.pelvis)<3,'stood up while the route was unavailable');
        if(last) {
          maxPalmTravel=Math.max(maxPalmTravel,p.distanceTo(first.p));
          for(let i=0;i<6;i++)maxFingerBend=Math.max(maxFingerBend,frame.digits[i].angleTo(last.digits[i]));
        }
        snapshots++;last=frame;
      } else if(a.kind==='work') {
        assert.equal(city.lock.desk,a.i);assert.equal(city.lock[a.goal],a.i);
        assert(a.paths.every(path=>path[0]==='desk'&&path.at(-1)===a.goal));
        goal=a.goal;rise=a.riseAt;
      } else {
        assert.equal(a.kind,'travel');assert.equal(a.goal,goal);assert.equal(city.lock[goal],a.i);
        assert.notEqual(city.lock.desk,a.i);
        assert(Math.abs(city.clock-rise-1.65)<=dt+.001,'chair exit did not lead directly to the reserved trip');
        break;
      }
    }
    assert(subject&&goal&&rise);
    assert(snapshots>=20,'expected a sustained reservation wait');
    assert(maxPalmTravel>2&&maxFingerBend>.07,'actual seated rig stopped typing');
  });
}

test('a destination and both possible routes stay reserved during a turning phone’s chair exit',()=>{
  const city=new City(8);
  let a;
  for(let n=0;n<60*200&&!a;n++){city.tick();a=city.a.find(x=>x.riseAt!=null);}
  assert(a);
  const goal=a.goal,paths=structuredClone(a.paths),owners={...city.lock};
  city.setLayout(1);
  assert.deepEqual(city.lock,owners);assert.deepEqual(a.paths,paths);assert.deepEqual(a.p,city.point('desk'));
  while(a.kind==='work')city.tick();
  assert.equal(a.kind,'travel');assert.equal(a.goal,goal);
  assert.deepEqual(a.route,paths[1].slice(1));
});
