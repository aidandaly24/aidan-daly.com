import { Box3, Matrix4, Quaternion, Ray, Triangle, Vector3 } from './vendor/package/build/three.module.js';
import { nodes } from './city.mjs';

// The fixed composition looks along -Z. A floor seen edge-on has no projected
// area in XY, so a camera ray alone cannot recover a point on that floor.
// Intersect the support triangle with the vertical plane through each shoe.
// Its YZ segment works for flat floors, curved book covers and tilted rungs.
const roleAt = {
  desk: ['ground'], floor: ['ground'], notebook: ['notebook','ground'], stool: ['notebook'],
  toe: ['ground','stairs'], s1: ['stairs'], s2: ['stairs'], s3: ['stairs'],
  cross: ['landing','bridge'], mid: ['bridge'], east: ['bridge','landing'],
  westDock: ['landing','bridge'], eastDock: ['landing','bridge'], overlook: ['landing'],
  pass: ['landing'], ledge: ['landing'], ladder0: ['landing','ladder'],
  ladder1: ['ladder','upper'], upper: ['upper'], blocks: ['upper'],
};
const bucketWidth = 64;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const distanceSquared = (a,b) => (a[0]-b[0])**2 + (a[1]-b[1])**2;

function eachTriangle(mesh, visitInstance) {
  const geometry = mesh.geometry, positions = geometry.getAttribute('position');
  if (!positions) return;
  const fromInstance = new Matrix4(), world = new Matrix4();
  const index = geometry.index;
  for (let instance = 0; instance < (mesh.isInstancedMesh ? mesh.count : 1); instance++) {
    world.copy(mesh.matrixWorld);
    if (mesh.isInstancedMesh) {
      mesh.getMatrixAt(instance, fromInstance);
      world.multiply(fromInstance);
    }
    const vertices = Array.from({length: positions.count}, (_, i) =>
      new Vector3().fromBufferAttribute(positions, i).applyMatrix4(world));
    let minZ = Infinity, maxZ = -Infinity;
    for (const v of vertices) { minZ = Math.min(minZ,v.z); maxZ = Math.max(maxZ,v.z); }
    const n = index?.count ?? positions.count;
    const start=geometry.drawRange.start, end=Math.min(n, start+geometry.drawRange.count);
    const triangles = [];
    for (let i = start; i+2 < end; i+=3) {
      const vertex = j => vertices[index ? index.getX(j) : j];
      triangles.push(new Triangle(vertex(i),vertex(i+1),vertex(i+2)));
    }
    visitInstance(triangles, (minZ+maxZ)/2, vertices);
  }
}

function supportTriangles(mesh, role, emit) {
  eachTriangle(mesh, (triangles,centerZ) => {
    for (const triangle of triangles) {
      const {a,b,c}=triangle, normal=triangle.getNormal(new Vector3());
      if (normal.y < .34) continue; // reject undersides, book spines and vertical risers
      const minX = Math.min(a.x,b.x,c.x), maxX = Math.max(a.x,b.x,c.x);
      if (maxX-minX < .0001) continue;
      emit({vertices:[a,b,c], normal, role, mesh, centerZ, minX, maxX});
    }
  });
}

// A standing traveller is a vertical capsule. Test its centerline against
// complete solid faces, including triangle edges and the two rounded caps.
// Hollow arches are thus walkable through the opening inside their bounds.
function capsuleHit(point, dimensions, obstacles) {
  const {radius,height}=dimensions;
  const start=new Vector3(point.x,point.y+radius,point.z);
  const end=new Vector3(point.x,point.y+Math.max(radius,height-radius),point.z);
  const bounds=new Box3().setFromPoints([start,end]).expandByScalar(radius);
  const closest=new Vector3(), hit=new Vector3(), ray=new Ray(start,new Vector3(0,1,0));
  const radius2=radius*radius;
  for(const obstacle of obstacles) {
    if(!bounds.intersectsBox(obstacle.bounds)) continue;
    for(const triangle of obstacle.triangles) {
      const {a,b,c}=triangle;
      if(ray.intersectTriangle(a,b,c,false,hit) && hit.y<=end.y) return obstacle.mesh;
      if(triangle.closestPointToPoint(start,closest).distanceToSquared(start)<radius2 ||
         triangle.closestPointToPoint(end,closest).distanceToSquared(end)<radius2) return obstacle.mesh;
      // Minimise horizontal separation to each edge within the centerline's Y interval.
      for(const [p,q] of [[a,b],[b,c],[c,a]]) {
        const vy=q.y-p.y;
        let lower=0, upper=1;
        if(Math.abs(vy)<1e-7) {
          if(p.y<start.y || p.y>end.y) continue;
        } else {
          const s=(start.y-p.y)/vy, t=(end.y-p.y)/vy;
          lower=Math.max(0,Math.min(s,t)); upper=Math.min(1,Math.max(s,t));
          if(lower>upper) continue;
        }
        const vx=q.x-p.x, vz=q.z-p.z;
        const t=clamp(((start.x-p.x)*vx+(start.z-p.z)*vz)/(vx*vx+vz*vz||1),lower,upper);
        if((start.x-p.x-vx*t)**2+(start.z-p.z-vz*t)**2<radius2) return obstacle.mesh;
      }
    }
    // If a capsule lies entirely inside a closed object, its centerline may
    // never approach a boundary. Count crossings of a generic ray to detect it.
    const probe=new Ray(start,new Vector3(.871,.307,.383).normalize());
    if(obstacle.bounds.containsPoint(start)) {
      const crossings=[];
      for(const triangle of obstacle.triangles) if(probe.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit)){
        const t=hit.distanceTo(start);
        if(!crossings.some(v=>Math.abs(v-t)<1e-5)) crossings.push(t);
      }
      if(crossings.length%2===1) return obstacle.mesh;
    }
  }
  return null;
}

function sectionPoint(triangle, x, y, hint, depthWeight, out) {
  const v = triangle.vertices;
  let lowY,lowZ=Infinity,highY,highZ=-Infinity;
  for (let i=0; i<3; i++) {
    const a=v[i], b=v[(i+1)%3];
    if (Math.abs(b.x-a.x)<.000001) continue;
    const t=(x-a.x)/(b.x-a.x);
    if (t < -.000001 || t > 1.000001) continue;
    const z=a.z+t*(b.z-a.z), height=a.y+t*(b.y-a.y);
    if(z<lowZ){lowZ=z;lowY=height;}
    if(z>highZ){highZ=z;highY=height;}
  }
  if (!Number.isFinite(lowZ)) return false;
  const dy=highY-lowY, dz=highZ-lowZ;
  // Match the photographed contact in Y. Where Y provides little information,
  // prefer the continuous route depth instead of hopping between triangle rims.
  const denominator=dy*dy+depthWeight*dz*dz;
  const t=denominator ? clamp(((y-lowY)*dy+depthWeight*(hint-lowZ)*dz)/denominator,0,1) : 0;
  out.set(x, lowY+t*dy, lowZ+t*dz);
  return true;
}

/**
 * Depth in the camera's registered coordinate system is positive toward the
 * viewer. Pass the visible supporting solids in surfaces as {mesh, role}, or
 * identify each supporting mesh with userData.walkable = '<role>'. A labelled
 * Group passes its role to its children. Named station markers in anchors may
 * be Object3Ds or world-space Vector3s; depths maps route-node names to world Z.
 */
export function createContactDepth(set, layout, {
  surfaces, obstacles, depths = set.userData.routeDepths ?? {}, anchors = set.userData.contactAnchors ?? {},
  roles = roleAt, maxHeightError = 32, depthWeight = .012, rungContacts = [],
} = {}) {
  const height = layout ? 1659 : 1024;
  const buckets = new Map(), cache = new WeakMap();
  const candidates = surfaces ?? [], blockedMeshes=obstacles ?? [], solids=[];
  if(!obstacles) set.traverseVisible(mesh => {
    if(!mesh.isMesh) return;
    let entry=mesh;
    while(entry && entry.userData.obstacle===undefined && entry!==set) entry=entry.parent;
    if(entry?.userData.obstacle) blockedMeshes.push(mesh);
  });
  if (!surfaces) set.traverseVisible(mesh => {
    if (!mesh.isMesh) return;
    let entry=mesh;
    while(entry && entry.userData.walkable === undefined && entry!==set) entry=entry.parent;
    const role=entry?.userData.walkable;
    if(role) candidates.push({mesh,role: role===true ? '*' : role});
  });
  set.updateWorldMatrix(true,true);
  for(const mesh of blockedMeshes) eachTriangle(mesh,(triangles,_,vertices)=>
    solids.push({mesh,triangles,bounds:new Box3().setFromPoints(vertices)}));
  for (const {mesh,role} of candidates) supportTriangles(mesh,role,triangle => {
    for (let i=Math.floor(triangle.minX/bucketWidth); i<=Math.floor(triangle.maxX/bucketWidth); i++) {
      if (!buckets.has(i)) buckets.set(i,[]);
      buckets.get(i).push(triangle);
    }
  });
  const worldPoint = new Vector3();

  function sample(p, from, to=from, depthOffset=0, radius=0) {
    const a=nodes[from]?.[layout], b=nodes[to]?.[layout];
    if (!a || !b) return null;
    const dx=b[0]-a[0], dy=b[1]-a[1];
    const t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1),0,1);
    const za=depths[from] ?? depths[to], zb=depths[to] ?? za;
    const expectedZ=Number.isFinite(za) ? za+(zb-za)*t+depthOffset : null;
    const expectedY=height-p[1], allowedA=roles[from]??[], allowedB=roles[to]??[];
    let best=null, cost=Infinity;
    const first=Math.floor((p[0]-radius)/bucketWidth), last=Math.floor((p[0]+radius)/bucketWidth);
    for(let i=first; i<=last; i++) {
      for(const tri of buckets.get(i)??[]) {
        if(tri.role==='ladder' && (from==='upper'||to==='upper')) continue;
        if(tri.role!=='*' && !allowedA.includes(tri.role) && !allowedB.includes(tri.role)) continue;
        const x=clamp(p[0],tri.minX,tri.maxX);
        if(Math.abs(x-p[0]) > radius) continue;
        const z=expectedZ ?? tri.centerZ+depthOffset;
        if(!sectionPoint(tri,x,expectedY,z,depthWeight,worldPoint)) continue;
        const heightError=worldPoint.y-expectedY;
        if(Math.abs(heightError)>maxHeightError) continue;
        const score=heightError**2 + (x-p[0])**2 * 3 + depthWeight*(worldPoint.z-z)**2;
        if(score>=cost) continue;
        cost=score;
        best={ point:worldPoint.clone(), mesh:tri.mesh, normal:tri.normal, role:tri.role, heightError };
      }
    }
    return best;
  }
  function edge(actor) {
    if(actor.kind!=='travel') return [actor.at,actor.at];
    if(actor.seg) return [actor.seg.from, actor.seg.to];
    const node=actor.node??actor.at;
    return [node,node];
  }
  function ladderBody(p, from, to) {
    if (!rungContacts.length || ![from,to].includes('ladder0') || ![from,to].includes('ladder1')) return null;
    const lo=nodes.ladder0[layout], hi=nodes.ladder1[layout];
    const t=clamp((p[1]-lo[1])/(hi[1]-lo[1]),0,1);
    return new Vector3(p[0],height-p[1],depths.ladder0+(depths.ladder1-depths.ladder0)*t);
  }
  function bodySurface(p,route,hit) {
    const onLadder=ladderBody(p,...route);
    if(onLadder) return onLadder;
    if(hit && route.includes('ladder1') && !route.includes('ladder0')) {
      // The hips clear the book's lip before the trailing shoe steps off the
      // front stile and the body moves back onto the cover.
      const start=nodes.ladder1[layout], end=nodes.upper[layout];
      const t=clamp((p[0]-start[0])/(end[0]-start[0]),0,1);
      const clearStile=clamp((t-.48)/.52,0,1);
      hit.z=depths.ladder1+(depths.upper-depths.ladder1)*clearStile*clearStile*(3-2*clearStile);
    }
    return hit??null;
  }
  function actorGround(actor) {
    const route=edge(actor);
    const hit=sample(actor.p,...route,0,4)?.point;
    return bodySurface(actor.p,route,hit);
  }
  function rung(art,side=0) {
    if(!rungContacts.length) return null;
    const y=height-art[1];
    let nearest=rungContacts[0];
    for(const p of rungContacts) if(Math.abs(y-p.y)<Math.abs(y-nearest.y)) nearest=p;
    return nearest.clone().add(new Vector3(side,0,0));
  }
  function sole(actor,index,depthOffset=0) {
    const foot=actor.feet[index], lift=foot[2]??0;
    let feet=cache.get(actor);
    if(!feet){feet=[];cache.set(actor,feet);}
    const old=feet[index];
    if(old && lift===0 && distanceSquared(foot,old.art)<.000001) return old.point.clone();
    const route=edge(actor);
    const swing=actor.swing;
    if (lift>0 && swing?.i===index && Array.isArray(swing.s) && Array.isArray(swing.tar)) {
      // In flight there is no ground directly beneath the shoe on a staircase.
      // Carry its real takeoff and landing depths through open air rather than
      // snapping onto whichever tread crosses the same screen coordinate.
      const start=old && distanceSquared(old.art,swing.s)<.000001
        ? old.point : sample(swing.s,...route,depthOffset,9)?.point;
      const end=sample(swing.tar,...route,depthOffset,9)?.point;
      if (start && end) {
        const sx=swing.tar[0]-swing.s[0], sy=swing.tar[1]-swing.s[1];
        const t=clamp(((foot[0]-swing.s[0])*sx+(foot[1]-swing.s[1])*sy)/(sx*sx+sy*sy||1),0,1);
        const point=start.clone().lerp(end,t);
        point.x+=foot[0]-(swing.s[0]+t*sx);
        point.y+=swing.s[1]+t*sy-foot[1]+lift;
        return point;
      }
    }
    const hit=sample(foot,...route,depthOffset,9);
    if(!hit) return null;
    hit.point.y+=lift;
    if(lift===0) feet[index]={art:[foot[0],foot[1]],point:hit.point.clone()};
    return hit.point;
  }
  function at(node, dx=0, dz=0) {
    const p=nodes[node]?.[layout];
    return p ? sample([p[0]+dx,p[1]],node,node,dz,2)?.point??null : null;
  }
  function anchor(name,fallbackPoint,station) {
    const marker=anchors[name];
    if(marker?.isObject3D) return marker.getWorldPosition(new Vector3());
    if(marker?.isVector3) return marker.clone();
    const floor=at(station);
    if(!floor) return fallbackPoint.clone();
    const p=nodes[station][layout];
    return fallbackPoint.clone().add(new Vector3(0,floor.y-(height-p[1]),floor.z-16));
  }
  function auditRoute(from,to,spacing=12,clearance={radius:16,height:174}) {
    const a=nodes[from][layout], b=nodes[to][layout];
    const count=Math.max(1,Math.ceil(Math.sqrt(distanceSquared(a,b))/spacing));
    const misses=[], collisions=[];
    for(let i=0;i<=count;i++){
      const t=i/count, p=a.map((n,j)=>n+(b[j]-n)*t);
      const support=sample(p,from,to,0,4);
      if(!support) {misses.push({fraction:t,art:p});continue;}
      const body=bodySurface(p,[from,to],support.point.clone());
      const obstruction=capsuleHit(body,clearance,solids);
      if(obstruction) collisions.push({fraction:t,art:p,object:obstruction.name});
    }
    return {from,to,samples:count+1,admitted:!misses.length&&!collisions.length,misses,collisions};
  }
  return {actor:actorGround,sole,at,anchor,sample,auditRoute,rung};
}


// The native solver can shift the hips when a reach is near its limit. Attach a
// rigid carried prop to both solved palm markers. Offset units are scene units
// after the mesh's authored scale, matching plank.mjs. Keep the mesh parented
// to the scene and reuse this result object without touching the native rig.
export function fitCarriedProp(markers, offsets, yaw, target) {
  const a=markers[0].getWorldPosition(new Vector3());
  const b=markers[1].getWorldPosition(new Vector3());
  const actual=b.clone().sub(a);
  const axis=offsets[1].clone().sub(offsets[0]);
  const span=axis.length();
  target.quaternion.setFromAxisAngle(new Vector3(0,1,0),yaw);
  if(span>1e-6 && actual.lengthSq()>1e-6) {
    axis.normalize().applyQuaternion(target.quaternion);
    const correction=new Quaternion().setFromUnitVectors(axis,actual.clone().normalize());
    target.quaternion.premultiply(correction);
  }
  const center=offsets[0].clone().lerp(offsets[1],.5).applyQuaternion(target.quaternion);
  target.position.copy(a).lerp(b,.5).sub(center);
  // A rigid plank cannot change its length to cover an unreachable grip.
  return Math.abs(actual.length()-span)/2;
}
