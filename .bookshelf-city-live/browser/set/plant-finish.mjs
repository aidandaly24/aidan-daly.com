import {
  BufferGeometry, Color, ExtrudeGeometry, Float32BufferAttribute, Group, IcosahedronGeometry,
  InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, Raycaster, Shape, Vector3,
} from '../vendor/package/build/three.module.js';

const V = (x, y, z) => new Vector3(x, y, z);
const lerp = (a,b,t) => a+(b-a)*t;
const removed = new Set(['Moss mound','Moss tuft','Trailing pothos stem','Pothos leaf',
  'Shelf plant leaf','Plant stem','Plant branch','Potted olive leaf']);

// Coordinates for stems and leaf tips are traced in the two original camera compositions.
// All surfaces, including the leaf undersides, are closed, independently lit solids.
class GeometryBatch {
  constructor() { this.xyz=[]; this.rgb=[]; this.indices=[]; }
  vertex(p,c) {
    this.xyz.push(p.x,p.y,p.z); this.rgb.push(c.r,c.g,c.b);
    return this.xyz.length/3-1;
  }
  quad(a,b,c,d) { this.indices.push(a,b,d,b,c,d); }
  mesh(name, roughness) {
    const g=new BufferGeometry();
    g.setAttribute('position',new Float32BufferAttribute(this.xyz,3));
    g.setAttribute('color',new Float32BufferAttribute(this.rgb,3));
    g.setIndex(this.indices); g.computeVertexNormals(); g.computeBoundingSphere();
    const m=new Mesh(g,new MeshStandardMaterial({vertexColors:true,roughness}));
    m.name=name; m.castShadow=true; m.receiveShadow=true;
    return m;
  }
}

function taper(batch, path, r0, r1, color, sides=5) {
  const rows=[], ref=V(0,0,1);
  for(let i=0;i<path.length;i++) {
    const tangent=path[Math.min(path.length-1,i+1)].clone()
      .sub(path[Math.max(0,i-1)]).normalize();
    const right=V(0,0,0).crossVectors(tangent,Math.abs(tangent.dot(ref))>.91?V(1,0,0):ref).normalize();
    const cross=V(0,0,0).crossVectors(tangent,right), row=[];
    for(let j=0;j<sides;j++) {
      const angle=2*Math.PI*j/sides, r=lerp(r0,r1,i/(path.length-1));
      row.push(batch.vertex(path[i].clone().addScaledVector(right,r*Math.cos(angle))
        .addScaledVector(cross,r*Math.sin(angle)),color));
    }
    rows.push(row);
    if(i) for(let j=0;j<sides;j++) {
      const k=(j+1)%sides;
      batch.quad(rows[i-1][j],rows[i-1][k],row[k],row[j]);
    }
  }
  const first=rows[0], last=rows[rows.length-1];
  for(let j=1;j<sides-1;j++) batch.indices.push(first[0],first[j+1],first[j],last[0],last[j],last[j+1]);
}

function leaf(batch, veins, base, tip, width, roll, color, heart) {
  const length=base.distanceTo(tip), axis=tip.clone().sub(base).normalize();
  // Keep the painted silhouette while turning each blade about its own petiole.
  const wing=V(-axis.y,axis.x,0).normalize().applyAxisAngle(axis,roll);
  const normal=V(0,0,0).crossVectors(axis,wing).normalize();
  if(normal.z<0) normal.negate();
  width=Math.min(width,length*(heart?.45:.30));
  const bladeDepth=Math.min(7,length*.19);
  const point=(t,u)=> {
    const margin=Math.sin(Math.PI*Math.pow(t,heart?.66:.92));
    const x=width*Math.pow(Math.max(0,margin),heart?.82:.90)*(1-.14*t)*u;
    const lobe=heart?-length*.19*Math.abs(u)*Math.sin(Math.PI*Math.min(1,t*3.2)):0;
    const midArch=Math.sin(t*Math.PI)*bladeDepth;
    const cup= -.38*width*Math.abs(u)*Math.sin(Math.PI*t);
    return base.clone().addScaledVector(axis,t*length+lobe)
      .addScaledVector(wing,x).addScaledVector(normal,midArch+cup+.24*x*(t-.45));
  };
  const top=[], bottom=[], ts=[.008,.065,.15,.27,.41,.57,.73,.86,.95,.997],
    across=[-1,-.65,-.22,-.065,0,.065,.22,.65,1];
  for(let i=0;i<ts.length;i++) {
    const t=ts[i]; top[i]=[]; bottom[i]=[];
    for(let j=0;j<across.length;j++) {
      const u=across[j],p=point(t,u);
      const shade= .89 + .17 * (1+u) + .055*Math.sin(Math.PI*t)
        - .085*Math.abs(u) + (Math.abs(u)<.01?.095:0);
      top[i].push(batch.vertex(p,color.clone().multiplyScalar(shade)));
      bottom[i].push(batch.vertex(p.clone().addScaledVector(normal,-Math.min(.83,width*.08)),
        color.clone().multiplyScalar(.82+.075*Math.abs(u))));
      if(i&&j) {
        batch.quad(top[i-1][j-1],top[i][j-1],top[i][j],top[i-1][j]);
        batch.quad(bottom[i-1][j],bottom[i][j],bottom[i][j-1],bottom[i-1][j-1]);
      }
    }
    if(i) {
      const e=across.length-1;
      batch.quad(top[i-1][0],bottom[i-1][0],bottom[i][0],top[i][0]);
      batch.quad(top[i][e],bottom[i][e],bottom[i-1][e],top[i-1][e]);
    }
  }
  const end=ts.length-1;
  for(let j=1;j<across.length;j++) {
    batch.quad(top[0][j],bottom[0][j],bottom[0][j-1],top[0][j-1]);
    batch.quad(top[end][j-1],bottom[end][j-1],bottom[end][j],top[end][j]);
  }
  const veinColor=color.clone().lerp(new Color(0xa9a35b),.35);
  const center=[.03,.15,.27,.41,.57,.73,.88,.95].map(t=>point(t,0).addScaledVector(normal,.42));
  taper(veins,center,Math.max(.48,width*.052),.14,veinColor,5);
  if(heart && width>12) for(const u of [-1,1]) for(const t of [.24,.46,.64]) {
    taper(veins,[point(t,0),point(t+.08,u*.37),point(t+.16,u*.78)].map(q=>q.addScaledVector(normal,.29)),
      .16,.065,veinColor,3);
  }
}

const vines=[
  [[130,62,36],[123,74,58],[112,95,84],[103,127,105],[101,157,112],[92,193,124],[87,227,121],[81,253,116]],
  [[128,64,44],[115,79,73],[91,91,94],[75,111,104],[65,135,112],[57,152,114]],
  [[125,64,42],[136,83,77],[144,109,96],[146,136,110],[150,156,112],[141,188,120],[141,215,123]],
  [[123,61,37],[148,59,49],[166,59,58],[183,65,65],[205,65,63]],
  [[127,62,40],[114,56,52],[97,59,64],[82,75,72],[68,85,78]],
];
// branch, node, x/y tip, width, fold. Short petioles connect every blade to its shoot.
const vineLeaves=[
  [0,0,116,28,15,-.35],[0,0,147,35,15,.34],[0,1,108,45,18,.28],
  [0,2,102,67,21,-.29],[0,2,118,128,20,.28],[0,3,88,157,18,-.23],
  [0,4,104,179,19,.21],[0,5,99,220,18,-.10],[0,6,76,246,15,.33],[0,7,80,283,13,-.22],
  [1,1,77,75,14,.48],[1,2,76,108,18,-.35],[1,3,59,153,18,.45],
  [1,4,76,156,13,-.45],[1,5,69,184,15,.32],
  [2,1,146,97,21,.11],[2,2,165,138,19,-.43],[2,3,156,179,15,.36],
  [2,4,147,192,13,-.52],[2,5,119,252,13,.26],[2,6,155,245,13,-.17],
  [3,1,173,66,19,-.35],[3,2,194,57,14,.12],[3,3,211,83,12,.36],[3,4,224,82,10,.21],
  [4,0,154,41,17,-.12],[4,0,146,91,17,.12],[3,1,174,96,17,.28],
  [4,1,122,50,16,-.38],[4,2,73,60,13,-.43],[4,3,63,105,16,.23],
  [0,1,79,101,17,.30],[0,1,122,108,19,-.31],[0,2,129,128,17,.22],
  [1,0,86,45,15,-.30],[1,1,92,112,14,.64],[1,3,89,139,16,-.37],
  [2,0,169,71,15,.49],[2,1,177,101,17,-.19],
  [3,0,159,38,15,.35],[4,1,90,41,12,-.43],

];
const vinePalette=[0x8e8e34,0x83862e,0x9f9d46,0x90963d,0x7b802c,0xa19e46,0x868a35];

function makeVine(blades, stems, veins, layout, h) {
  const map=([x,y,z])=>layout
    ? V(151+(x-113)*.93,h-(753+(y-29)*1.085),z)
    : V(18+x,h-373-y,z);
  const paths=vines.map(b=>b.map(map));
  const rooted=map([125,64,-12]);
  paths.forEach((path,j)=>taper(stems,[rooted,...path],2.15-j*.10,.55,new Color(0x6f692e)));
  for(const [i,[b,n,tx,ty,half,roll]] of vineLeaves.entries()) {
    const node=paths[b][n], tip=map([tx,ty,vines[b][n][2]+6+(i%3)*2]);
    const base=node.clone().lerp(tip,.135);
    taper(stems,[node,base],1.05,.73,new Color(0x827937));
    leaf(blades,veins,base,tip,half,roll,new Color(vinePalette[i%vinePalette.length]),true);
  }
}

const treeForks=[
  [[164,190,0],[163,173,-1],[160,155,1],[151,136,2],[144,120,4],[147,107,4]],
  [[160,155,1],[150,138,2],[132,125,4],[118,116,5],[106,108,2]],
  [[151,136,2],[157,126,-2],[167,119,-4],[169,111,-6]],
  [[160,155,1],[166,142,0],[177,125,2],[184,112,0],[192,98,2],[198,85,3],[200,72,5]],
  [[177,125,2],[169,119,-3],[165,112,-5]],
  [[151,136,2],[142,131,4],[128,129,7],[117,135,9]],
  [[166,142,0],[178,139,2],[186,141,4]],
];
const treeLeaves=[
  [0,5,149,87,9,.18],[0,4,129,76,9,-.34],[1,4,93,88,8,-.53],
  [1,4,71,111,9,.11],[1,3,101,125,7,.32],[1,2,86,147,8,-.26],
  [5,3,116,158,8,.12],[5,2,98,135,7,-.36],[2,3,168,110,6,.42],
  [4,2,166,107,8,-.24],[6,2,216,151,8,.38],[3,2,212,120,8,-.29],
  [3,3,162,87,8,.20],[3,4,233,98,9,-.46],[3,5,172,62,8,-.24],
  [3,6,196,42,9,.38],[3,5,233,59,9,.18],
];
function makeTree(blades, stems, veins, layout, h, soilZ) {
  const map=([x,y,z])=>layout
    ? V(861+(x-164)*1.025,h-(1324+(y-187)*1.12),soilZ+z)
    : V(1286+x,h-626-y,soilZ+z);
  const paths=treeForks.map(b=>b.map(map));
  paths.forEach((b,i)=>taper(stems,b,i===0?4.4:i===3?3.0:2.2,.78,new Color(0x604627),7));
  for(const [i,[fork,node,x,y,half,roll]] of treeLeaves.entries()) {
    const a=paths[fork][node],tip=map([x,y,treeForks[fork][node][2]+5*(i%3)-4]);
    if(a.distanceTo(tip)<10)continue;
    const petiole=a.clone().lerp(tip,.19);
    taper(stems,[a,petiole],.95,.58,new Color(0x716631));
    leaf(blades,veins,petiole,tip,half,roll,new Color(vinePalette[(i+3)%vinePalette.length]),false);
  }
}

function groundExtension(set, garden, h) {
  // The phone composition looks across a deeper courtyard. Continue the baked
  // ground section to the distant foot of the bridge. Its front rim shares
  // the first terrain row and the same material as the main courtyard.
  const floor=set.getObjectByName('Peach cyclorama floor');
  const bands=[[-1690,917],[-1630,932],[-1540,971],[-1440,1040],[-1300,1170],[-1200,1200]];
  const g=new BufferGeometry();
  g.setAttribute('position',new Float32BufferAttribute(bands.flatMap(([z,y])=>
    [-1800,h-y,z,2748,h-y,z]),3));
  g.setIndex(bands.slice(1).flatMap((_,i)=>[2*i,2*i+2,2*i+1,2*i+1,2*i+2,2*i+3]));
  g.computeVertexNormals();
  const ground=new Mesh(g,floor.material);
  ground.name='Distant courtyard under the bridge';ground.receiveShadow=true;garden.add(ground);
  return ground;
}

function terraces(garden,layout,h){
  // These little vellum volumes are visible between the flag tower and the
  // little arcade in both original paintings. Each book bears on the one
  // below it, and the lowest course has a solid support down to the floor.
  const zFront=-129,depth=124;
  const left=layout?166:461;
  const levels=layout?[[326,742],[314,722],[297,704],[254,681]]
    :[[682,561],[654,539],[629,519],[558,479]];
  const supportY=layout?765:606, floorY=layout?1299:912;
  const cream=new MeshStandardMaterial({color:0xead4aa,roughness:.94});
  const vellum=new MeshStandardMaterial({color:0xe4c492,roughness:.89});
  const plaster=new MeshStandardMaterial({color:0xe4ccb0,roughness:.98});
  const tops=[];
  function volume(name,x,y,width,height,front,deep,material,radius){
    // Y is the upper edge of the front board. The far edge rises just enough
    // to expose its top to the fixed camera and receive the plants' shadows.
    const r=Math.min(radius,width/4,height/3),shape=new Shape();
    shape.moveTo(r,0);shape.lineTo(width-r,0);shape.quadraticCurveTo(width,0,width,-r);
    shape.lineTo(width,r-height);shape.quadraticCurveTo(width,-height,width-r,-height);
    shape.lineTo(r,-height);shape.quadraticCurveTo(0,-height,0,r-height);
    shape.lineTo(0,-r);shape.quadraticCurveTo(0,0,r,0);
    const g=new ExtrudeGeometry(shape,{depth:deep,curveSegments:4,bevelThickness:.5,bevelSize:.45,bevelSegments:2});
    const a=g.attributes.position;
    for(let i=0;i<a.count;i++)a.setY(i,a.getY(i)+(deep-a.getZ(i))*.095);
    g.computeVertexNormals();
    const mesh=new Mesh(g,material);
    mesh.name=name;mesh.position.set(x,h-y,front-deep);
    mesh.castShadow=mesh.receiveShadow=true;garden.add(mesh);return mesh;
  }
  volume('Recessed limestone garden pier',left+24,supportY,levels[0][0]-left-47,
    floorY-supportY,zFront-13,depth-17,plaster,6);
  let below=supportY;
  for(const [right,top] of levels){
    const width=right-left, thick=below-top, lip=3.6;
    volume('Garden book lower board',left,below-lip,width,lip,zFront,depth,vellum,1);
    volume('Garden book fore-edge',left+2,top+lip,width-5,thick-2*lip,zFront-2,depth-4,cream,2);
    tops.push(volume('Garden book top board',left,top,width,lip,zFront,depth,vellum,1));
    below=top;
  }
  return tops;
}

function rootShade(garden, ground, centers, layout) {
  // Soft ambient contact on the exact courtyard triangles. The distant patch
  // sits outside the near furniture's shadow camera, especially in portrait.
  const positions=[], colors=[], indices=[];
  const ray=new Raycaster(), down=V(0,-1,0), tint=new Color(0x776347);
  const sides=28, rings=[0,.46,.75,1], opacities=[.25,.18,.065,0];
  for(const center of centers){
    const base=positions.length/3, radius=center.scale.x;
    for(let k=0;k<rings.length;k++)for(let j=0;j<sides;j++){
      const a=2*Math.PI*j/sides, r=rings[k];
      const x=center.position.x+2+Math.cos(a)*radius*1.18*r;
      const z=center.position.z+radius*.06+Math.sin(a)*radius*1.35*r;
      ray.set(V(x,layout?1659:1024,z),down);
      const hit=ray.intersectObject(ground,false)[0];
      positions.push(x,hit?hit.point.y+.32:center.position.y-center.scale.y*.42,z);
      colors.push(tint.r,tint.g,tint.b,opacities[k]);
      if(k){
        const i=base+k*sides+j,next=base+k*sides+(j+1)%sides;
        indices.push(i-sides,next-sides,i, next-sides,next,i);
      }
    }
  }
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));
  g.setAttribute('color',new Float32BufferAttribute(colors,4));g.setIndex(indices);
  const m=new Mesh(g,new MeshBasicMaterial({vertexColors:true,transparent:true,
    depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  m.name='Distant moss ground contact';m.renderOrder=1;garden.add(m);
}

function plantMounds(set,garden,mounds,layout,h) {
  const shelfTops=terraces(garden,layout,h);
  const floor=set.getObjectByName('Peach cyclorama floor');
  const rearGround=layout?groundExtension(set,garden,h):floor;
  set.updateMatrixWorld(true);garden.updateMatrixWorld(true);
  const supports=[];
  set.traverse(o=>{if(o.isMesh && /book|landing|riser|podium/i.test(o.name) &&
    !/edge|notebook|paper leaf/i.test(o.name))supports.push(o);});
  const down=V(0,-1,0), ray=new Raycaster(), distant=[];
  for(const mound of mounds) {
    const x=mound.position.x;
    const midBridge=layout?(x===493||x===514):(x===819||x===861);
    const atArcade=layout?(x===245||x===280):(x===518||x===591||x===643);
    const expected=mound.position.y-mound.scale.y*.37;
    let best;
    const candidates=midBridge?[rearGround]:atArcade?shelfTops:supports;
    const depths=midBridge?[layout?-1568:-1432]:atArcade?[-188,-166,-146]:
      [-210,-190,-173,-154,-137,-119,-103,-88,-72,-50,-26];
    for(const z of depths){
      ray.set(V(x,midBridge?h:expected+80,z),down);
      for(const hit of ray.intersectObjects(candidates,false)){
        const score=Math.abs(hit.point.y-expected)+.055*Math.abs(z+(midBridge?Math.abs(z):167));
        if(!best||score<best.score)best={score,point:hit.point,name:hit.object.name};
      }
    }
    if(!best)continue;
    mound.position.z=best.point.z;
    mound.position.y=best.point.y+mound.scale.y*(midBridge?.42:.36);
    mound.userData.root={mesh:best.name,xyz:best.point.toArray()};
    if(midBridge)distant.push(mound);
  }
  rootShade(garden,rearGround,distant,layout);
}

function makeMoss(mounds) {
  // Flocked moss has a close, soft nap. Real lump silhouettes carry the larger
  // shape. Grain is calculated per model-space pixel rather than painted onto a card.
  const geom=new IcosahedronGeometry(1,3);
  const pos=geom.attributes.position, color=[];
  for(let i=0;i<pos.count;i++) {
    const x=pos.getX(i), y=pos.getY(i), z=pos.getZ(i);
    const ripple=.018*Math.sin(11*x+5*z)*Math.sin(8*y-2*z)+.012*Math.sin(16*z+7*x);
    pos.setXYZ(i,x*(1+ripple),y*(1+ripple),z*(1+ripple));
    const bright=.95+.06*Math.sin(3*x+4*y)*Math.cos(5*z);
    color.push(bright,bright,.97*bright);
  }
  geom.setAttribute('color',new Float32BufferAttribute(color,3));
  const mat=new MeshStandardMaterial({vertexColors:true,roughness:1});
  mat.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 mossPoint;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nmossPoint = position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 mossPoint;
      float mossHash(vec3 p) {p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
      float mossGrain(vec3 p){
        vec3 i=floor(p), f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(mossHash(i),mossHash(i+vec3(1,0,0)),f.x),
          mix(mossHash(i+vec3(0,1,0)),mossHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(mossHash(i+vec3(0,0,1)),mossHash(i+vec3(1,0,1)),f.x),
          mix(mossHash(i+vec3(0,1,1)),mossHash(i+vec3(1)),f.x),f.y),f.z);}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
        float coarse=mossGrain(mossPoint*17.)-.5;
        vec3 samplePoint=mossPoint*55.;
        float fine=(mossGrain(samplePoint)-.5)*(1.-smoothstep(.65,1.9,length(fwidth(samplePoint))));
        diffuseColor.rgb *= 1.0 + .30*coarse + .43*fine;
      `);
  };
  const moss=new InstancedMesh(geom,mat,mounds.length*5);
  moss.name='Flocked moss crowns'; moss.castShadow=true; moss.receiveShadow=true;
  const matrix=new Matrix4(), q=new Quaternion();
  const offsets=[[-.40,-.15,.28,.64],[.35,-.17,.12,.72],[-.03,.25,-.27,.67],[-.05,-.03,.10,.72],[.46,-.03,-.47,.53]];
  let n=0;
  mounds.forEach((m,i)=>{
    offsets.forEach(([x,y,z,s],j)=>{
      const p=m.position.clone().add(V(x*m.scale.x,y*m.scale.y,z*m.scale.z));
      matrix.compose(p,q,V(m.scale.x*s,m.scale.y*s*.98,m.scale.z*s));
      moss.setMatrixAt(n,matrix);
      const tuft=new Color([0x90923e,0x9a9d45,0x8d913d,0x91943e,0x9c9b45][(j+i)%5]);
      if(m.position.z < -800)tuft.lerp(new Color(0xc6b579),.36);
      moss.setColorAt(n,tuft); n++;
    });
  });
  moss.computeBoundingSphere();
  return moss;
}

export function finishPlants(set, layout) {
  const existing=set.getObjectByName('Botanical details');
  if(existing) return existing;
  const h=layout?1659:1024, plant=new Group(), blades=new GeometryBatch(), stems=new GeometryBatch(), veins=new GeometryBatch();
  const old=[], mounds=[];
  set.traverse(o=>{if(removed.has(o.name))old.push(o); if(o.name==='Moss mound')mounds.push(o);});
  old.forEach(o=>o.removeFromParent());
  const shelfPot=set.getObjectByName('Shelf plant pot');
  if(shelfPot){
    const base=shelfPot.position.clone().add(V(0,11,0));
    for(let i=0;i<8;i++){
      const a=i*2.39996;
      leaf(blades,veins,base,base.clone().add(V(Math.cos(a)*14,13+Math.sin(a)*6,Math.sin(a)*8)),
        4.3,.46*Math.cos(a),new Color(vinePalette[i%7]),true);
    }
  }
  makeVine(blades,stems,veins,layout,h);
  makeTree(blades,stems,veins,layout,h,set.getObjectByName('Potting soil').position.z);
  plant.name='Botanical details';
  plantMounds(set,plant,mounds,layout,h);
  plant.userData.plantings=mounds.map(m=>m.userData.root);
  plant.add(blades.mesh('Curled pothos and olive blades',.59),stems.mesh('Connected shoots and petioles',.86),
    veins.mesh('Raised leaf midribs',.83),makeMoss(mounds));
  set.add(plant); return plant;
}
