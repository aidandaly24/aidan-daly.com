import { SpinMotion, TAU, wrap, releaseVelocity } from './motion.js';
import { createOrbitRenderer } from './orbit.js';
const stage=document.querySelector('#figure-stage'),canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d');
const button=document.querySelector('#motion-toggle'),hint=document.querySelector('#hint-text'),status=document.querySelector('#load-status');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),saveData=navigator.connection?.saveData===true;
const motion=new SpinMotion({reducedMotion:reduced.matches,paused:saveData});
const body=document.createElement('canvas');body.width=576;body.height=576;const bodyCtx=body.getContext('2d');
let renderOrbit,poster,frames=[],count=0,ready=false,loading=false,drag=null,visible=true,lastTime=0,lastDraw=-1,lastStats=0;
function ui(){button.setAttribute('aria-pressed',String(motion.paused||motion.reducedMotion));button.setAttribute('aria-label',motion.paused||motion.reducedMotion?'Play automatic rotation':'Pause automatic rotation');}
function toggleMotion(){if(motion.reducedMotion){motion.setReducedMotion(false);motion.setPaused(false);}else motion.setPaused(!motion.paused);ui();stats();}
function stats(){const d=Math.round(wrap(motion.angle)/TAU*360)%360;stage.setAttribute('aria-valuenow',d);stage.setAttribute('aria-valuetext',d<10||d>350?'Facing forward':`${d} degrees`);stage.dataset.rotation=motion.angle.toFixed(4);stage.dataset.speed=motion.velocity.toFixed(4);stage.dataset.textRotation=motion.textAngle.toFixed(4);stage.dataset.framesReady=String(ready);}
function draw(){
 if(!ctx||!renderOrbit||!poster)return;
 const ratio=Math.min(devicePixelRatio||1,2),width=Math.round(stage.clientWidth*ratio),height=Math.round(width*640/900);
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 ctx.setTransform(canvas.width/900,0,0,canvas.height/640,0,0);ctx.clearRect(0,0,900,640);
 renderOrbit(ctx,motion.textAngle,false);
 if(ready){
  const index=wrap(-motion.angle)/TAU*count,first=Math.floor(index)%count,second=(first+1)%count,fraction=index-Math.floor(index);
  bodyCtx.clearRect(0,0,576,576);bodyCtx.globalCompositeOperation='source-over';bodyCtx.globalAlpha=1-fraction;bodyCtx.drawImage(frames[first],0,0,576,576);
  bodyCtx.globalCompositeOperation='lighter';bodyCtx.globalAlpha=fraction;bodyCtx.drawImage(frames[second],0,0,576,576);
  bodyCtx.globalCompositeOperation='source-over';bodyCtx.globalAlpha=1;ctx.drawImage(body,146.2,3.5,607.5,607.5);
 }else ctx.drawImage(poster,146.2,3.5,607.5,607.5);
 renderOrbit(ctx,motion.textAngle,true);stage.classList.add('drawn');
}
async function image(url){const x=new Image();x.decoding='async';x.src=url;await x.decode();return x;}
async function loadFrames(){
 if(loading||ready)return;loading=true;hint.textContent='Loading the spin…';
 try{const response=await fetch('/assets/turntable/manifest.json');if(!response.ok)throw Error('media');const manifest=await response.json();count=manifest.frames;if(!Number.isInteger(count)||count<2||count>240)throw Error('manifest');
 const total=count,pending=new Array(total);let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<total){const i=next++;pending[i]=await image(`/assets/turntable/frame-${String(i).padStart(3,'0')}.webp?v=${encodeURIComponent(manifest.version||'1')}`);}}));frames=pending;
 ready=true;loading=false;stage.setAttribute('role','slider');stage.setAttribute('tabindex','0');stage.classList.remove('unavailable');button.hidden=false;hint.textContent='Drag to spin';status.textContent='Ready. Drag either direction or use the arrow keys. Space pauses rotation.';stats();draw();
 }catch{loading=false;hint.textContent='Portrait preview';status.textContent='The portrait is available. Interactive rotation could not load.';stage.removeAttribute('role');stage.removeAttribute('tabindex');stage.classList.add('unavailable');}
}
async function init(){try{const [data,img]=await Promise.all([fetch('/assets/orbit-glyphs.json?v=horizontal-a-b-v1').then(r=>r.json()),image('/assets/portrait.webp')]);renderOrbit=createOrbitRenderer(data);poster=img;draw();if(saveData)hint.textContent='Tap to load the spin';else loadFrames();}catch{hint.textContent='Coming soon';}}
stage.addEventListener('pointerdown',e=>{if(!ready){loadFrames();return;}if(e.button!==0)return;motion.beginDrag();drag={id:e.pointerId,x:e.clientX,angle:motion.angle,lastX:e.clientX,lastT:e.timeStamp,velocity:0,direction:0,moved:false};stage.setPointerCapture(e.pointerId);stage.classList.add('dragging');});
stage.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const gain=TAU*1.2/stage.clientWidth,dt=(e.timeStamp-drag.lastT)/1000,dx=e.clientX-drag.lastX;if(dt>0)drag.velocity=.65*(dx*gain/dt)+.35*drag.velocity;if(dx)drag.direction=Math.sign(dx);drag.lastX=e.clientX;drag.lastT=e.timeStamp;drag.moved ||= Math.abs(e.clientX-drag.x)>2;motion.dragTo(drag.angle+(e.clientX-drag.x)*gain);draw();stats();});
function release(e){if(!drag||e.pointerId!==drag.id)return;const speed=releaseVelocity({velocity:drag.velocity,age:e.timeStamp-drag.lastT,direction:drag.direction,moved:drag.moved,cancelled:e.type==='pointercancel'});motion.release(drag.moved?speed:0);stage.dataset.releaseSpeed=motion.velocity.toFixed(4);stage.dataset.releaseInput=speed.toFixed(4);stage.dataset.releaseDelay=(e.timeStamp-drag.lastT).toFixed(1);drag=null;stage.classList.remove('dragging');stats();}
['pointerup','pointercancel','lostpointercapture'].forEach(n=>stage.addEventListener(n,release));
stage.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home',' '].includes(e.key))return;e.preventDefault();if(!ready){loadFrames();return;}if(e.key===' ')toggleMotion();else if(e.key==='Home')motion.reset();else motion.impulse(e.key==='ArrowRight'?1:-1);ui();draw();stats();});
button.addEventListener('click',toggleMotion);
reduced.addEventListener('change',e=>{motion.setReducedMotion(e.matches);ui();draw();stats();});
new IntersectionObserver(e=>{visible=e[0].isIntersecting;},{threshold:.05}).observe(stage);window.addEventListener('resize',draw);
function animate(t){const dt=Math.min((t-lastTime)/1000,.05);lastTime=t;if(ready&&visible&&!document.hidden){motion.step(dt);if(t-lastDraw>=25){draw();lastDraw=t;}if(t-lastStats>200){stats();lastStats=t;}}requestAnimationFrame(animate);}
ui();init();requestAnimationFrame(animate);
