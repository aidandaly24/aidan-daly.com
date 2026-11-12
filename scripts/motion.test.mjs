import test from 'node:test';
import assert from 'node:assert/strict';
import { SpinMotion, AUTO_SPEED, TEXT_AUTO_SPEED, TEXT_TO_MODEL_RATIO, TAU, wrap } from '../public/motion.js';
const advance = (m, seconds) => { for (let t=0;t<seconds;t+=1/120) m.step(1/120); };
test('normal spin and lettering rotate in opposite directions', () => {
 const m = new SpinMotion(); advance(m, 1); assert.ok(m.angle>0); assert.equal(m.textAngle,-m.angle*TEXT_TO_MODEL_RATIO);
});
test('dragging with normal spin adds speed and coasts back to baseline', () => {
 const m = new SpinMotion(); m.beginDrag(); m.dragTo(1); m.release(2);
 assert.ok(m.velocity>AUTO_SPEED+1.9); advance(m,1); assert.ok(m.velocity>AUTO_SPEED);
 advance(m,20); assert.ok(Math.abs(m.velocity-AUTO_SPEED)<.00001);
});
test('opposite drag reverses, slows, then resumes normal direction', () => {
 const m = new SpinMotion(); m.beginDrag(); m.dragTo(-1); m.release(-2); assert.ok(m.velocity<0);
 const a=m.angle;advance(m,.25);assert.ok(m.angle<a);assert.equal(m.textAngle,-m.angle*TEXT_TO_MODEL_RATIO);
 advance(m,8); assert.ok(m.velocity>0); advance(m,15);assert.ok(Math.abs(m.velocity-AUTO_SPEED)<.00001);
});
test('even a gentle opposite release reverses', () => { const m=new SpinMotion();m.release(-.07);assert.ok(m.velocity<0); });
test('reduced motion permits direct dragging but disables automatic spin and coast', () => {
 const m = new SpinMotion({reducedMotion:true}); advance(m,10);assert.equal(m.angle,0);
 m.beginDrag();m.dragTo(2);m.release(-5);advance(m,10);assert.equal(m.angle,2);assert.equal(m.velocity,0);
});
test('pause stops motion; keyboard and reset remain usable', () => {
 const m=new SpinMotion();m.setPaused(true);m.impulse(-1);const a=m.angle;advance(m,10);assert.equal(m.angle,a);
 m.setPaused(false);m.impulse(-1);assert.ok(m.velocity<0);m.reset();assert.equal(m.angle,0);assert.equal(m.velocity,AUTO_SPEED);
});
test('all frame indices wrap correctly', () => { assert.equal(wrap(-1,72),71);assert.equal(wrap(72,72),0); });

test('same-direction drag adds to existing forward momentum', () => { const m=new SpinMotion();m.velocity=2;m.beginDrag();m.dragTo(.7);m.release(1);assert.equal(m.velocity,3); });

import {releaseVelocity} from '../public/motion.js';
test('slow or held drag release keeps direction with gentle momentum',()=>{
  assert.equal(releaseVelocity({velocity:0,direction:-1,moved:true,age:1000}),-.08);
  assert.equal(releaseVelocity({velocity:0,direction:1,moved:true,age:1000}),.08);
  assert.ok(releaseVelocity({velocity:4,direction:1,moved:true,age:10})>3.9);
  assert.equal(releaseVelocity({velocity:4,direction:1,moved:true,cancelled:true}),0);
  assert.equal(releaseVelocity({velocity:4,direction:1,moved:false}),0);
});

test('figure turns in12 seconds while lettering keeps its26-second pace',()=>{
 const m=new SpinMotion();m.step(12);assert.ok(Math.abs(m.angle-TAU)<1e-12);
 assert.ok(Math.abs(m.textAngle+12*TEXT_AUTO_SPEED)<1e-12);
 assert.ok(Math.abs(TEXT_AUTO_SPEED-TAU/26)<1e-12);
});
