import { terrain, segment, progress, updateFeet, turnDelta } from './motion.mjs';
// The authored plates have different book stacks. A single named graph embeds separately into each art camera.
export const nodes={
 desk:[[346,914],[360,1283]],floor:[[561,927],[533,1285]],toe:[[770,866],[784,1286]],s1:[[763,796],[731,1146]],s2:[[731,728],[672,1058]],s3:[[688,664],[624,971]],cross:[[713,641],[360,826]],
 mid:[[813,630],[424,816]],east:[[963,641],[559,829]],pass:[[1057,645],[646,865]],ledge:[[1212,672],[741,877]],ladder0:[[1414,694],[850,872]],ladder1:[[1371,545],[803,699]],upper:[[1331,540],[749,692]],blocks:[[1236,541],[691,688]],overlook:[[603,649],[269,826]],westDock:[[684,643],[329,831]],eastDock:[[997,638],[597,818]], notebook:[[836,930],[533,1350]],stool:[[1152,888],[587,1454]]};
const pairs='desk-floor floor-notebook notebook-stool floor-toe toe-s1 s1-s2 s2-s3 s3-cross cross-mid cross-westDock cross-overlook mid-east east-eastDock east-pass pass-ledge ledge-ladder0 ladder0-ladder1 ladder1-upper upper-blocks'.split(' ').map(x=>x.split('-'));
// The portrait staircase rises into the RIGHT approach; do not walk through the arch face.
export const edges=l=>pairs.map(([a,b])=>l===1&&a==='s3'&&b==='cross'?[a,'pass']:[a,b]);
export const bays=['desk','blocks','westDock','eastDock','overlook','stool']; const docks=['westDock','eastDock'];export const dt=1/60;
export const mix=(a,b,t)=>a+(b-a)*t,sm=t=>t*t*(3-2*t), dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const clamp=(t)=>Math.max(0,Math.min(1,t));
const seatedWork = .70;
const leaveChairSeconds = 1.65;
function rng(n){return()=>{n=(n+0x6d2b79f5)|0;let t=Math.imul(n^(n>>>15),1|n);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
function nearSeg(p,a,b){let v=[b[0]-a[0],b[1]-a[1]],t=clamp(((p[0]-a[0])*v[0]+(p[1]-a[1])*v[1])/(v[0]**2+v[1]**2||1));return dist(p,[a[0]+v[0]*t,a[1]+v[1]*t])}
function passagesOverlap(path, otherPath, layout) {
  const side = (a, b, p) => (b[0]-a[0]) * (p[1]-a[1]) - (b[1]-a[1]) * (p[0]-a[0]);
  for (let i = 1; i < path.length; i++) {
    const a = nodes[path[i - 1]][layout], b = nodes[path[i]][layout];
    for (let j = 1; j < otherPath.length; j++) {
      const c = nodes[otherPath[j - 1]][layout], d = nodes[otherPath[j]][layout];
      if (side(a,b,c)*side(a,b,d) < 0 && side(c,d,a)*side(c,d,b) < 0) return true;
      if (Math.min(nearSeg(a,c,d), nearSeg(b,c,d), nearSeg(c,a,b), nearSeg(d,a,b)) < 45) return true;
    }
  }
  return false;
}
export class City{
 constructor(seed,l=0,recordEvents=true){this.recordEvents=recordEvents;this.r=rng(seed);this.l=l;this.clock=0;this.events=[];this.queue=[];this.lock={desk:0,blocks:1};this.plank={at:'westDock',owner:null};this.cube={owner:null};this.a=['desk','blocks'].map((at,i)=>({i,at,goal:null,kind:'work',p:[...nodes[at][l]],yaw:i?-1.25:1.15,work:0,dwell:2.9+this.r()*2,age:0,last:{},steps:0,phase:0,feet:[-1,1].map(s=>[nodes[at][l][0]+s*9,nodes[at][l][1],0]),swing:null,leg:0,climb:0,job:i?'stack':'type',visits:0}));this.cube.owner=1;this.event('init')}
 event(type,who,station){if(this.recordEvents)this.events.push([+this.clock.toFixed(4),type,who,station])}
 point(k){return nodes[k][this.l]}
 path(a,b,other,layout=this.l){let q=[[a]],seen=new Set([a]);for(let path of q){let p=path.at(-1);if(p===b)return path;for(let e of edges(layout)){if(!e.includes(p))continue;let n=e[Number(e[0]===p)];if(seen.has(n)||n===other.at)continue;if(nearSeg(nodes[other.at][layout],nodes[p][layout],nodes[n][layout])<45)continue;seen.add(n);q.push([...path,n])}}}
 // The two painted staircases join opposite sides of the bridge. Map each
 // trip's progress onto its reserved route for the new composition.
 setLayout(layout) {
   if (layout === this.l) return;
   const oldLayout = this.l;
   this.l = layout;
   for (const actor of this.a) {
     const previous = actor.p;
     if (actor.kind !== 'travel') {
       actor.p = [...this.point(actor.at)];
     } else {
       const path = actor.paths[oldLayout];
       const oldPoint = name => nodes[name][oldLayout];
       const lengthsOld = path.slice(1).map((end, i) => dist(oldPoint(path[i]), oldPoint(end)));
       const total = lengthsOld.reduce((sum, length) => sum + length, 0);
       const next = actor.seg?.to ?? actor.route[0];
       const nextIndex = next ? path.indexOf(next) : path.length;
       const remaining = next ? dist(actor.p, oldPoint(next)) +
         lengthsOld.slice(nextIndex).reduce((sum, length) => sum + length, 0) : 0;
       const trip = { fraction: clamp(1 - remaining / total), path: actor.paths[layout] };
       const points = trip.path.map(name => this.point(name));
       const lengths = points.slice(1).map((p, i) => dist(points[i], p));
       let distance = trip.fraction * lengths.reduce((sum, length) => sum + length, 0);
       let i = 0;
       while (i + 1 < lengths.length && distance > lengths[i]) distance -= lengths[i++];
       const fraction = clamp(distance / lengths[i]);
       const start = points[i], end = points[i + 1];
       actor.p = start.map((x, axis) => mix(x, end[axis], fraction));
       const from = trip.path[i], to = trip.path[i + 1];
       const previous = i > 0 ? terrain(trip.path[i-1],from) : null;
       const nextSurface = i+2 < trip.path.length ? terrain(to,trip.path[i+2]) : null;
       const g = segment(from,to,start,end,previous,nextSurface,this.plank.owner===actor.i,layout);
       let lo=0, hi=1;
       for (let k=0;k<24;k++) {
         const mid=(lo+hi)/2;
         if (progress(g,mid)<fraction) lo=mid;
         else hi=mid;
       }
       g.elapsed = g.T*(lo+hi)/2;
       actor.seg = fraction >= 1 ? null : g;
       actor.surface = g.surface;
       actor.node = to;
       actor.route = trip.path.slice(i + 2);
     }
     const translate = point => [point[0] + actor.p[0] - previous[0],
       point[1] + actor.p[1] - previous[1], point[2]];
     actor.feet = actor.feet.map(translate);
     if (actor.swing) {
       actor.swing.s = translate(actor.swing.s);
       actor.swing.tar = translate(actor.swing.tar);
     }
   }
 }
 choose(a){let b=this.a[1-a.i],wantCarry=this.plank.owner===a.i,dock=this.plank.at,otherDock=docks.find(x=>x!==dock);let options=wantCarry?[a.deliver]:bays.filter(x=>x!==a.at&&this.lock[x]==null&&(!docks.includes(x)||x===dock));let opts=[];for(let x of options){const paths = [0, 1].map(layout => this.path(a.at, x, b, layout));
 if (paths.some((path, layout) => !path || (b.paths && passagesOverlap(path, b.paths[layout], layout)))) continue;
 let deliver=null;
 if(x===dock&&!wantCarry){if(this.lock[otherDock]!=null||!this.path(x,otherDock,b)||!this.path(x,otherDock,b,1-this.l))continue;deliver=otherDock}
 const w=(x===dock?2.6:1)*(1+Math.min(3,(this.clock-(a.last[x]??-100))/40));
 opts.push({x,paths,deliver,w})}
 if(!opts.length)return false;
 let t=this.r()*opts.reduce((n,o)=>n+o.w,0);let o=opts.find(e=>(t-=e.w)<=0)||opts.at(-1);if(o.deliver){this.lock[o.deliver]=a.i;a.deliver=o.deliver}
 this.lock[o.x]=a.i;
 a.paths=o.paths;
 a.goal=o.x;
 if(a.kind==='work'&&a.job==='type'){
   // Keep both ends and the whole path reserved throughout the chair exit.
   a.riseAt=this.clock;
   this.event('reserved',a.i,o.x);
 } else this.depart(a);
 return true}
 depart(a){
   a.waited=a.kind==='wait'?Math.max(0,a.age-a.dwell):0;
   a.departedAt=this.clock;
   delete this.lock[a.at];
   a.route=a.paths[this.l].slice(1);
   a.riseAt=null;
   a.kind='travel';
   a.seg=null;
   a.node=a.at;
   a.surface=null;
   a.work=0;
   this.event('depart',a.i,a.goal);
 }
 walk(a) {
   if (!a.seg && !a.route.length) {
     updateFeet(a,null,1,dt);
     if (a.swing || a.feet.some((foot,i)=>dist(foot,[a.p[0]+(i?8:-8),a.p[1]])>1)) return;
     a.paths=null;
     a.at=a.goal;
     a.goal=null;
     a.kind='work';
     a.age=0;
     a.work=0;
     a.visits++;
     a.last[a.at]=this.clock;
     a.job=a.at==='desk'?'type':a.at==='blocks'?'stack':a.at==='overlook'?'look':
       a.at==='stool'?'inspect':this.plank.owner===a.i?'place':'pick';
     const dwell={type:4.5,stack:3.9,look:2.8,inspect:6.2,pick:3.1,place:3.4};
     a.dwell=dwell[a.job]+this.r()*1.4;
     a.climb=0;
     a.footPitch=[0,0];
     if (a.job==='stack') this.cube.owner=a.i;
     this.event('arrive',a.i,a.at);
     return;
   }
   if (!a.seg) {
     const from=a.node, to=a.route.shift();
     const next=a.route.length ? terrain(to,a.route[0]) : null;
     a.seg=segment(from,to,[...a.p],this.point(to),a.surface,next,this.plank.owner===a.i,this.l);
     a.surface=a.seg.surface;
     a.node=to;
   }
   const g=a.seg;
   g.elapsed+=dt;
   const u=clamp(g.elapsed/g.T);
   const f=progress(g,u);
   const previous=a.p;
   a.p=[mix(g.start[0],g.end[0],f),mix(g.start[1],g.end[1],f)];
   const heading = (start,end) => Math.max(-1.32,Math.min(1.32,Math.atan2(end[0]-start[0],Math.abs(end[1]-start[1])*.65+8)));
   const ladderFacing = Math.PI - .16;
   let target=g.surface==='ladder'?ladderFacing:heading(g.start,g.end);
   if (g.surface!=='ladder' && a.route.length && terrain(g.to,a.route[0])==='ladder') {
     target+=turnDelta(target,ladderFacing)*sm(clamp((u-.22)/.78));
   }
   if (a.route.length && g.surface===terrain(g.to,a.route[0])) {
     const ahead=heading(g.end,this.point(a.route[0]));
     target+=turnDelta(target,ahead)*sm(clamp((u-.55)/.45))*.64;
   }
   a.yaw+=Math.max(-.16,Math.min(.16,turnDelta(a.yaw,target)*dt*4.2));
   a.yaw=turnDelta(0,a.yaw);
   a.gaze=a.yaw+turnDelta(a.yaw,target)*.32;
   const climbing=g.surface==='ladder'?1:0;
   a.climb+=(climbing-a.climb)*dt*7;
   a.steps+=dist(previous,a.p);
   updateFeet(a,g,u,dt);
   if (u===1) a.seg=null;
 }
 tick() {
   this.clock+=dt;
   let dispatch=false;
   for(const a of this.a) {
     if(a.kind==='travel') {
       this.walk(a);
       if(a.kind==='work') dispatch=true;
       continue;
     }
     a.age+=dt;
     if(a.kind!=='work') continue;
     if(a.job==='type') {
       if(a.riseAt!=null) {
         const exit=clamp((this.clock-a.riseAt)/leaveChairSeconds);
         const first=this.point(a.paths[this.l][1]), from=this.point(a.at);
         const heading=Math.atan2(first[0]-from[0],Math.abs(first[1]-from[1])*.65+8);
         const facing=1.07+turnDelta(1.07,heading)*sm(clamp((exit-.50)/.50));
         a.yaw+=Math.max(-.095,Math.min(.095,turnDelta(a.yaw,facing)));
         a.gaze=a.yaw;
         a.work=mix(seatedWork,1,exit);
         if(a.work>=1) {
           this.event('typed',a.i,a.at);
           this.depart(a);
           dispatch=true;
         }
       } else {
         a.yaw+=turnDelta(a.yaw,1.07)*(1-Math.exp(-dt*3.1));
         a.work=Math.min(seatedWork,a.age/a.dwell);
         if(a.work===seatedWork&&!this.queue.includes(a.i)) {
           this.queue.push(a.i);
           dispatch=true;
         }
       }
       continue;
     }
     a.work=clamp(a.age/a.dwell);
     if(a.job==='pick'&&a.work>=.5&&this.plank.owner===null) {
       if(this.plank.at!==a.at) throw Error('wrong pick');
       this.plank.owner=a.i;
       this.plank.at=null;
       this.event('pickup',a.i,a.at);
     }
     if(a.job==='place'&&a.work>=.5&&this.plank.owner===a.i) {
       this.plank.owner=null;
       this.plank.at=a.at;
       a.deliver=null;
       this.event('placed',a.i,a.at);
     }
     if(a.work>=1) {
       if(a.job==='stack') {this.cube.owner=null;this.event('stacked',a.i,a.at);}
       a.kind='wait';
       this.queue.push(a.i);
       dispatch=true;
     }
   }
   if(dispatch) {
     for(const i of [...this.queue]) {
       if(this.choose(this.a[i])) this.queue.splice(this.queue.indexOf(i),1);
     }
   }
 }
}
