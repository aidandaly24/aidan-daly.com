import assert from 'node:assert/strict';
import test from 'node:test';
import {Raycaster, Vector3} from '../.bookshelf-city-live/browser/vendor/package/build/three.module.js';
import {buildDiorama} from '../.bookshelf-city-live/browser/set/finished.mjs';

for (const [layout, label] of ['desktop','portrait'].entries()) {
  test(label + ' has six exposed rungs, five casters and three wooden stool legs', () => {
    const set = buildDiorama(layout);
    const legs = set.getObjectsByProperty('name','Splayed stool leg');
    assert.equal(legs.length,3);
    assert(legs.every(leg => leg.material.name === 'maple' && leg.material.metalness === 0));
    assert.equal(set.getObjectsByProperty('name','Chair caster wheel').length,5);
    const rungs = set.getObjectsByProperty('name','Maple ladder rung');
    assert.equal(rungs.length,6);
    const tilt = layout ? .064 : .080;
    const outward = new Vector3(0,Math.sin(tilt),Math.cos(tilt));
    const ray = new Raycaster();
    const solids=[];
    set.traverseVisible(o=>{if(o.isMesh)solids.push(o);});
    for (const [i,rung] of rungs.entries()) {
      const point = rung.getWorldPosition(new Vector3());
      ray.set(point.addScaledVector(outward,4500),outward.clone().negate());
      const first = ray.intersectObjects(solids,false)[0]?.object;
      assert.equal(first?.name,'Maple ladder rung','Rung '+(i+1)+' is covered by '+first?.name);
    }
  });
}
