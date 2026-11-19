import {createStoolTool, measureStoolHardware} from './stool-tool.mjs';
import * as T from './vendor/package/build/three.module.js';
import{nodes,mix,sm}from'./city.mjs';
import { bindSetContacts } from './contact-support.mjs';
import { fitCarriedProp } from './contact-depth.mjs';
import { ramp, window, turnDelta } from './motion.mjs';
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
let nativeActors, ground, stoolTool;
const carryFrame = new T.Object3D();
const supportMotion = [{}, {}];
function setActors(actors) {
  nativeActors = actors;
  for (const [i, actor] of actors.entries()) {
    scene.add(actor.body);
    figs[i].base.visible = false;
  }
}
const deck=p=>V(p[0],h-p[1],16),deskHands=l?[[335,1145],[365,1148]]:[[317,767],[347,771]];
const board=createMaplePlank();scene.add(board);const {mesh:roof,home:roofRest,grips:roofGrips}=createArchRoof(l,h,redraw);scene.add(roof);
let shadows=[0,1].map(()=>ell(scene,0xa08b70,[24,2.4,5]));function dockP(at) {
  const p=nodes[at][l];
  const base=ground?.at(at,-8,3) ?? V(p[0]-8,h-p[1],19);
  return base.add(V(0,plankDimensions.y/2,0));
}
function setEnvironment(set) {
  scene.add(set);
  ground=bindSetContacts(set,l);
  const seat = set.getObjectByName('Stool top'), leg = set.getObjectByName('Splayed stool leg');
  stoolTool = createStoolTool(l,measureStoolHardware(seat,leg),
    set.getObjectsByProperty('name','Notebook writing surface'));
  scene.add(stoolTool.object);
  shadows.forEach(shadow=>{shadow.visible=false;});
  roof.geometry.computeBoundingBox();
  roofRest.copy(ground.anchor('roof',roofRest,'blocks'));
  roofRest.y-=roof.geometry.boundingBox.min.y;
  roof.position.copy(roofRest);
}

function sync(c){const stool = stoolTool?.sync(c);let own=c.plank.owner;let actorHands=[];for(let a of c.a){let f=figs[a.i],isWork=a.kind==='work',t=isWork?a.work:0,pres=env(t),carry=own===a.i;
const typing=isWork&&a.job==='type';
const seated=typing?window(t,.045,.195,.81,.95):0;
const brace=typing?window(t,0,.085,.94,1):0;
const keyboard=typing?window(t,.15,.21,.80,.88):0;
const build=isWork&&a.job==='stack'?window(t,.015,.21,.83,.99):0;
const repairing = stool && stool.actor === a.i ? stool : null;
const inspect = repairing?.crouch ?? (isWork&&a.job==='inspect'?window(t,.035,.21,.80,.98):0);
const travelling=a.kind==='travel';
const support=travelling?(a.support??0):0;
const stride=travelling?(a.gait??0):0;
const roll=travelling?2.8*stride:Math.sin(c.clock*1.7+a.i)*.65;
let d=ground?.actor(a) ?? deck(a.p),turn=a.yaw;
const bodyMotion=supportMotion[a.i];
const elapsed=c.clock-(bodyMotion.time ?? c.clock);
const filter=elapsed<=0 || elapsed>.4 ? 1 : 1-Math.exp(-elapsed*12);
const floorOffset=d.y-(h-a.p[1]);
bodyMotion.rise=mix(bodyMotion.rise??floorOffset,floorOffset,filter);
d.y=h-a.p[1]+bodyMotion.rise;
if (repairing) d=stoolTool.stance(d);
let faceOffset=0;
if (l && a.seg && [a.seg.from,a.seg.to].includes('notebook') &&
    [a.seg.from,a.seg.to].includes('floor')) {
  // This route runs into or out of the page in depth; it has no screen-X heading.
  faceOffset=turnDelta(a.yaw,a.seg.to==='notebook'?0:Math.PI);
}
const stepTurn=turnDelta(bodyMotion.turn??0,faceOffset);
bodyMotion.turn=(bodyMotion.turn??0)+stepTurn*filter;
bodyMotion.time=c.clock;
turn+=bodyMotion.turn;
if(isWork){
  const aim=a.job==='type'?1.07:a.job==='stack'?-1.08:a.job==='look'?-.8:repairing?Math.atan2(repairing.gaze.x-d.x,repairing.gaze.z-d.z):a.job==='inspect'?1.05:a.yaw;
  turn+=turnDelta(turn,aim)*pres;
}
let rt=V(Math.cos(turn),0,-Math.sin(turn)),fw=V(Math.sin(turn),0,Math.cos(turn));
const travelSoles=travelling && ground ? a.feet.map((_,i)=>ground.sole(a,i,i?9:-9)) : null;
if (travelSoles?.every(Boolean)) {
  const middle=blend(travelSoles[0],travelSoles[1],.5);
  d.x=mix(d.x,middle.x,.46);
  d.z=mix(d.z,middle.z,.52*(1-(a.climb??0)));
}
const desk = nodes.desk[l], floor = nodes.floor[l];
const toDesk = Math.hypot(a.p[0]-desk[0],a.p[1]-desk[1]);
const deskApproach = 1 - sm(clamp(toDesk / Math.hypot(floor[0]-desk[0],floor[1]-desk[1])));
const actorSize=1+.58*deskApproach;
const aboveFeet=h-nodes.ladder1[l][1]-d.y;
const aboveLanding=d.y-(h-nodes.ladder0[l][1]);
const climbGrip=(a.climb??0)*ramp(aboveFeet,28,95)*ramp(aboveLanding,0,40);
const hipHeight=repairing ? 96 : 79*actorSize;
let hip=d.clone().add(V(0,hipHeight+roll,0)).addScaledVector(rt,support*6);
let seat=l?V(301,h-1191,18):V(285,h-815,17);
if(ground) seat=ground.anchor('seat',seat,'desk');
hip.lerp(seat,seated);
hip.x-=build*2;
hip.z-=build*6;
hip.y-=build*19;
hip.addScaledVector(fw,inspect*14);
hip.y-=inspect*55;
const lean=seated*4+build*9+inspect*10;
const shoulder=hip.clone().add(V(0,69+seated*25,0)).addScaledVector(fw,lean);
const head=shoulder.clone().add(V(0,31+seated*14,0)).addScaledVector(fw,4);
const survey=a.job==='look'&&isWork?.52*(ramp(t,.08,.30)-2*ramp(t,.36,.63)+ramp(t,.73,.98)):0;
let gaze=travelling?(a.gaze??a.yaw)+bodyMotion.turn:turn+survey;
const handling=isWork&&['pick','place'].includes(a.job);
let downward=keyboard*.18+build*.21+inspect*.30+(handling?pres*.22:0);
if (repairing) {
  const toTarget = repairing.gaze.clone().sub(head);
  gaze += T.MathUtils.clamp(turnDelta(gaze,Math.atan2(toTarget.x,toTarget.z)),-.64,.64)*repairing.gazeWeight;
  const tilt = Math.atan2(-toTarget.y,Math.hypot(toTarget.x,toTarget.z));
  downward = mix(downward,T.MathUtils.clamp(tilt,.05,.68),repairing.gazeWeight);
}
f.hip.position.copy(hip);f.hip.rotation.y=turn;f.torso.position.copy(blend(hip,shoulder,.52));f.torso.scale.y=shoulder.distanceTo(hip)*.57;f.torso.rotation.y=turn;f.neck.position.copy(shoulder).add(V(0,8,0));f.head.position.copy(head);f.head.rotation.set(-.05+downward+((a.climb??0)*-.20),gaze,.015*Math.sin(c.clock*1.2)-support*.045);shadows[a.i].position.copy(d).add(V(1,0,-10));
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
let roofMove=build>0 ? ramp(t,.22,.45)*(1-ramp(t,.54,.82)) : 0;let roofP=roofRest.clone().add(V(14*roofMove,32*roofMove,0));
for(let i of[0,1]){let s=i?1:-1,leg=f.legs[i],arm=f.arms[i],H=hip.clone().addScaledVector(rt,11*s),foot=a.feet[i];
const pitch=a.footPitch?.[i]??0;
const soleTarget=l?(i?[368,1287]:[337,1275]):(i?[340,914]:[317,906]);
let planted=travelSoles?.[i] ?? ground?.sole(a,i,9*s) ?? V(foot[0],h-foot[1]+foot[2],d.z+9*s);
if (repairing) planted=stoolTool.foot(planted,i);
const F=planted.add(V(0,5+Math.abs(Math.sin(pitch))*9,0));
if(brace) {
  const seatSole=ground?.sample(soleTarget,'desk','desk',-38+9*s)?.point ??
    V(soleTarget[0],h-soleTarget[1],16+9*s);
  F.lerp(seatSole.add(V(0,5,0)),brace);
}
let K=joint(H,F,fw.clone().add(V(0,0,.25)),53,53);
// The original seated illustration has roughly level thighs and shins
// descending to the floor. Use its centers in each registered composition.
const seatedKnee=l?(i?[361,1187]:[342,1186]):(i?[341,816]:[322,815]);
leg.knee.copy(K).lerp(V(seatedKnee[0],h-seatedKnee[1],F.z),seated);
if (repairing && i===0) {
  leg.knee.lerp(planted.clone().add(V(24,3,8)),repairing.kneel);
}
leg.sole.copy(F);leg.sole.y-=5;
leg.thigh(H,leg.knee);leg.shin(leg.knee,F);leg.shoe.position.copy(F).addScaledVector(fw,5);leg.shoe.rotation.set(pitch,turn,0,'YXZ');
const S=shoulder.clone().addScaledVector(rt,17*s);
const hand=hip.clone().addScaledVector(rt,21*s).addScaledVector(fw,16*support*s).add(V(0,9+3*stride,0));
if(climbGrip>.001){
  // Match the opposite foot's progression up or down the rung, keeping the
  // other hand on its previous rung while that foot and hand are in flight.
  const rung=a.feet[1-i];
  const lower=nodes.ladder0[l], upper=nodes.ladder1[l];
  const rungHeight=(lower[1]-upper[1])/6;
  const palmY=Math.max(upper[1]-5,rung[1]-4.9*rungHeight);
  const railX=mix(lower[0],upper[0],clamp((lower[1]-palmY)/(lower[1]-upper[1])));
  const contact=ground?.rung([railX,palmY],12*s) ?? V(railX+12*s,h-palmY,9);
  contact.y+=rung[2]*.35;
  hand.lerp(contact,climbGrip);
}
const tip=deskHands[i];
const typingPulse=keyboard*(typing?ramp(t,.215,.25):0);
const tipPose=V(tip[0],h-tip[1],28+i*3);
const keyTarget=ground?.anchor('keyboard'+i,tipPose,'desk') ?? tipPose;
keyTarget.x+=Math.sin(t*48+i)*3*typingPulse;
keyTarget.y+=Math.max(0,Math.sin(t*67+i*3))*3*typingPulse;
hand.lerp(keyTarget,keyboard);
if (repairing) {
  hand.lerp(i === 0 ? repairing.rightPalm : repairing.leftPalm,
    i === 0 ? repairing.rightWeight : repairing.leftWeight);
} else if (inspect) {
  // Brace one hand at the front rim and run the other along the stool top.
  const contact = (ground?.anchor('stool',stoolContact,'stool') ?? stoolContact.clone()).add(V(i ? 12 + 11 * Math.sin(t * Math.PI * 4) : 1, i ? 4 : -2, i ? -9 : -2));
  hand.lerp(contact, inspect);
}
let onRoof=build;hand.lerp(roofP.clone().add(roofGrips[i]),onRoof);
if(carry||isWork&&['pick','place'].includes(a.job)){let w=carry?1:window(t,.04,.21,.82,.99);hand.lerp(boardHand.clone().add(palmOffsets[i].clone().applyAxisAngle(Y,propYaw)),w)}
let E=joint(S,hand,fw.clone().multiplyScalar(-.38).addScaledVector(rt,s*.5).add(V(0,-.7,0)),42,42);arm.elbow.copy(E);arm.upper(S,E);arm.lower(E,hand);arm.p.position.copy(hand);arm.p.rotation.y=turn}
if (nativeActors) {
  const gripWeight = carry ? 1 : handling ? window(t,.04,.21,.82,.99) : 0;
  // Use a direction from the real shoulder. The mechanics stand-in's
  // shoulder height can put its elbow target above or inside the real arm.
  const elbowDirections = [-1, 1].map(side =>
    rt.clone().multiplyScalar(side * .75).addScaledVector(fw, -.28).add(V(0, -1, 0)).normalize());
  const elbowDirectionWeight = 1 - Math.max(build, inspect, a.climb);
  const contact = Math.max(gripWeight,keyboard,build,repairing?.rightWeight??inspect,climbGrip);
  const relaxed = 1-contact;
  const freeHands = f.arms.map((arm, i) => {
    const palm = arm.p.position.clone();
    return palm.add(V(0, -19 * relaxed, 0)).addScaledVector(rt, (i ? 1 : -1) * 7 * relaxed);
  });
  nativeActors[a.i].sync({
    size: actorSize, yaw: turn, hip, head: f.head.rotation,
    lean: seated*.22+build*.18+inspect*.58+low*.95+stride*.075+(a.climb??0)*.16,
    twist: carry ? support*.045 : support*.17, bank: support*.085,
    footPitch: a.footPitch,
    palms: freeHands, elbows: f.arms.map(arm => arm.elbow), elbowDirections, elbowDirectionWeight,
    soles: f.legs.map(leg => leg.sole), knees: f.legs.map(leg => leg.knee),
    handContact: contact, wristPitch: -1.2*contact,
    toolTurn: repairing?.wristTurn, toolAxis: repairing?.axis,
  });
}
if(isWork&&a.job==='stack')roof.position.copy(roofP);f.grip.position.copy(f.arms[1].p.position);f.grip.rotation.set(0,propYaw,0);
if(carry && nativeActors && ground) {
  fitCarriedProp(nativeActors[a.i].palms,palmOffsets,propYaw,carryFrame);
  f.grip.quaternion.copy(carryFrame.quaternion);
  f.grip.position.copy(carryFrame.position).add(palmOffsets[1].clone().applyQuaternion(f.grip.quaternion));
}
actorHands[a.i]=f.grip}
if(c.cube.owner===null)roof.position.copy(roofRest);
if(own!=null){if(board.parent!==actorHands[own])actorHands[own].add(board);board.position.copy(palmOffsets[1]).negate();board.rotation.y=0}else{if(board.parent!==scene)scene.add(board);board.position.copy(dockP(c.plank.at));board.rotation.y=dockYaw}
scene.updateMatrixWorld(true)}
return{scene,cam,sync,setActors,setEnvironment,get ground(){return ground},w,h,board,roof,roofGrips,figs}}
