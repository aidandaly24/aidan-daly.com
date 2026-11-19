import * as T from './vendor/package/build/three.module.js';
import{nodes,mix,sm}from'./city.mjs';
import {createArchRoof} from './arch-roof.mjs';
import {createMaplePlank, palmOffsets, plankDimensions} from './plank.mjs';
const dockYaw = -.19;
const clamp=v=>Math.max(0,Math.min(1,v)),V=(x,y,z=0)=>new T.Vector3(x,y,z),blend=(a,b,t)=>a.clone().lerp(b,t),env=t=>sm(clamp(t/.16))*sm(clamp((1-t)/.18));
const globe=new T.SphereGeometry(1,10,7),tube=new T.CylinderGeometry(1,.90,1,8), Y=V(0,1,0),matCache=new Map;
function material(c){if(!matCache.has(c))matCache.set(c,new T.MeshLambertMaterial({color:c}));return matCache.get(c)}
function piece(p,g,c,s){let m=new T.Mesh(g,material(c));p.add(m);m.scale.set(...s);return m}
function ell(p,c,s){return piece(p,globe,c,s)}
function line(p,c,r){let m=piece(p,tube,c,[r,1,r]);return(a,b)=>{m.position.copy(blend(a,b,.5));m.quaternion.setFromUnitVectors(Y,b.clone().sub(a).normalize());m.scale.y=a.distanceTo(b)}}
function joint(a,b,pole,r1,r2){let d=b.clone().sub(a),u=d.length();if(u<.001)return a.clone();d.divideScalar(u);let w=pole.clone().sub(d.clone().multiplyScalar(pole.dot(d))).normalize();let v=Math.max(-r1,Math.min(r1,(r1*r1-r2*r2+u*u)/(2*u)));return a.clone().addScaledVector(d,v).addScaledVector(w,Math.sqrt(Math.max(0,r1*r1-v*v)))}
function makeFigure(scene){let base=new T.Group;scene.add(base);const skin=0xe4b28a,shirt=0x647b6a,pant=0x354c61,hair=0x493528;
let torso=ell(base,shirt,[23,38,15]),hip=ell(base,pant,[21,13,14]),neck=ell(base,skin,[8,11,8]),head=new T.Group;base.add(head);
let face=ell(head,skin,[20,24,18]);let cap=ell(head,hair,[21,14,19]);cap.position.set(0,15,-1);
for(let [x,y,z]of [[-15,11,8],[-9,18,13],[1,20,13],[11,16,11],[17,10,3]]){let q=ell(head,hair,[8,8,6]);q.position.set(x,y,z)}
for(let s of [-1,1]){let e=ell(head,0x2e2b24,[1.8,2.8,1.5]);e.position.set(s*8,3,16.5);let ear=ell(head,skin,[3,6,3]);ear.position.set(s*19,1,0)}
let nose=ell(head,skin,[3.2,3,4]);nose.position.set(0,-1,19);
let arms=[0,1].map(()=>({elbow:V(0,0,0),upper:line(base,shirt,8),lower:line(base,skin,6),p:ell(base,skin,[6.9,5.2,6.1])}));let legs=[0,1].map(()=>({sole:V(0,0,0),knee:V(0,0,0),thigh:line(base,pant,10),shin:line(base,pant,8),shoe:ell(base,0xe4daca,[9,5.5,16])}));
let grip=new T.Group;scene.add(grip);return{base,torso,hip,neck,head,arms,legs,grip}}
export function createView(l,redraw){let[w,h]=l?[948,1659]:[1536,1024],scene=new T.Scene,cam=new T.OrthographicCamera(0,w,h,0,1,2600);cam.position.z=900;cam.updateMatrixWorld();scene.add(new T.AmbientLight(0xfff5e8,1.12));let sun=new T.DirectionalLight(0xfff0da,1.18);sun.position.set(-230,420,670);scene.add(sun);let figs=[makeFigure(scene),makeFigure(scene)];
const stoolContact=l?V(644,h-1328,29):V(1201,h-764,29);
let nativeActors;
function setActors(actors) {
  nativeActors = actors;
  for (const [i, actor] of actors.entries()) {
    scene.add(actor.body);
    figs[i].base.visible = false;
  }
}
const deck=p=>V(p[0],h-p[1],16),deskHands=l?[[335,1145],[365,1148]]:[[317,767],[347,771]];
const board=createMaplePlank();scene.add(board);const {mesh:roof,home:roofRest,grips:roofGrips}=createArchRoof(l,h,redraw);scene.add(roof);
let shadows=[0,1].map(()=>ell(scene,0xa08b70,[24,2.4,5]));function dockP(at){let p=nodes[at][l];return V(p[0]-8,h-p[1]+plankDimensions.y/2,19)}
function sync(c){let own=c.plank.owner;let actorHands=[];for(let a of c.a){let f=figs[a.i],isWork=a.kind==='work',t=isWork?a.work:0,pres=env(t),seated=isWork&&a.job==='type'?pres:0,build=isWork&&a.job==='stack'?pres:0,carry=own===a.i,inspect=isWork&&a.job==='inspect'?pres:0;
let roll= a.kind==='travel'?Math.sin(a.steps/14)*1.8:Math.sin(c.clock*1.7+a.i)*.65;
let d=deck(a.p),turn=a.yaw;if(isWork){let aim=a.job==='type'?1.07:a.job==='stack'?-1.08:a.job==='look'?-.8:a.job==='inspect'?1.05:a.yaw;turn=mix(turn,aim,pres)}
let rt=V(Math.cos(turn),0,-Math.sin(turn)),fw=V(Math.sin(turn),0,Math.cos(turn)),hip=d.clone().add(V(0,96+roll,0));let seat=l?V(301,h-1191,18):V(285,h-815,17);hip.lerp(seat,seated);hip.x-=build*2;hip.z-=build*6;hip.y-=build*19;hip.addScaledVector(fw,inspect*14);hip.y-=inspect*20;
let shrug=build*8,lean=seated*4+build*9+inspect*10,shoulder=hip.clone().add(V(0,69+seated*25,0)).addScaledVector(fw,lean);
let head=shoulder.clone().add(V(0,31+seated*14,0)).addScaledVector(fw,4);
f.hip.position.copy(hip);f.hip.rotation.y=turn;f.torso.position.copy(blend(hip,shoulder,.52));f.torso.scale.y=shoulder.distanceTo(hip)*.57;f.torso.rotation.y=turn;f.neck.position.copy(shoulder).add(V(0,8,0));f.head.position.copy(head);f.head.rotation.set(-.05-seated*.12+build*.07+inspect*.24,turn+(a.job==='look'&&isWork?pres*Math.sin(t*Math.PI*2)*.47:0),.015*Math.sin(c.clock*1.2));shadows[a.i].position.copy(d).add(V(1,0,-10));
let actionGrip=d.clone().addScaledVector(fw,25).add(V(0,105+roll,6));let boardHand=actionGrip.clone();
if(a.job==='pick'&&isWork){let reach=sm(clamp((t-.22)/.28));let up=sm(clamp((t-.5)/.35));boardHand=blend(blend(actionGrip,dockP(a.at),reach),actionGrip,up)}
if(a.job==='place'&&isWork){let down=sm(clamp(t/.5));let back=sm(clamp((t-.5)/.32));boardHand=blend(blend(actionGrip,dockP(a.at),down),actionGrip,back)}
// Bend the torso while reaching deck level; shoe anchors remain at contact.
let low=isWork&&['pick','place'].includes(a.job)?Math.min(1,Math.max(0,(actionGrip.y-boardHand.y)/100)):0;
if(low){let drop=V(0,-62*low,0).addScaledVector(fw,13*low);for(let ob of [f.hip,f.neck,f.head,f.torso])ob.position.add(drop);hip.add(drop);shoulder.add(drop)}
// Lead with the opposite end on the return trip so the cross-body plank
// remains visible in both directions through the fixed camera.
const leadingSide = T.MathUtils.clamp(turn / .6, -1, 1);
const carryYaw = turn - leadingSide * Math.atan2(.44, .90);
let dockTurn = 0;
if (isWork && a.job === 'pick') {
  dockTurn = sm(clamp((t - .22) / .28)) * (1 - sm(clamp((t - .5) / .35)));
} else if (isWork && a.job === 'place') {
  dockTurn = sm(clamp(t / .5));
}
const propYaw = carryYaw + dockTurn * Math.atan2(Math.sin(dockYaw - carryYaw), Math.cos(dockYaw - carryYaw));
let roofMove=isWork&&a.job==='stack'?Math.sin(Math.PI*clamp((t-.22)/.60)):0;let roofP=roofRest.clone().add(V(14*roofMove,32*roofMove,0));
for(let i of[0,1]){let s=i?1:-1,leg=f.legs[i],arm=f.arms[i],H=hip.clone().addScaledVector(rt,11*s),foot=a.feet[i];
let F=V(foot[0],h-foot[1]+foot[2]+5,16+9*s),soleTarget=l?(i?[391,1287]:[346,1275]):(i?[372,914]:[333,906]);F.lerp(V(soleTarget[0],h-soleTarget[1]+5,16+9*s),seated);let K=joint(H,F,fw.clone().add(V(0,0,.25)),53,53);
// The original seated illustration has roughly level thighs and shins
// descending to the floor. Use its centers in each registered composition.
const seatedKnee=l?(i?[361,1187]:[342,1186]):(i?[341,816]:[322,815]);
leg.knee.copy(K).lerp(V(seatedKnee[0],h-seatedKnee[1],F.z),seated);
leg.sole.copy(F);leg.sole.y-=5;
leg.thigh(H,leg.knee);leg.shin(leg.knee,F);leg.shoe.position.copy(F).addScaledVector(fw,5);leg.shoe.rotation.y=turn;
let S=shoulder.clone().addScaledVector(rt,17*s),hand=hip.clone().addScaledVector(rt,21*s).addScaledVector(fw,Math.sin(a.steps/17+Math.PI*i)*(a.kind==='travel'?17:2)).add(V(0,9,0));if(a.climb)hand.add(V(0,(40+21*s*Math.sin(a.steps/14))*a.climb,0));
let tip=deskHands[i];hand.lerp(V(tip[0]+Math.sin(t*48+i)*4,h-tip[1]+Math.max(0,Math.sin(t*67+i*3))*4,28+i*3),seated);
if (inspect) {
  // Brace one hand at the front rim and run the other along the stool top.
  const contact = stoolContact.clone().add(V(i ? 12 + 11 * Math.sin(t * Math.PI * 4) : 1, i ? 4 : -2, i ? -9 : -2));
  hand.lerp(contact, inspect);
}
let onRoof=build*sm(clamp((t-.06)/.16))*sm(clamp((.97-t)/.15));hand.lerp(roofP.clone().add(roofGrips[i]),onRoof);
if(carry||isWork&&['pick','place'].includes(a.job)){let w=carry?1:pres;hand.lerp(boardHand.clone().add(palmOffsets[i].clone().applyAxisAngle(Y,propYaw)),w)}
let E=joint(S,hand,fw.clone().multiplyScalar(-.38).addScaledVector(rt,s*.5).add(V(0,-.7,0)),42,42);arm.elbow.copy(E);arm.upper(S,E);arm.lower(E,hand);arm.p.position.copy(hand);arm.p.rotation.y=turn}
if (nativeActors) {
  const handling = carry ? 1 : isWork && ['pick','place'].includes(a.job) ? pres : 0;
  const desk = nodes.desk[l], floor = nodes.floor[l];
  const toDesk = Math.hypot(a.p[0]-desk[0],a.p[1]-desk[1]);
  const deskApproach = 1 - sm(clamp(toDesk / Math.hypot(floor[0]-desk[0],floor[1]-desk[1])));
  // Use a direction from the real shoulder. The mechanics stand-in's
  // shoulder height can put its elbow target above or inside the real arm.
  const elbowDirections = [-1, 1].map(side =>
    rt.clone().multiplyScalar(side * .75).addScaledVector(fw, -.28).add(V(0, -1, 0)).normalize());
  const elbowDirectionWeight = 1 - Math.max(build, inspect, a.climb);
  const relaxed = 1 - Math.max(handling, seated, build, inspect, a.climb);
  const freeHands = f.arms.map((arm, i) => {
    const palm = arm.p.position.clone();
    return palm.add(V(0, -19 * relaxed, 0)).addScaledVector(rt, (i ? 1 : -1) * 7 * relaxed);
  });
  nativeActors[a.i].sync({
    size: 1 + .58*deskApproach, yaw: turn, hip, head: f.head.rotation,
    lean: seated*.22+build*.18+inspect*.58+low*.95,
    palms: freeHands, elbows: f.arms.map(arm => arm.elbow), elbowDirections, elbowDirectionWeight,
    soles: f.legs.map(leg => leg.sole), knees: f.legs.map(leg => leg.knee),
    handContact: Math.max(handling,seated,build,inspect), wristPitch: -1.2*Math.max(handling,seated,build,inspect),
  });
}
if(isWork&&a.job==='stack')roof.position.copy(roofP);f.grip.position.copy(f.arms[1].p.position);f.grip.rotation.y=propYaw;actorHands[a.i]=f.grip}
if(c.cube.owner===null)roof.position.copy(roofRest);
if(own!=null){if(board.parent!==actorHands[own])actorHands[own].add(board);board.position.copy(palmOffsets[1]).negate();board.rotation.y=0}else{if(board.parent!==scene)scene.add(board);board.position.copy(dockP(c.plank.at));board.rotation.y=dockYaw}
scene.updateMatrixWorld(true)}
return{scene,cam,sync,setActors,w,h,board,roof,roofGrips,figs}}
