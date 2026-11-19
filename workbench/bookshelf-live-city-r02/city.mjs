// The authored plates have different book stacks. A single named graph embeds separately into each art camera.
export const nodes={
 desk:[[346,914],[360,1283]],floor:[[561,927],[533,1285]],toe:[[770,866],[784,1230]],s1:[[763,796],[731,1146]],s2:[[731,728],[672,1058]],s3:[[688,664],[624,971]],cross:[[713,641],[581,900]],
 mid:[[813,630],[442,812]],east:[[963,641],[578,829]],pass:[[1057,645],[646,865]],ledge:[[1212,672],[741,877]],ladder0:[[1414,694],[850,872]],ladder1:[[1371,545],[803,699]],upper:[[1331,540],[749,692]],blocks:[[1276,541],[725,688]],overlook:[[603,649],[269,826]],westDock:[[684,643],[329,831]],eastDock:[[997,638],[597,818]]};
const pairs='desk-floor floor-toe toe-s1 s1-s2 s2-s3 s3-cross cross-mid cross-westDock cross-overlook mid-east east-eastDock east-pass pass-ledge ledge-ladder0 ladder0-ladder1 ladder1-upper upper-blocks'.split(' ').map(x=>x.split('-'));
// The portrait staircase rises into the RIGHT approach; do not walk through the arch face.
export const edges=l=>pairs.map(([a,b])=>l===1&&a==='s3'&&b==='cross'?[a,'pass']:[a,b]);
export const bays=['desk','blocks','westDock','eastDock','overlook']; const docks=['westDock','eastDock'];export const dt=1/60;
export const mix=(a,b,t)=>a+(b-a)*t,sm=t=>t*t*(3-2*t), dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const clamp=(t)=>Math.max(0,Math.min(1,t)); const angle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
function rng(n){return()=>{n=(n+0x6d2b79f5)|0;let t=Math.imul(n^(n>>>15),1|n);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}}
function nearSeg(p,a,b){let v=[b[0]-a[0],b[1]-a[1]],t=clamp(((p[0]-a[0])*v[0]+(p[1]-a[1])*v[1])/(v[0]**2+v[1]**2||1));return dist(p,[a[0]+v[0]*t,a[1]+v[1]*t])}
export class City{
 constructor(seed,l=0){this.r=rng(seed);this.l=l;this.clock=0;this.events=[];this.lane=null;this.queue=[];this.lock={desk:0,blocks:1};this.plank={at:'westDock',owner:null};this.cube={owner:null};this.a=['desk','blocks'].map((at,i)=>({i,at,goal:null,kind:'work',p:[...nodes[at][l]],yaw:i?-1.25:1.15,work:0,dwell:2.9+this.r()*2,age:0,last:{},steps:0,phase:0,feet:[-1,1].map(s=>[nodes[at][l][0]+s*9,nodes[at][l][1],0]),swing:null,leg:0,climb:0,job:i?'stack':'type',visits:0}));this.cube.owner=1;this.event('init')}
 event(type,who,station){this.events.push([+this.clock.toFixed(4),type,who,station])}
 point(k){return nodes[k][this.l]}
 path(a,b,other){let q=[[a]],seen=new Set([a]);for(let path of q){let p=path.at(-1);if(p===b)return path;for(let e of edges(this.l)){if(!e.includes(p))continue;let n=e[Number(e[0]===p)];if(seen.has(n)||n===other.at)continue;if(nearSeg(other.p,this.point(p),this.point(n))<45)continue;seen.add(n);q.push([...path,n])}}}
 choose(a){let b=this.a[1-a.i],wantCarry=this.plank.owner===a.i,dock=this.plank.at,otherDock=docks.find(x=>x!==dock);let options=wantCarry?[a.deliver]:bays.filter(x=>x!==a.at&&this.lock[x]==null&&(!docks.includes(x)||x===dock));let opts=[];for(let x of options){let path=this.path(a.at,x,b);if(!path)continue;let deliver=null;
 if(x===dock&&!wantCarry){if(this.lock[otherDock]!=null||!this.path(x,otherDock,b))continue;deliver=otherDock}
 const w=(x===dock?2.6:1)*(1+Math.min(3,(this.clock-(a.last[x]??-100))/40));
 opts.push({x,path,deliver,w})}
 if(!opts.length)return false;
 let t=this.r()*opts.reduce((n,o)=>n+o.w,0);let o=opts.find(e=>(t-=e.w)<=0)||opts.at(-1);if(o.deliver){this.lock[o.deliver]=a.i;a.deliver=o.deliver}
 this.lock[o.x]=a.i;delete this.lock[a.at];this.lane=a.i;a.route=o.path.slice(1);a.goal=o.x;a.kind='travel';a.seg=null;a.work=0;this.event('depart',a.i,o.x);return true}
 walk(a){if(!a.seg){if(!a.route.length){ // settle BOTH soles at the terminal mark, without snapping a swing.
 if(a.swing||a.feet.some((v,i)=>dist(v,[a.p[0]+(i?8:-8),a.p[1]])>1)){this.feet(a,{start:a.p,end:a.p,d:1,ladder:false},1);return}
 this.lane=null;a.at=a.goal;a.goal=null;a.kind='work';a.age=0;a.work=0;a.visits++;a.last[a.at]=this.clock;a.dwell=2.4+this.r()*2.6;a.job=a.at==='desk'?'type':a.at==='blocks'?'stack':a.at==='overlook'?'look':this.plank.owner===a.i?'place':'pick';if(a.job==='stack')this.cube.owner=a.i;this.event('arrive',a.i,a.at);return}
 const to=a.route.shift(),end=this.point(to),start=[...a.p],d=dist(start,end),ladder=[a.node||a.at,to].includes('ladder0')&&[a.node||a.at,to].includes('ladder1');a.seg={from:a.node||a.at,to,start,end,elapsed:0,d,T:Math.max(.4,d/(ladder?68:112)),ladder};a.node=to}
 let g=a.seg;g.elapsed+=dt;let u=clamp(g.elapsed/g.T); // linear core, eased .12-s acceleration/brake per corner
 let k=.14, v=u<k?u*u/(2*k):u>1-k?(1-k)-(1-u)*(1-u)/(2*k):u-k/2; v/=1-k;
 let prev=[...a.p];a.p=[mix(g.start[0],g.end[0],v),mix(g.start[1],g.end[1],v)];let dx=g.end[0]-g.start[0];let target=g.ladder?.18:(dx>=0?1.22:-1.22);a.yaw+=Math.sign(angle(a.yaw,target))*Math.min(Math.abs(angle(a.yaw,target)),dt*3.4);
 a.climb=g.ladder?Math.sin(Math.PI*u):0;a.steps+=dist(prev,a.p);this.feet(a,g,u); if(u===1)a.seg=null}
 feet(a,g,u){ // 2D art-ground contact anchors: only one shoe changes during any swing.
 let dir=[(g.end[0]-g.start[0])/(g.d||1),(g.end[1]-g.start[1])/(g.d||1)];if(!a.swing){if(u===1&&dist(a.feet[a.leg],[a.p[0]+(a.leg?8:-8),a.p[1]])<=1)a.leg=1-a.leg;let i=a.leg,p=a.feet[i],norm=[a.p[0]+(i?8:-8),a.p[1]];if(dist(p,norm)>9||(u===1&&dist(p,norm)>1)){let off=u>.78?0:12,tar=[norm[0]+off*dir[0],norm[1]+off*dir[1],0];a.swing={i,s:[...p],tar,t:0,T:.18};a.leg=1-i}}
 if(a.swing){let s=a.swing;s.t+=dt;let t=clamp(s.t/s.T);a.feet[s.i]=[mix(s.s[0],s.tar[0],sm(t)),mix(s.s[1],s.tar[1],sm(t)),(g.ladder?14:8)*Math.sin(t*Math.PI)];if(t>=1){a.feet[s.i][2]=0;a.swing=null}}}
 tick(){this.clock+=dt;for(let a of this.a){if(a.kind==='travel'){this.walk(a);continue}
 a.age+=dt;if(a.kind==='work'){a.work=clamp(a.age/a.dwell);if(a.job==='pick'&&a.work>=.5&&this.plank.owner===null){if(this.plank.at!==a.at)throw Error('wrong pick');this.plank.owner=a.i;this.plank.at=null;this.event('pickup',a.i,a.at)}
 if(a.job==='place'&&a.work>=.5&&this.plank.owner===a.i){this.plank.owner=null;this.plank.at=a.at;a.deliver=null;this.event('placed',a.i,a.at)}
 if(a.work>=1){if(a.job==='stack'){this.cube.owner=null;this.event('stacked',a.i,a.at)}if(a.job==='type')this.event('typed',a.i,a.at);a.kind='wait';this.queue.push(a.i)} }
 }
 if(this.lane===null){for(let i of [...this.queue]){if(this.choose(this.a[i])){this.queue.splice(this.queue.indexOf(i),1);break}}}}
}
