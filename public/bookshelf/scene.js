// Scene coordinates are normalized so the artwork, companion and future
// independently rendered character layers can share one responsive layout.
export const LAYOUTS = {
  desktop: {
    aspect: 1.5,
    agent: {x: .253, y: .607, radiusX: .030, radiusY: .024},
    screen: {x: .245, y: .675, width: .078, height: .073},
    scenes: [
      {id:'coding', name:'The coding nook', x:.17, y:.75},
      {id:'bridge', name:'Building the bridge', x:.53, y:.51},
      {id:'blocks', name:'A little block house', x:.81, y:.43},
      {id:'workshop', name:'The notebook workshop', x:.76, y:.77},
    ],
  },
  portrait: {
    aspect: 4/7,
    agent: {x: .433, y: .596, radiusX: .047, radiusY: .020},
    screen: {x: .414, y: .643, width: .125, height: .056},
    scenes: [
      {id:'coding', name:'The coding nook', x:.30, y:.68},
      {id:'bridge', name:'Building the bridge', x:.45, y:.43},
      {id:'blocks', name:'A little block house', x:.75, y:.36},
      {id:'workshop', name:'The notebook workshop', x:.65, y:.82},
    ],
  },
};

export const clamp = (value,min,max) => Math.min(max,Math.max(min,value));

export function agentPose(seconds,layout='desktop',resting=false,pointer={x:0,y:0}) {
  const a=LAYOUTS[layout].agent;
  if(resting)return{x:a.x,y:a.y,tilt:-7,scale:1};
  const phase=seconds*Math.PI*2/9;
  return {
    x:a.x+Math.sin(phase)*a.radiusX+clamp(pointer.x,-1,1)*.006,
    y:a.y-Math.cos(phase)*a.radiusY+Math.sin(phase*2)*.004+clamp(pointer.y,-1,1)*.003,
    tilt:Math.cos(phase)*11,
    scale:1+Math.sin(phase)*.055,
  };
}

export function trailPoses(seconds,layout,pointer) {
  return Array.from({length:7},(_,i)=>agentPose(seconds-(i+1)*.095,layout,false,pointer));
}
