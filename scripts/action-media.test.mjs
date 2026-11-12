import test from 'node:test';
import assert from 'node:assert/strict';
import {ActionSequence,ActionPlayback,actionFrame,actionPages,chooseActionTier,validateActionManifest} from '../public/bookshelf/action-media.js';

const manifest=()=>({type:'rendered-action',frames:24,fps:24,framesPerPage:6,tiers:{mobile:{width:100,height:120,pages:Array.from({length:4},(_,i)=>({url:`page-${i}.webp`,columns:3,rows:2}))}}});
const flush=()=>new Promise(resolve=>setImmediate(resolve));

test('action timing includes every frame and loops without a duplicate endpoint',()=>{
  for(let frame=0;frame<96;frame++)assert.equal(actionFrame(frame/24,24,96),frame);
  assert.equal(actionFrame(4,24,96),0);assert.equal(actionFrame(-1/24,24,96),95);
});
test('action sequence rejects incomplete, external, and excessive-memory assets',()=>{
  assert.doesNotThrow(()=>validateActionManifest(manifest()));
  const incomplete=manifest();incomplete.tiers.mobile.pages.pop();assert.throws(()=>validateActionManifest(incomplete),/Incomplete/);
  const external=manifest();external.tiers.mobile.pages[0].url='https://example.com/a.webp';assert.throws(()=>validateActionManifest(external),/local/);
  const large=manifest();large.tiers.mobile.width=2048;large.tiers.mobile.height=2048;assert.throws(()=>validateActionManifest(large),/budget/);
});
test('sequential cache requests current and next page, including the wrap',()=>{
  assert.deepEqual(actionPages(18,6,4),[3,0]);assert.deepEqual(actionPages(5,6,4),[0,1]);
});
test('action quality uses actual display density within a bounded device budget',()=>{
  const m=manifest();m.tiers.desktop={...m.tiers.mobile,width:200,height:240};
  assert.equal(chooseActionTier(m,{displayHeight:100,dpr:1}),'mobile');
  assert.equal(chooseActionTier(m,{displayHeight:100,dpr:2}),'desktop');
  assert.equal(chooseActionTier(m,{displayHeight:100,dpr:2,saveData:true}),'mobile');
  assert.equal(chooseActionTier(m,{displayHeight:100,dpr:2,maxDecodedBytes:100*120*6*4*3}),'mobile');
  assert.equal(chooseActionTier(m,{displayHeight:100,maxDecodedBytes:1}),null);
});
test('action cache closes retired images and keeps only two decoded pages',async()=>{
  const images=[];
  const decode=async()=>{const image={width:300,height:240,closed:false,close(){this.closed=true;}};images.push(image);return image;};
  const seq=new ActionSequence(manifest(),new URL('https://example.com/loop/'),'mobile',decode);
  seq.prefetch(0);await flush();await flush();
  assert.equal(seq.cache.size,2);assert.equal(seq.decodedBytes,300*240*4*2);
  seq.prefetch(12);await flush();await flush();
  assert.equal(seq.cache.size,2);assert.ok(images.slice(0,2).every(i=>i.closed));
  seq.dispose();assert.equal(seq.decodedBytes,0);assert.ok(images.every(i=>i.closed));
});
test('action cache closes late results after disposal',async()=>{
  let resolve;const image={width:300,height:240,closed:false,close(){this.closed=true;}};
  const seq=new ActionSequence(manifest(),new URL('https://example.com/loop/'),'mobile',()=>new Promise(r=>{resolve=r;}));
  seq.prefetch(0);seq.dispose();resolve(image);await flush();assert.ok(image.closed);assert.equal(seq.cache.size,0);
});
test('identical action frames do not redraw until the canvas is resized',async()=>{
  const seq=new ActionSequence(manifest(),new URL('https://example.com/loop/'),'mobile',async()=>({width:300,height:240,close(){}}));
  seq.prefetch(0);await flush();await flush();
  let draws=0;const ctx={canvas:{width:100,height:120},clearRect(){},drawImage(){draws++;}};
  assert.ok(seq.draw(ctx,0));assert.ok(seq.draw(ctx,0));assert.equal(draws,1);
  ctx.canvas.width=200;assert.ok(seq.draw(ctx,0));assert.equal(draws,2);seq.dispose();
});
test('slow loading holds the real frame, and pause/visibility stop action time',()=>{
  const frames=[];let ready=false;const seq={manifest:manifest(),draw(_ctx,frame){frames.push(frame);return ready;}};
  const playback=new ActionPlayback(seq);
  playback.tick({},1/24);assert.equal(playback.seconds,0);
  ready=true;playback.tick({},1/24);assert.equal(playback.seconds,1/24);
  playback.tick({},1/24,{playing:false});assert.equal(playback.seconds,1/24);
  playback.tick({},1/24,{visible:false});assert.equal(playback.seconds,1/24);
  assert.deepEqual(frames,[1,1,1,1]);playback.reset();assert.equal(playback.seconds,0);
});
