import test from 'node:test';
import assert from 'node:assert/strict';
import {framePair,tileRect,neighboringPages,Turntable} from '../public/turntable.js';
import {TAU} from '../public/motion.js';
test('both portrait tiers stay at the same genuine camera angle',()=>{
 for(let i=-500;i<=500;i++){
  const a=i*.027,base=framePair(a,72),high=framePair(a,144);
  assert.ok(Math.abs((base.first+base.fraction)*2-(high.first+high.fraction))<1e-10);
 }
});
test('frame pair blends across the wrap without skipping forward',()=>{
 const p=framePair(TAU/288,144);assert.equal(p.first,143);assert.equal(p.second,0);assert.ok(Math.abs(p.fraction-.5)<1e-10);
});
test('atlas tile rectangles do not include neighboring images',()=>{
 assert.deepEqual(tileRect(5,{columns:4,tileWidth:384,tileHeight:928}),[384,928,384,928]);
 assert.deepEqual(tileRect(11,{columns:4,tileWidth:384,tileHeight:928}),[1152,1856,384,928]);
});
test('decoded high-resolution cache targets exactly three wrapping pages',()=>{
 assert.deepEqual(neighboringPages(0,12,12),[0,1,11]);
 assert.deepEqual(neighboringPages(143,12,12),[11,0,10]);
 for(let i=0;i<144;i++)assert.equal(new Set(neighboringPages(i,12,12)).size,3);
});

test('high-resolution cache closes retired bitmaps and stays bounded',async()=>{
 const originals={document:globalThis.document,fetch:globalThis.fetch,createImageBitmap:globalThis.createImageBitmap};
 const images=[],base={width:20,height:20,closed:false,close(){this.closed=true;}};
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({clearRect(){},drawImage(){}})})};
 globalThis.fetch=async()=>({ok:true,blob:async()=>({})});
 globalThis.createImageBitmap=async()=>{const b={width:40,height:30,closed:false,close(){this.closed=true;}};images.push(b);return b;};
 try{
  const m={frames:144,base:{frames:72},hd:{framesPerPage:12,pages:Array.from({length:12},(_,i)=>({url:`hd-${i}.webp`}))}};
  const t=new Turntable(m,new URL('https://example.test/'),base,true);
  const flush=async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>setImmediate(resolve));};
  t.prefetch(0);await flush();assert.equal(t.cache.size,3);assert.equal(t.pending.size,0);
  const prior=[...t.cache.values()];t.prefetch(72);await flush();assert.equal(t.cache.size,3);assert.ok(prior.every(x=>x.closed));
  assert.equal(t.decodedBytes,20*20*4+3*40*30*4);
  t.dispose();assert.ok(base.closed);assert.ok(images.every(x=>x.closed));assert.equal(t.cache.size,0);
 }finally{Object.assign(globalThis,originals);}
});
