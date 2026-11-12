import { SpinMotion, TAU, wrap, releaseVelocity, TEXT_TO_MODEL_RATIO } from './motion.js';
import { createOrbitRenderer } from './orbit.js';
import { Turntable } from './turntable.js';
const stage=document.querySelector('#figure-stage'),canvas=document.querySelector('#scene'),ctx=canvas.getContext('2d');
const button=document.querySelector('#recenter'),glassesButton=document.querySelector('#glasses-toggle'),hint=document.querySelector('#hint-text'),status=document.querySelector('#load-status');
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),saveData=navigator.connection?.saveData===true;
const motion=new SpinMotion({reducedMotion:reduced.matches,paused:saveData});
let renderOrbit,poster,portrait,variant='no-glasses',wantedVariant=variant,switchId=0,ready=false,loading=false,drag=null,visible=true,lastTime=0,lastStats=0,renderCount=0,renderWindowStart=0,renderFps=0;
function ui(){
 glassesButton.setAttribute('aria-pressed',String(wantedVariant==='glasses'));
 glassesButton.setAttribute('aria-label',wantedVariant==='glasses'?'Remove glasses':'Add glasses');
 glassesButton.setAttribute('aria-busy',String(loading));
}
function toggleMotion(){if(motion.reducedMotion){motion.setReducedMotion(false);motion.setPaused(false);}else motion.setPaused(!motion.paused);stats();}
function recenter(){if(!motion.reducedMotion)motion.setPaused(false);motion.reset();drag=null;stage.classList.remove('dragging');draw();stats();status.textContent='Figure recentered.';}
function stats(){const d=Math.round(wrap(motion.angle)/TAU*360)%360;stage.setAttribute('aria-valuenow',d);stage.setAttribute('aria-valuetext',d<10||d>350?'Facing forward':`${d} degrees`);stage.dataset.rotation=motion.angle.toFixed(4);stage.dataset.speed=motion.velocity.toFixed(4);stage.dataset.textRotation=motion.textAngle.toFixed(4);stage.dataset.framesReady=String(ready);stage.dataset.textSpeed=(-motion.velocity*TEXT_TO_MODEL_RATIO).toFixed(4);stage.dataset.renderFps=renderFps.toFixed(1);stage.dataset.variant=variant;stage.dataset.quality=portrait?.lastQuality||'poster';stage.dataset.decodedMb=((portrait?.decodedBytes||0)/1048576).toFixed(1);}
function draw(){
 if(!ctx||!renderOrbit||!poster)return;
 const ratio=Math.min(devicePixelRatio||1,2),width=Math.round(stage.clientWidth*ratio),height=Math.round(width*640/900);
 if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
 ctx.setTransform(canvas.width/900,0,0,canvas.height/640,0,0);ctx.clearRect(0,0,900,640);
 renderOrbit(ctx,motion.textAngle,false);
 if(ready)portrait.draw(ctx,motion.angle,{highResolution:!saveData});
 else ctx.drawImage(poster,146.2,3.5,607.5,607.5);
 renderOrbit(ctx,motion.textAngle,true);stage.classList.add('drawn');
}
async function image(url){const x=new Image();x.decoding='async';x.src=url;await x.decode();return x;}
async function changeVariant(next){
 const token=++switchId;wantedVariant=next;
 if(portrait&&variant===next){loading=false;hint.textContent='Drag to spin';ui();return;}
 loading=true;hint.textContent=ready?'Changing glasses…':'Loading the spin…';ui();
 try{
  const loaded=await Turntable.load(`/assets/portrait-v2/${next==='glasses'?'glasses-hd':next}/manifest.json`,{highResolution:!saveData});
  if(token!==switchId){loaded.dispose();return;}
  portrait?.dispose();portrait=loaded;variant=next;ready=true;loading=false;
  stage.setAttribute('role','slider');stage.setAttribute('tabindex','0');stage.classList.remove('unavailable');
  button.hidden=false;glassesButton.hidden=false;hint.textContent='Drag to spin';
  status.textContent='Ready. Drag either direction or use the arrow keys. Space pauses rotation. Home recenters.';
  document.querySelector('#portrait').alt=`A smiling 3D character of Aidan with brown hair, ${variant==='glasses'?'glasses, ':''}a white T-shirt, jeans and sneakers.`;
  ui();stats();draw();
 }catch{
  if(token!==switchId)return;loading=false;wantedVariant=variant;ui();
  if(ready){hint.textContent='Drag to spin';status.textContent='That glasses option could not load. Your current portrait is still available.';}
  else{hint.textContent='Tap to retry the spin';status.textContent='The portrait is available. Interactive rotation could not load.';}
 }
}
async function loadFrames(){if(loading||ready)return;return changeVariant(variant);}
async function init(){try{const [data,img]=await Promise.all([fetch('/assets/orbit-glyphs.json?v=horizontal-a-b-v1').then(r=>r.json()),image('/assets/portrait-v2/no-glasses/poster.webp')]);renderOrbit=createOrbitRenderer(data);poster=img;draw();if(saveData)hint.textContent='Tap to load the spin';else loadFrames();}catch{hint.textContent='Coming soon';}}
stage.addEventListener('pointerdown',e=>{if(!ready){loadFrames();return;}if(e.button!==0)return;motion.beginDrag();drag={id:e.pointerId,x:e.clientX,angle:motion.angle,lastX:e.clientX,lastT:e.timeStamp,velocity:0,direction:0,moved:false};stage.setPointerCapture(e.pointerId);stage.classList.add('dragging');});
stage.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const gain=TAU*1.2/stage.clientWidth,dt=(e.timeStamp-drag.lastT)/1000,dx=e.clientX-drag.lastX;if(dt>0)drag.velocity=.65*(dx*gain/dt)+.35*drag.velocity;if(dx)drag.direction=Math.sign(dx);drag.lastX=e.clientX;drag.lastT=e.timeStamp;drag.moved ||= Math.abs(e.clientX-drag.x)>2;motion.dragTo(drag.angle+(e.clientX-drag.x)*gain);draw();stats();});
function release(e){if(!drag||e.pointerId!==drag.id)return;const speed=releaseVelocity({velocity:drag.velocity,age:e.timeStamp-drag.lastT,direction:drag.direction,moved:drag.moved,cancelled:e.type==='pointercancel'});motion.release(drag.moved?speed:0);stage.dataset.releaseSpeed=motion.velocity.toFixed(4);stage.dataset.releaseInput=speed.toFixed(4);stage.dataset.releaseDelay=(e.timeStamp-drag.lastT).toFixed(1);drag=null;stage.classList.remove('dragging');stats();}
['pointerup','pointercancel','lostpointercapture'].forEach(n=>stage.addEventListener(n,release));
stage.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home',' '].includes(e.key))return;e.preventDefault();if(!ready){loadFrames();return;}if(e.key===' ')toggleMotion();else if(e.key==='Home')recenter();else motion.impulse(e.key==='ArrowRight'?1:-1);ui();draw();stats();});
button.addEventListener('click',recenter);
glassesButton.addEventListener('click',()=>changeVariant(wantedVariant==='glasses'?'no-glasses':'glasses'));
window.addEventListener('pagehide',()=>{switchId++;portrait?.dispose();portrait=null;ready=false;loading=false;});
window.addEventListener('pageshow',e=>{if(e.persisted&&!saveData)loadFrames();});
reduced.addEventListener('change',e=>{motion.setReducedMotion(e.matches);ui();draw();stats();});
new IntersectionObserver(e=>{visible=e[0].isIntersecting;},{threshold:.05}).observe(stage);window.addEventListener('resize',draw);
function animate(t){const dt=Math.min((t-lastTime)/1000,.1);lastTime=t;if(ready&&visible&&!document.hidden){motion.step(dt);draw();renderCount++;if(t-renderWindowStart>=1000){renderFps=renderCount*1000/(t-renderWindowStart);renderWindowStart=t;renderCount=0;}if(t-lastStats>200){stats();lastStats=t;}}else{renderCount=0;renderWindowStart=t;}requestAnimationFrame(animate);}
ui();init();requestAnimationFrame(animate);
