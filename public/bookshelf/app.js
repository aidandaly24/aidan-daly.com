import {agentPose,trailPoses,clamp} from './scene.js';

const world=document.querySelector('.world'),agent=document.querySelector('.agent'),note=document.querySelector('.agent-note'),status=document.querySelector('#world-status');
const reduced=matchMedia('(prefers-reduced-motion:reduce)'),portrait=matchMedia('(max-aspect-ratio:4/5)');
const dots=[...document.querySelectorAll('.trail i')];
let resting=reduced.matches,visible=true,elapsed=0,last=0,frame=0,disposed=false;
let pointer={x:0,y:0},target={x:0,y:0};

function position(element,pose){element.style.left=`${pose.x*100}%`;element.style.top=`${pose.y*100}%`;}
function draw(){
  const layout=portrait.matches?'portrait':'desktop',pose=agentPose(elapsed,layout,resting,pointer);
  position(agent,pose);agent.style.setProperty('--tilt',`${pose.tilt}deg`);agent.style.setProperty('--scale',pose.scale);
  if(!resting)trailPoses(elapsed,layout,pointer).forEach((p,i)=>{position(dots[i],p);dots[i].style.opacity=(1-i/dots.length)*.55;});
  world.dataset.layout=layout;world.dataset.motion=resting?'resting':'flying';world.dataset.agentX=pose.x.toFixed(4);world.dataset.agentY=pose.y.toFixed(4);
}
function update(){
  world.classList.toggle('is-resting',resting);
  agent.setAttribute('aria-pressed',String(resting));
  agent.setAttribute('aria-label',resting?'Wake the little coding companion':'Let the little coding companion rest');
  note.textContent=resting?'Ready when you are':'A little help, coming soon';draw();
}
agent.addEventListener('click',()=>{resting=!resting;update();status.textContent=resting?'The companion is resting.':'The companion is flying around the coding nook.';});
world.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||resting)return;const r=world.getBoundingClientRect();target={x:clamp((e.clientX-r.left)/r.width*2-1,-1,1),y:clamp((e.clientY-r.top)/r.height*2-1,-1,1)};},{passive:true});
world.addEventListener('pointerleave',()=>{target={x:0,y:0};});
reduced.addEventListener('change',e=>{resting=e.matches;update();});
portrait.addEventListener('change',draw);
const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;last=0;},{threshold:.05});observer.observe(world);
document.addEventListener('visibilitychange',()=>{last=0;});
window.addEventListener('resize',draw,{passive:true});
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();});
window.addEventListener('pageshow',e=>{if(e.persisted){disposed=false;last=0;observer.observe(world);frame=requestAnimationFrame(tick);}});
function tick(time){
  if(disposed)return;
  const dt=last?Math.min((time-last)/1000,.05):0;last=time;
  if(!resting&&visible&&!document.hidden){elapsed+=dt;pointer.x+=(target.x-pointer.x)*Math.min(1,dt*3);pointer.y+=(target.y-pointer.y)*Math.min(1,dt*3);draw();}
  frame=requestAnimationFrame(tick);
}
agent.hidden=false;update();frame=requestAnimationFrame(tick);
