import {
  Box3, BoxGeometry, CylinderGeometry, Group, LatheGeometry, Matrix3, Matrix4, Mesh, MeshStandardMaterial,
  Quaternion, Raycaster, Vector2, Vector3,
} from './vendor/package/build/three.module.js';

const up = new Vector3(0, 1, 0);
const gripHeight = 22;
const ease = (t, start, end) => {
  const x = Math.max(0, Math.min(1, (t - start) / (end - start)));
  return x*x*(3 - 2*x);
};

function surface(color, roughness, metalness = 0) {
  return new MeshStandardMaterial({color, roughness, metalness});
}
function solid(parent, name, geometry, material, y = 0) {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.y = y;
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function turned(parent, name, profile, material) {
  return solid(parent, name, new LatheGeometry(profile.map(([r,y]) => new Vector2(r,y)), 16), material);
}

function workshopTool() {
  const driver = new Group(), screw = new Group(), slot = new Group();
  driver.name = 'Workshop screwdriver';
  screw.name = 'Recessed screw on the wooden stool leg';
  screw.add(slot);
  const steel = surface(0x989d96, .34, .76);
  const brass = surface(0xb4884f, .42, .58);
  const walnut = surface(0x855529, .51);
  // Local origin is the contact tip. The right palm closes around +Y at 22.
  turned(driver, 'Steel crosspoint and shank', [[0,0],[.49,.49],[.94,2.2],[.94,15.2],[0,15.2]], steel);
  turned(driver, 'Short brass ferrule', [[.95,13.8],[2.3,14],[2.3,16.9],[1.8,17.3],[0,17.3]], brass);
  turned(driver, 'Shaped walnut handle', [[1.7,16.3],[2.45,17],[2.25,18.4],[2.65,20],
    [3.05,23.7],[2.94,26.4],[2.1,28.4],[.8,29],[0,29]], walnut);
  // The screw head is only five source pixels wide on a leg about twenty wide.
  solid(screw, 'Countersunk screw head', new CylinderGeometry(2.5,1.65,.75,16), brass, -.34);
  const dark = surface(0x493d30, .67);
  for (const angle of [0, Math.PI / 2]) {
    const slit = solid(slot, 'Recessed cross slot', new BoxGeometry(.48,.08,2.95), dark, .085);
    slit.rotation.y = angle;
    slit.castShadow = false;
  }
  return {driver, screw, slot};
}

// Fit the hardware to the actual meshes once when constructing a view. This
// also works for a rotated or scaled set. Pass just the seat and the front leg.
export function measureStoolHardware(seat, frontLeg) {
  const caster = new Raycaster();
  function hitSurface(mesh, inside, outward, distance) {
    caster.set(inside.clone().addScaledVector(outward, distance),outward.clone().negate());
    const hit = caster.intersectObject(mesh,true)[0];
    if (!hit?.face) throw new Error('The selected stool part has no surface under its hardware contact');
    const matrix = hit.object.matrixWorld.clone();
    if (hit.object.isInstancedMesh) {
      const instance = new Matrix4();
      hit.object.getMatrixAt(hit.instanceId,instance);
      matrix.multiply(instance);
    }
    const normal = hit.face.normal.clone().applyMatrix3(new Matrix3().getNormalMatrix(matrix)).normalize();
    return {point:hit.point, normal};
  }
  seat.updateWorldMatrix(true,true);
  frontLeg.updateWorldMatrix(true,true);
  const seatBounds = new Box3().setFromObject(seat), legBounds = new Box3().setFromObject(frontLeg);
  const seatSize = seatBounds.getSize(new Vector3()), legSize = legBounds.getSize(new Vector3());
  const center = seatBounds.getCenter(new Vector3());
  // The shaft tip and the widest part of the handle both touch the seat.
  center.x -= .22 * seatSize.x;
  const top = hitSurface(seat,center,up,seatSize.length()+5);
  const along = new Vector3(-.98,0,.2);
  along.addScaledVector(top.normal,-along.dot(top.normal)).normalize();
  const belly = hitSurface(seat,center.clone().addScaledVector(along,23),up,seatSize.length()+5);
  const homeAxis = belly.point.clone().addScaledVector(belly.normal,3).sub(top.point).normalize();
  const intoLeg = legBounds.getCenter(new Vector3());
  const outside = new Vector3(-.78,.08,.62).normalize();
  const screw = hitSurface(frontLeg,intoLeg,outside,legSize.length()+5);
  // The left hand steadies the same timber above the screw. Its contact must
  // follow the splay in depth, which is particularly pronounced in portrait.
  const axis = new Vector3(0,1,0).transformDirection(frontLeg.matrixWorld);
  if (axis.y < 0) axis.negate();
  const higher = intoLeg.clone().addScaledVector(axis,legSize.y * .24 / Math.max(axis.y,.4));
  const brace = hitSurface(frontLeg,higher,new Vector3(-.82,0,.57).normalize(),legSize.length()+5).point;
  return {homeTip:top.point, homeAxis, fastener:screw.point, fastenerAxis:screw.normal, brace};
}

// Markers are in scene/world units in the fixed reference camera. The screw
// normal points outward from the wooden leg, the resting direction runs from
// the shaft tip to the handle, and homeTip is on the top of the stool.
export function createStoolTool(layout, markers = {}, pages = []) {
  const h = layout ? 1659 : 1024;
  const defaultTop = layout ? [688,1321] : [1246,752];
  const defaultLeg = layout ? [646,1386] : [1203,817];
  const point = ([x,y], z) => new Vector3(x,h-y,z);
  const defaultBrace = layout ? [654,1353] : [1210,785];
  const home = (markers.homeTip ?? point(defaultTop,26)).clone();
  const fastener = (markers.fastener ?? point(defaultLeg,31)).clone();
  const brace = (markers.brace ?? point(defaultBrace,28)).clone();
  // Positive Y at the handle lets its belly and the shaft tip rest on the top.
  const restAxis = (markers.homeAxis ?? new Vector3(-.97,.13,.20)).clone().normalize();
  const axis = (markers.fastenerAxis ?? new Vector3(-.70,.45,.55)).clone().normalize();
  const restRotation = new Quaternion().setFromUnitVectors(up,restAxis);
  const workRotation = new Quaternion().setFromUnitVectors(up,axis);
  const ready = fastener.clone().addScaledVector(axis,13);
  const lifted = home.clone().add(new Vector3(-4,7,4));
  const {driver,screw,slot} = workshopTool();
  screw.position.copy(fastener);
  screw.quaternion.copy(workRotation);
  const object = new Group();
  object.name = 'Stool hardware and hand tool';
  object.add(driver, screw);
  const q = new Quaternion();
  const tip = new Vector3();
  const rightPalm = new Vector3();
  const gaze = new Vector3();
  const state = {actor:null, owner:null, phase:'rest', rightPalm, leftPalm:brace,
    rightWeight:0, leftWeight:0, kneel:0, step:[0,0], stepLift:[0,0], grip:0, wristTurn:0, axis: new Vector3(), crouch:0, gaze, gazeWeight:0};

  const pageRay = new Raycaster();
  const down = new Vector3(0,-1,0);
  function stepOnPage(point, dx, dz, lift, weight) {
    if (!weight) return point;
    const stepped = point.clone();
    stepped.x += dx;
    stepped.z += dz;
    if (pages.length) {
      pageRay.set(new Vector3(stepped.x,point.y+320,stepped.z),down);
      const hit = pageRay.intersectObjects(pages,false)[0];
      if (hit) stepped.y += (hit.point.y-point.y)*weight;
    }
    stepped.y += lift;
    return stepped;
  }
  function foot(point,index) {
    const progress = state.step[index] / (index === 0 ? 28 : 15);
    const depth = Math.max(-80,Math.min(48,home.z-point.z));
    return stepOnPage(point,state.step[index] - (index===0?38:0)*state.kneel,depth * (index===0?.83:.68) * progress,
      state.stepLift[index] + (index===0 ? 5*Math.sin(Math.PI*state.kneel) : 0),progress);
  }
  function stance(point) {
    const weight = (state.step[0]/28+state.step[1]/15)/2;
    const depth = Math.max(-80,Math.min(48,home.z-point.z));
    return stepOnPage(point,.59*(state.step[0]+state.step[1])-30*state.kneel,depth*.75*weight,0,weight);
  }
  function sync(city) {
    const index = city?.lock?.stool;
    const worker = index == null ? null : city.a.find(a => a.i === index &&
      a.at === 'stool' && a.kind === 'work' && a.job === 'inspect');
    const t = worker?.work ?? 0;
    state.actor = worker?.i ?? null;
    // Step the near foot in and let the trailing foot follow before reaching.
    // Each shoe settles before the other starts. Reverse the order on exit.
    const firstStep=ease(t,0,.075)*(1-ease(t,.95,1));
    const secondStep=ease(t,.075,.145)*(1-ease(t,.89,.95));
    state.step[0]=firstStep*28;
    state.step[1]=secondStep*15;
    state.stepLift[0]=Math.sin(Math.PI*firstStep)*5;
    state.stepLift[1]=Math.sin(Math.PI*secondStep)*4;
    state.owner = worker && t >= .17 && t < .88 ? worker.i : null;
    state.rightWeight = ease(t,.015,.145) * (1 - ease(t,.90,.99));
    state.leftWeight = ease(t,.17,.39) * (1 - ease(t,.72,.89));
    state.crouch = ease(t,.27,.42) * (1 - ease(t,.71,.81));
    state.kneel = ease(t,.275,.42) * (1 - ease(t,.695,.81));
    state.gazeWeight = ease(t,0,.08) * (1 - ease(t,.90,1));
    const lift = ease(t,.18,.27) * (1 - ease(t,.825,.87));
    const aim = ease(t,.25,.38) * (1 - ease(t,.715,.835));
    const insert = ease(t,.38,.44) * (1 - ease(t,.67,.715));
    const first = ease(t,.45,.53), second = ease(t,.57,.66);
    const reset = ease(t,.53,.57);
    const quarter = Math.PI / 4;
    const spin = quarter * (first + second);
    // The fingers relax briefly while the handle and screw stay still.
    const regrip = ease(t,.525,.54) * (1 - ease(t,.555,.57));
    state.grip = ease(t,.145,.17) * (1 - .35*regrip) * (1 - ease(t,.88,.905));
    state.wristTurn = quarter * (first-reset+second) * aim;
    slot.rotation.y = spin;
    tip.copy(home).lerp(lifted,lift).lerp(ready,aim).lerp(fastener,insert);
    // The leftward arc clears the seat rim when lowering to the leg screw.
    const arc = 4 * aim * (1-aim);
    tip.x -= 13 * arc; tip.y += 6 * arc; tip.z += 8 * arc;
    driver.position.copy(tip);
    driver.quaternion.copy(restRotation).slerp(workRotation,aim);
    state.axis.copy(up).applyQuaternion(driver.quaternion);
    driver.quaternion.multiply(q.setFromAxisAngle(up,spin * aim));
    rightPalm.copy(up).multiplyScalar(gripHeight).applyQuaternion(driver.quaternion).add(tip);
    gaze.copy(home).lerp(fastener,aim);
    state.phase = !worker || t === 1 ? 'rest'
      : t < .17 ? 'reach' : t < .38 ? 'lift and aim' : t < .44 ? 'seat tip'
      : t < .67 ? 'turn' : t < .715 ? 'withdraw' : t < .88 ? 'return' : 'release';
    return state;
  }
  sync(null);
  return {object, sync, driver, screw, foot, stance};
}
