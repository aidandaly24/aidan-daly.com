import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {LAYOUTS,agentPose,trailPoses} from '../public/bookshelf/scene.js';

test('each responsive city preserves all four activity areas',()=>{
 for(const layout of Object.values(LAYOUTS)){
  assert.deepEqual(layout.scenes.map(s=>s.id),['coding','bridge','blocks','workshop']);
  assert.ok(layout.scenes.every(s=>s.x>0&&s.x<1&&s.y>0&&s.y<1));
 }
});
test('companion follows a continuous bounded flight in both compositions',()=>{
 for(const layout of Object.keys(LAYOUTS))for(let i=0;i<200;i++){
  const p=agentPose(i*.09,layout,false,{x:100,y:-100});
  assert.ok(Object.values(p).every(Number.isFinite));
  assert.ok(p.x>.15&&p.x<.55&&p.y>.5&&p.y<.7);
  const a=agentPose(i*.09,layout),b=agentPose(i*.09+9,layout);
  assert.ok(Math.abs(a.x-b.x)<1e-10&&Math.abs(a.y-b.y)<1e-10);
  assert.equal(trailPoses(i,layout,{x:0,y:0}).length,7);
 }
});
test('rest and reduced-motion position is completely still',()=>{
 for(const layout of Object.keys(LAYOUTS))assert.deepEqual(agentPose(0,layout,true),agentPose(1000,layout,true,{x:1,y:1}));
});
test('bookshelf entry has semantic copy and an accessible companion, no spinner controls',async()=>{
 const html=await readFile('public/bookshelf/index.html','utf8'),css=await readFile('public/bookshelf/style.css','utf8');
 assert.match(html,/<h1>Coming Soon<\/h1>/);assert.match(html,/Hi, I’m Aidan Daly/);
 assert.match(html,/aria-pressed="false"/);assert.match(html,/aria-describedby="agent-help"/);
 assert.doesNotMatch(html,/figure-stage|motion-toggle|glasses-toggle|aidan-daly\.com<\/span>/);
 assert.match(css,/prefers-reduced-motion/);assert.match(css,/100dvh/);
});
test('responsive art is complete and light enough for mobile delivery',async()=>{
 for(const name of ['city-desktop-960.webp','city-desktop-1536.webp','city-mobile-480.webp','city-mobile-768.webp','city-mobile-948.webp']){
  const f=await stat('public/bookshelf/assets/'+name);assert.ok(f.size>10000&&f.size<900000);
 }
});
