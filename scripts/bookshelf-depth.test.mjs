import assert from 'node:assert/strict';
import test from 'node:test';
import {Raycaster, Vector3} from '../.bookshelf-city-live/browser/vendor/package/build/three.module.js';
import {buildDiorama} from '../.bookshelf-city-live/browser/set/finished.mjs';

import {City} from '../.bookshelf-city-live/browser/city.mjs';
import {createView} from '../.bookshelf-city-live/browser/scene.mjs';

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

  test(label + ' builder folds one leg at a time and supports the roof while moving it', () => {
    const view=createView(layout);
    view.setEnvironment(buildDiorama(layout));
    const city=new City(9,layout);
    const builder=city.a[1];
    const figure=view.figs[1];
    let previous, rest, lift=0;
    for(let step=0;step<=120;step++) {
      builder.work=step/120;
      view.sync(city);
      const soles=figure.legs.map(leg=>leg.sole.clone());
      if(previous) {
        const travel=soles.map((sole,i)=>sole.distanceTo(previous[i]));
        assert(Math.min(...travel)<.001,'Both shoes slid at once.');
      }
      previous=soles;
      if(step===0) rest=view.roof.position.y;
      lift=Math.max(lift,view.roof.position.y-rest);
      if(builder.work>=.22 && builder.work<=.82) {
        view.roofGrips.forEach((grip,i)=>{
          const surface=view.roof.localToWorld(grip.clone());
          assert(surface.distanceTo(figure.arms[i].p.position)<.001);
        });
      }
    }
    assert(lift>6);
    assert(Math.abs(view.roof.position.y-rest)<.001);
  });
}
