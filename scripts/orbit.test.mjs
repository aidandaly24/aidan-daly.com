import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createOrbitRenderer} from '../public/orbit.js';
const data = JSON.parse(await readFile('public/assets/orbit-glyphs.json', 'utf8'));
const makeContext = () => ({paths:[], current:[], beginPath(){this.current=[];},moveTo(x,y){this.current.push([x,y]);},lineTo(x,y){this.current.push([x,y]);},closePath(){},fill(){this.paths.push({points:this.current,alpha:this.globalAlpha});}});
test('the type completes an actual horizontal world-space circle', () => {
 assert.equal(data.elevation, 15); assert.ok(data.radius > 0); assert.ok(data.cameraDistance > data.radius*3);
 assert.equal(data.text, 'COMING SOON · '.repeat(3));
});
test('front and back lettering are drawn separately for body occlusion', () => {
 const draw=createOrbitRenderer(data),front=makeContext(),back=makeContext();draw(front,0,true);draw(back,0,false);
 assert.ok(front.paths.length > 8);assert.ok(back.paths.length > 8);
 assert.ok(front.paths.every(p=>p.alpha===1));assert.ok(back.paths.every(p=>p.alpha===.33));
 assert.ok(front.paths.flatMap(p=>p.points).every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)));
 const avg = c => c.paths.flatMap(p=>p.points).reduce((s,p)=>s+p[1],0)/c.paths.flatMap(p=>p.points).length;
 assert.ok(avg(front)>avg(back),'The nearer half is lower in camera perspective.');
});
test('letter projection repeats without a seam after a full turn', () => {
 const draw=createOrbitRenderer(data),a=makeContext(),b=makeContext();draw(a,.123,true);draw(b,.123+2*Math.PI,true);
 assert.equal(a.paths.length,b.paths.length);
 for(let i=0;i<a.paths.length;i++)for(let j=0;j<a.paths[i].points.length;j++)for(let k=0;k<2;k++)assert.ok(Math.abs(a.paths[i].points[j][k]-b.paths[i].points[j][k])<.00001);
});
