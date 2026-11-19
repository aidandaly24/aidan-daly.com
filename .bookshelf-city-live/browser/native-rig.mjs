import { Euler, Group, Quaternion, Vector3 } from './vendor/package/build/three.module.js';

const up = new Vector3(0, 1, 0);
const point = object => object.getWorldPosition(new Vector3());
const orientation = object => object.getWorldQuaternion(new Quaternion());

function orient(object, worldRotation) {
  object.quaternion.copy(orientation(object.parent).invert().multiply(worldRotation));
}

function aim(bone, child, target) {
  const origin = point(bone);
  const from = point(child).sub(origin).normalize();
  const to = target.clone().sub(origin).normalize();
  orient(bone, new Quaternion().setFromUnitVectors(from, to).multiply(orientation(bone)));
}

function solve(chain, end, bend, bendDirection, directionWeight) {
  const origin = point(chain.upper);
  const direction = end.clone().sub(origin);
  if (direction.lengthSq() < 1e-10) direction.copy(point(chain.tip).sub(origin));
  const distance = Math.max(Math.abs(chain.a - chain.b) + .001,
    Math.min(chain.a + chain.b - .001, direction.length()));
  direction.normalize();
  const pole = bend.clone().sub(origin);
  if (bendDirection) pole.normalize().lerp(bendDirection, directionWeight);
  pole.addScaledVector(direction, -pole.dot(direction));
  if (pole.lengthSq() < 1e-8) {
    pole.set(0, 0, 1);
    if (Math.abs(pole.dot(direction)) > .99) pole.set(1, 0, 0);
    pole.addScaledVector(direction, -pole.dot(direction));
  }
  const along = (chain.a ** 2 - chain.b ** 2 + distance ** 2) / (2 * distance);
  const middle = origin.clone().addScaledVector(direction, along)
    .addScaledVector(pole.normalize(), Math.sqrt(Math.max(0, chain.a ** 2 - along ** 2)));
  aim(chain.upper, chain.lower, middle);
  aim(chain.lower, chain.tip, origin.addScaledVector(direction, distance));
}

// The export uses Blender bone names. GLTFLoader preserves those in userData
// even when it removes punctuation from Object3D.name for animation binding.
export function bindAidan(model, height) {
  const body = new Group();
  body.add(model);
  const objects = new Map();
  model.traverse(node => objects.set(node.userData.name || node.name, node));
  function need(name) {
    const node = objects.get(name);
    if (!node) throw Error('Aidan export is missing ' + name);
    return node;
  }
  const hip = need('hips'), chest = need('chest'), head = need('head');
  const soles = ['R', 'L'].map(side => need('contact_sole_' + side));
  const stature = point(need('contact_crown')).y - Math.min(...soles.map(sole => point(sole).y));
  if (!(stature > 0)) throw Error('Aidan has invalid rest-pose height.');
  body.scale.setScalar(height / stature);
  const forward = point(need('toe.L')).sub(point(need('foot.L')));
  const restYaw = Math.atan2(forward.x, forward.z);
  function chain(names, marker, side) {
    const [upper, lower, tip] = names.map(name => need(name + '.' + side));
    const anchor = need('contact_' + marker + '_' + side);
    const a = point(upper).distanceTo(point(lower)), b = point(lower).distanceTo(point(tip));
    if (!(a > 0 && b > 0)) throw Error('Degenerate limb on ' + upper.name);
    return { upper, lower, tip, anchor, a, b, restA: a, restB: b, rest: orientation(tip),
      offset: point(anchor).sub(point(tip)).applyQuaternion(orientation(tip).invert()) };
  }
  const arms = ['R', 'L'].map(side => chain(['upper_arm', 'forearm', 'hand'], 'palm', side));
  const legs = ['R', 'L'].map(side => chain(['thigh', 'shin', 'foot'], 'sole', side));
  const driven = [chest, head, ...arms.concat(legs).flatMap(c => [c.upper, c.lower, c.tip])];
  const neutral = driven.map(bone => bone.quaternion.clone());
  const chestRest = orientation(chest), headRest = orientation(head);

  function sync(pose) {
    driven.forEach((bone, i) => bone.quaternion.copy(neutral[i]));
    body.scale.setScalar(height * pose.size / stature);
    body.position.set(0, 0, 0);
    body.rotation.y = pose.yaw - restYaw;
    const yaw = body.quaternion;
    body.position.copy(pose.hip.clone().sub(point(hip)));
    const tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), pose.lean);
    orient(chest, yaw.clone().multiply(tilt).multiply(chestRest));
    const glance = new Quaternion().setFromEuler(new Euler(pose.head.x,
      pose.head.y - pose.yaw, pose.head.z, 'YXZ'));
    orient(head, yaw.clone().multiply(glance).multiply(headRest));

    function goal(c, contact, bend, pitch, weight) {
      c.a = c.restA * pose.size;
      c.b = c.restB * pose.size;
      const rotation = yaw.clone().multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0), pitch)).multiply(c.rest);
      const end = contact.clone().sub(c.offset.clone().multiplyScalar(pose.size).applyQuaternion(rotation));
      return { chain: c, end, bend, rotation, weight, root: point(c.upper) };
    }
    const goals = arms.map((c, i) => ({
      ...goal(c, pose.palms[i], pose.elbows[i], pose.wristPitch, pose.handContact),
      bendDirection: pose.elbowDirections?.[i],
    }));
    legs.forEach((c, i) => goals.push(goal(c, pose.soles[i], pose.knees[i], 0, 1)));
    // Find the closest usable pelvis position for the planted soles and hands.
    // Each fixed-length chain gives a sphere of reachable root translations.
    const shift = new Vector3();
    for (let pass = 0; pass < 20; pass++) {
      let largest = 0;
      for (const g of goals) {
        if (!g.weight) continue;
        const toward = g.end.clone().sub(g.root).sub(shift);
        const length = toward.length(), excess = length - (g.chain.a + g.chain.b - .01);
        if (excess <= 0) continue;
        const correction = excess * g.weight;
        shift.addScaledVector(toward, correction / length);
        largest = Math.max(largest, correction);
      }
      if (largest < .001) break;
    }
    body.position.add(shift);
    for (const g of goals) {
      solve(g.chain, g.end, g.bend, g.bendDirection, pose.elbowDirectionWeight);
      orient(g.chain.tip, g.rotation);
    }
  }
  return {body, sync, palms: arms.map(c => c.anchor), soles};
}
