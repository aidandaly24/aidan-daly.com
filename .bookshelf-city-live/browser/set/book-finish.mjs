import * as T from '../vendor/package/build/three.module.js';

const lerp = T.MathUtils.lerp;
const clamp = T.MathUtils.clamp;
const named = (set, name) => set.children.filter(child => child.name === name);
const mat = (color, finish, roughness=.86) => {
  const material = new T.MeshStandardMaterial({color,roughness});
  material.name = finish;
  material.userData.setSurface = finish;
  return material;
};

function solid(set, name, geometry, material) {
  const part = new T.Mesh(geometry, material);
  part.name = name;
  part.castShadow = part.receiveShadow = true;
  set.add(part);
  return part;
}

// In the registered camera a horizontal book shows part of its top and right
// faces. The shear is in the solid itself, so the cover actually has those faces.
function extrude(shape, depth, bevel=.8, shear=[0,0]) {
  const geo = new T.ExtrudeGeometry(shape, {depth, bevelEnabled:bevel>0,
    bevelSize:bevel, bevelThickness:bevel, bevelSegments:3, curveSegments:18});
  const points=geo.attributes.position;
  for (let i=0; i<points.count; i++) {
    const t=1-points.getZ(i)/depth;
    points.setXY(i, points.getX(i)+shear[0]*t, points.getY(i)+shear[1]*t);
  }
  geo.computeVertexNormals();
  return geo;
}

function replacePart(part, geometry, origin, material) {
  // Depth registration may already have shifted a specific object. Reuse its
  // position unless the caller supplies a new local origin.
  part.geometry=geometry;
  if (origin) part.position.copy(origin);
  part.material=material;
}

function caseGeometry(w,h,depth,spineAtLeft,lip) {
  const r=Math.min(w*.18,h*.33);
  const shape=new T.Shape(), x=u=>spineAtLeft?u:w-u;
  const move=(u,v)=>shape.moveTo(x(u),-v);
  const line=(u,v)=>shape.lineTo(x(u),-v);
  const curve=(a,b,c,d,e,f)=>shape.bezierCurveTo(x(a),-b,x(c),-d,x(e),-f);
  // The long cloth boards are thin; only the rounded binding spans the height.
  move(w,0); line(r,0);
  curve(r*.24,0,0,h*.11,0,h*.50);
  curve(0,h*.90,r*.23,h,r,h); line(w,h); line(w,h-lip); line(r,h-lip);
  curve(r*.48,h-lip,lip,h*.83,lip,h*.50);
  curve(lip,h*.16,r*.5,lip,r,lip); line(w,lip);shape.closePath();
  return extrude(shape,depth,Math.min(1.3,lip*.22),[depth*.11,depth*.19]);
}

function leavesGeometry(w,h,depth,spineAtLeft,lip) {
  const shape=new T.Shape(), x=u=>spineAtLeft?u:w-u;
  const r=Math.min(w*.18,h*.33), end=w-5;
  const roundedEnd=Math.min(3.2,h*.05);
  shape.moveTo(x(r),-lip);
  shape.lineTo(x(end-roundedEnd),-lip);
  shape.quadraticCurveTo(x(end),-lip,x(end),-(lip+roundedEnd));
  shape.bezierCurveTo(x(end-2.4),-h*.37,x(end-2),-h*.64,x(end),-(h-lip-roundedEnd));
  shape.quadraticCurveTo(x(end),-(h-lip),x(end-roundedEnd),-(h-lip));
  shape.lineTo(x(r),-(h-lip));
  shape.bezierCurveTo(x(r*.45),-(h-lip),x(lip+1),-h*.80,x(lip+1),-h*.5);
  shape.bezierCurveTo(x(lip+1),-h*.18,x(r*.45),-lip,x(r),-lip);
  shape.closePath();
  return extrude(shape,depth,1,[depth*.11,depth*.19]);
}

function roundUpright(w,h,depth) {
  // Rounded spine in XZ. Each cover has an actual convex face so it catches
  // a continuous vertical highlight at both the locked and oblique cameras.
  const ring=40,positions=[],uv=[],indices=[];
  const rim=Math.min(3.4,w*.09,h*.06);
  const bands=[[-h+.15,.84],[-h+rim*.35,.95],[-h+rim,1],[-rim,1],[-rim*.28,.96],[0,.87]];
  const curve=t=>Math.sign(t)*Math.abs(t)**.40;
  for(const [j,[level,size]] of bands.entries())for(let i=0;i<=ring;i++){
    const angle=2*Math.PI*i/ring,c=curve(Math.cos(angle)),s=curve(Math.sin(angle));
    const z=depth*(.5+s*size*.5),recede=1-z/depth;
    positions.push(w*(.5+c*size*.5)+depth*.10*recede,level+depth*.16*recede,z);
    uv.push(i/ring,j/(bands.length-1));
    if(i&&j){
      const a=j*(ring+1)+i-(ring+2),b=a+1,c0=b+ring+1,d0=a+ring+1;
      indices.push(a,c0,b,a,d0,c0);
    }
  }
  for(const layer of [0,bands.length-1]){
    const z=depth*.5,index=positions.length/3;
    positions.push(w*.5+depth*.05,bands[layer][0]+depth*.08,z);uv.push(.5,.5);
    for(let i=0;i<ring;i++){
      const a=layer*(ring+1)+i;
      if(layer===0)indices.push(index,a,a+1);
      else indices.push(index,a+1,a);
    }
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);
  geometry.computeVertexNormals();return geometry;
}

function rebindVolumes(set, paper, portrait) {
  const children=[...set.children], clothBySource=new Map();
  for(let i=0;i<children.length;i++) {
    const cover=children[i];
    if(cover.name!=='Cloth book cover') continue;
    const {options,shapes}=cover.geometry.parameters, r=options.bevelSize;
    const corners=shapes.getPoints();
    const w=Math.max(...corners.map(p=>p.x))+2*r, h=-Math.min(...corners.map(p=>p.y))+2*r;
    const d=options.depth+2*r, front=cover.position.z+options.depth+r;
    const x=cover.position.x-r,y=cover.position.y+r;
    const origin=new T.Vector3(x,y,front-d);
    const source=cover.material;
    if(!clothBySource.has(source)){
      const cloth=mat(source.color.clone().lerp(new T.Color(0xe9d7ac),.12),'weave',.94);
      clothBySource.set(source,cloth);
    }
    const cloth=clothBySource.get(source);
    const inner=children[i+1];
    if(inner?.name==='Upright book binding' || w/h<1.58) {
      replacePart(cover,roundUpright(w,h,d),origin,cloth);
      if(inner?.name==='Upright book binding' || inner?.name==='Book page block')set.remove(inner);
      for(let j=i+2;children[j]?.name==='Paper leaf edge';j++)set.remove(children[j]);
      continue;
    }
    if(inner?.name!=='Book page block')continue;
    const upperShelf = w>365 && (portrait?x>470:x>970);
    const left = upperShelf || inner.position.x>x+12;
    const lip=clamp(h*.072,3.1,7);
    replacePart(cover,caseGeometry(w,h,d,left,lip),origin,cloth);
    replacePart(inner,leavesGeometry(w,h,d-6,left,lip+1),
      new T.Vector3(x,y,front-d+2.8),paper);
    // Remove dark rods laid across the old page face. The delicate
    // irregular leaf edges now belong to the paper material itself.
    for(let j=i+2;children[j]?.name==='Paper leaf edge';j++)set.remove(children[j]);
    if(upperShelf){
      const at=x+w*(portrait?.68:.58),sw=Math.min(w*.085,38);
      for (const [j,color] of [0xaba17b,0x888b63].entries()){
        const strip=solid(set,'Clothbound volume at ladder',
          roundUpright(sw-1,h-1,d+1.5),mat(color,'weave'));
        strip.position.set(at+j*sw,y-.8,front-d+.8);
      }
    }
  }
}

function bridgeJoinery(set, layout, h) {
  const portrait=layout===1;
  const wood=mat(0xd39760,'timber',.65),endgrain=mat(0xb77e50,'timber',.78);
  const stone=mat(0xf0d9b7,'vellum'),cloth=mat(0xb8ac7f,'weave');
  const floor=portrait?1282:919;
  // The broad plinth under the bell platform reaches ground, behind the
  // three small volumes at the mouth of the timber arch.
  const landing=set.getObjectByName('Ivory landing riser');
  if(landing) {
    const x=portrait?642:981, y=portrait?841:666;
    const shape=new T.Shape();
    const width=portrait?351:620,height=floor-y;
    shape.moveTo(8,0);shape.lineTo(width-7,0);shape.quadraticCurveTo(width,0,width,-7);
    shape.lineTo(width,-height);shape.lineTo(0,-height);shape.lineTo(0,-8);
    shape.quadraticCurveTo(0,0,8,0);
    solid(set,'Ivory book plinth down to floor',extrude(shape,129,3,[16,18]),stone)
      .position.set(x,h-y,-341);
  }
  // A sloping courtyard connects the distant tunnel mouth to the studio
  // floor. The back of the timber abutments rests in this bank. The foreground
  // notebook and walking lane remain on the near side of the graded surface.
  const ground=set.getObjectByName('Peach cyclorama floor');
  if(ground){
    const profile=portrait
      ? [[-1200,950,1200],[-505,957,1259],[-389,962,1270],[-300,967,1274],[-263,989,1277],[-245,1060,1279],[-227,1180,1281],[-213,1282,1282]]
      : [[-1200,706,773],[-539,738,859],[-392,756,878],[-283,772,892],[-251,798,896],[-232,846,899],[-213,888,901],[-197,903.39,903.39]];
    const cx=portrait?460:813, cols=portrait?[[-220,0],[-124,.12],[-86,.75],[-40,1],[105,1],[160,.71],[229,.25],[281,0]]:[[-320,0],[-255,.13],[-212,.68],[-130,1],[128,1],[190,.66],[267,.15],[313,0]];
    const pos=[],indices=[];
    for(let j=0;j<profile.length;j++){
      const [z,court,groundY]=profile[j];
      for(let i=0;i<cols.length;i++){
        const [x,amount]=cols[i];
        pos.push(cx+x,h-lerp(groundY,court,amount)-.18,z);
        if(i&&j){
          const a=j*cols.length+i;
          indices.push(a-cols.length-1,a-1,a, a-cols.length-1,a,a-cols.length);
        }
      }
    }
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
    geo.setIndex(indices);geo.computeVertexNormals();
    const bank=solid(set,'Graded floor beneath bridge piers',geo,ground.material);bank.castShadow=false;
  }

  const old=set.getObjectByName('Bridge load-bearing arch');
  if(!old)return;
  const near=61,d=100;
  const sx=portrait?268:620, ex=portrait?665:1020;
  const ty=portrait?827:642;
  const innerLeft=portrait?338:706,innerRight=portrait?578:896;
  const crown=portrait?849:656,spring=portrait?944:756,bottom=portrait?1300:925;
  const mid=(innerRight+innerLeft)/2, rx=.5*(innerRight-innerLeft);
  const recess=y=>{
    const u=clamp((y-ty-4)/(portrait?82:71),0,1);
    return u*u*(3-2*u)*(portrait?388:357);
  };
  // Sweep a vaulted timber section in both directions. The near wall also
  // needs vertical subdivisions: a single triangulated front cap would span
  // clear across the curved bank and cut in front of the notebook.
  const crownProfile=[[sx,bottom],[lerp(sx,innerLeft,.5),bottom],[innerLeft,bottom]];
  for(let n=0;n<=48;n++) {
    const a=Math.PI*n/48;
    crownProfile.push([mid-rx*Math.cos(a),spring-(spring-crown)*Math.sin(a)]);
  }
  crownProfile.push([innerRight,bottom],[lerp(innerRight,ex,.5),bottom],[ex,bottom]);
  const project=(index,vertical,depth)=>{
    const [x,low]=crownProfile[index],t=(x-sx)/(ex-sx);
    const top=ty+9-15*Math.sin(t*Math.PI)+(portrait?26:12)*t**4;
    const y=lerp(top,low,vertical);
    return [x-49*depth,h-y+8*depth,near-d*depth-recess(y)];
  };
  const pos=[],indices=[];
  const last=crownProfile.length-1;
  function patch(cols,rows,point,flipped){
    const first=pos.length/3;
    for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
      pos.push(...point(i,j));
      if(!j||!i)continue;
      const c=first+j*(cols+1)+i,dv=c-1,bb=c-cols-1,aa=bb-1;
      if(flipped)indices.push(aa,c,bb,aa,dv,c);
      else indices.push(aa,bb,c,aa,c,dv);
    }
  }
  patch(last,20,(i,j)=>project(i,j/20,0),true);
  patch(last,20,(i,j)=>project(i,j/20,1),false);
  patch(last,8,(i,j)=>project(i,0,j/8),false);
  patch(last,8,(i,j)=>project(i,1,j/8),true);
  patch(8,20,(i,j)=>project(0,j/20,i/8),false);
  patch(8,20,(i,j)=>project(last,j/20,i/8),true);
  const timber=new T.BufferGeometry();
  timber.setAttribute('position',new T.Float32BufferAttribute(pos,3));timber.setIndex(indices);timber.computeVertexNormals();
  replacePart(old,timber,new T.Vector3(),wood);
  // Individual radial blocks form the thin face of the arch ring. A piece
  // stops just short of its neighbor, exposing the darker timber beneath its
  // bevel. Every piece has front, rear and edge faces following the vault.
  const ringPositions=[], ringColors=[], ringIndices=[];
  const ray=new T.Raycaster(), eye=new T.Vector3(), sight=new T.Vector3(0,0,-1);
  old.updateWorldMatrix(true,false);
  const blockCount=21;
  for(let block=0;block<blockCount;block++){
    const tint=new T.Color(0xffffff).multiplyScalar(.97+.045*Math.sin(block*1.71));
    const base=ringPositions.length/3;
    for(const behind of [true,false])for(let radial=0;radial<=1;radial++)for(let k=0;k<=3;k++){
      const ang=(block+.022+(k/3)*.956)*Math.PI/blockCount;
      const c=Math.cos(ang),sn=Math.sin(ang);
      const dx=-c/rx,dy=-sn/(spring-crown),mag=Math.hypot(dx,dy);
      const innerX=mid-rx*c,innerY=spring-(spring-crown)*sn;
      const t=clamp((innerX-sx)/(ex-sx),0,1);
      const top=ty+9-15*Math.sin(t*Math.PI)+(portrait?26:12)*t**4;
      const width=Math.min(20,Math.max(1.1,(innerY-top-1)*mag/Math.max(.00001,-dy)));
      const radius=.6+radial*width;
      const xx=innerX+radius*dx/mag, yy=innerY+radius*dy/mag;
      ray.set(eye.set(xx,h-yy,near+10),sight);
      const hit=ray.intersectObject(old,false)[0];
      const surfZ=hit?.point.z??near-recess(yy);
      ringPositions.push(xx,h-yy,surfZ+(behind?-.45:.7));
      ringColors.push(tint.r,tint.g,tint.b);
    }
    const quad=(a,b,c,d)=>ringIndices.push(base+a,base+b,base+c,base+a,base+c,base+d);
    for(let k=0;k<3;k++){
      quad(8+k,9+k,13+k,12+k);quad(k,4+k,5+k,1+k);
      quad(k,1+k,9+k,8+k);quad(4+k,12+k,13+k,5+k);
    }
    quad(0,8,12,4);quad(3,7,15,11);
  }
  const staves=new T.BufferGeometry();
  staves.setAttribute('position',new T.Float32BufferAttribute(ringPositions,3));
  staves.setAttribute('color',new T.Float32BufferAttribute(ringColors,3));
  staves.setIndex(ringIndices);staves.computeVertexNormals();
  const faceWood=mat(0xd59a66,'timber',.69);faceWood.vertexColors=true;
  solid(set,'Joined radial staves of the timber vault',staves,faceWood);

  // The visible end grain follows one connected vaulted wall. These slender
  // joints follow the actual timber laminations deep into its soffit.
  const seams=[];
  for(let i=1;i<=3;i++){
    const z=near-d*i/4;
    const dx=-49*i/4,dy=-8*i/4;
    const path=[new T.Vector3(innerLeft+dx,h-bottom-dy,z),new T.Vector3(innerLeft+dx,h-spring-dy,z)];
    for(let j=0;j<=42;j++){
      const a=Math.PI*j/42;
      path.push(new T.Vector3(mid-rx*Math.cos(a)+dx,h-spring+(spring-crown)*Math.sin(a)-dy,z));
    }
    path.push(new T.Vector3(innerRight+dx,h-bottom-dy,z));
    for(const point of path)point.z-=recess(h-point.y);
    for(let n=0;n<path.length-1;n++)seams.push(...path[n].toArray(),...path[n+1].toArray());
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(seams,3));
  const seam=new T.LineSegments(geometry,new T.LineBasicMaterial({color:0xae7851,transparent:true,opacity:.4}));
  seam.name='Laminations in the bridge soffit';set.add(seam);

  const deck=set.getObjectByName('Closed arched bridge deck');deck.material=wood;
  for(const joint of named(set,'Bridge stave joint')){
    joint.material=endgrain;
    joint.scale.x=joint.scale.z=.62;
  }
  const brass=new T.MeshStandardMaterial({color:0xc3974e,roughness:.32,metalness:.62});
  const railPoints=portrait
    ? [[265,774],[314,761],[356,752],[429,749],[494,754],[571,772],[628,795],[668,814]]
    : [[622,600],[692,573],[741,565],[801,561],[876,566],[950,577],[1019,599]];
  const railCurve=new T.CatmullRomCurve3(railPoints.map(([x,y])=>new T.Vector3(x,h-y,-29)));
  const rail=set.getObjectByName('Bridge rear handrail');
  if(rail){
    replacePart(rail,new T.TubeGeometry(railCurve,56,3.4,12,false),new T.Vector3(),wood);
    const parents=named(set,'Bridge rear baluster');
    for(const part of [...parents,...named(set,'Bridge finial')])set.remove(part);
    const posts=portrait?[1,2,3,4,5,6]:[1,2,4,5];
    const gold=[1,5];
    for(const index of posts){
      const [x,y]=railPoints[index], t=clamp((x-sx)/(ex-sx),0,1);
      const deckY=ty-15*Math.sin(t*Math.PI)+(portrait?26:12)*t**4-9;
      const main=gold.includes(index);
      const upper=y-(main?7:0),radius=main?6.2:3.5;
      const stem=solid(set,'Bridge rear baluster',
        new T.CylinderGeometry(radius*.95,radius,deckY-upper,18),brass);
      stem.position.set(x,h-(upper+deckY)/2,-29);
      const collar=solid(set,'Turned brass foot collar',
        new T.CylinderGeometry(radius+1.7,radius+2.3,4,20),brass);
      collar.position.set(x,h-deckY+2,-29);
      if(main){
        const rim=solid(set,'Turned brass neck collar',
          new T.CylinderGeometry(radius+1,radius+1.4,3,20),brass);
        rim.position.set(x,h-upper-1.5,-29);
        const finial=solid(set,'Bridge finial',new T.SphereGeometry(7.6,18,14),brass);
        finial.position.set(x,h-upper+7,-29);
      }
    }
  }
  // End joints continue down the front edge of the load-bearing deck. Their
  // shallow inset reads at the locked camera and also turns with the beam.
  const joints=[];
  for(let i=1;i<26;i++){
    const t=i/26,x=lerp(sx,ex,t),y=ty-15*Math.sin(Math.PI*t)+(portrait?26:12)*t**4+10.9;
    joints.push(x,h-y,67.55,x,h-y-16.8,67.55);
  }
  const jointGeo=new T.BufferGeometry();
  jointGeo.setAttribute('position',new T.Float32BufferAttribute(joints,3));
  const frontSeams=new T.LineSegments(jointGeo,new T.LineBasicMaterial({color:0x9c714d,transparent:true,opacity:.45}));
  frontSeams.name='Front joinery of the bridge staves';set.add(frontSeams);

  // Put the three slim upright volumes in front of the right timber pier,
  // as in the mock. Their feet stand on the floor behind the open notebook.
  if(!portrait){
    for(const [i,[x,top,w,c]] of [[933,696,40,stone],[972,690,36,stone],[1005,708,35,cloth]].entries()){
      const deep=58;
      const part=solid(set,'Books against bridge abutment '+i,roundUpright(w,914-top,deep),c);
      part.position.set(x,h-top,-59-deep+i);
    }
  }
}

function pageMaterials(paper,redraw) {
  const faces=[paper.clone(),paper.clone()];
  if (typeof document==='undefined')return faces;
  const make=(right)=>{
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=448;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fffcf5';ctx.fillRect(0,0,canvas.width,canvas.height);
    if(right){
      ctx.strokeStyle='rgba(155,127,90,.14)';ctx.lineWidth=.8;
      for(let y=24;y<431;y+=13){
        ctx.beginPath();ctx.moveTo(18,y);ctx.bezierCurveTo(140,y-.8,380,y+1,490,y+.4);ctx.stroke();
      }
    }
    const texture=new T.CanvasTexture(canvas);
    texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
    return {canvas,ctx,texture};
  };
  for(const [i,face] of faces.entries()){
    const {ctx,texture}=make(i===1);
    face.map=texture;
    if(i===0) {
      const pencil=new Image();
      pencil.onload=()=>{
        ctx.drawImage(pencil,34,18,426,382);
        texture.needsUpdate=true;
        // Reduced motion still receives a frame when the pencil work arrives.
        redraw?.();
      };
      pencil.src=new URL('../props/notebook-graphite.png',import.meta.url).href;
    }
  }
  return faces;
}

// Indexed columns let paper and its artwork bend through the same curl. The
// notebook's signed contact surface is retained at every x,z of its new top.
function pageBlock(surface, anchors, thickness, layer, right, cover) {
  const n=42,m=10;
  const positions=[],uv=[],indices=[];
  const [backGutter,backEdge,nearGutter,nearEdge]=anchors;
  const half=surface.halfWidth;
  function point(u,v,low) {
    const margin=cover?-7/half:layer/half*.15;
    const across=lerp(.001,1-margin,u);
    const inset=cover?-.022:.006*layer/12;
    const t=lerp(inset,1-inset,v);
    const backX=lerp(backGutter[0],backEdge[0],across);
    const frontX=lerp(nearGutter[0],nearEdge[0],across);
    const x=lerp(backX,frontX,t);
    const rise=Math.sin(Math.PI*across)*(right?13:17);
    const edgeBend=Math.pow(across,7)*Math.sin(Math.PI*t)*3;
    const y=lerp(lerp(backGutter[1],backEdge[1],across),lerp(nearGutter[1],nearEdge[1],across),t) - rise + edgeBend;
    // Use the reference-space position to find the original surface height,
    // then offset the separate signatures vertically beneath the writing face.
    const worldY=surface.artHeight-y;
    const signed=surface.centerY+12*Math.sin(Math.PI*Math.abs(x-surface.centerX)/half);
    const z=surface.centerZ+(signed-worldY)/surface.pitch;
    return [x,worldY-layer-(low?thickness:0),z];
  }
  for(let low=0;low<=1;low++) for(let j=0;j<=m;j++)for(let i=0;i<=n;i++){
    positions.push(...point(i/n,j/m,low));
    uv.push(right?i/n:1-i/n,1-j/m);
  }
  const stride=n+1, underside=(m+1)*stride;
  function quad(a,b,c,d,reverse) {
    if(reverse)indices.push(a,c,b,a,d,c);else indices.push(a,b,c,a,c,d);
  }
  for(let j=0;j<m;j++)for(let i=0;i<n;i++){
    const a=j*stride+i;
    quad(a,a+1,a+1+stride,a+stride,right);
    quad(a+underside,a+1+underside,a+1+stride+underside,a+stride+underside,!right);
  }
  function edgeFace(a,b,c,d,reverse) {
    const offset=positions.length/3;
    for(const k of [a,b,c,d]){
      positions.push(positions[k*3],positions[k*3+1],positions[k*3+2]);
      uv.push(uv[k*2],uv[k*2+1]);
    }
    quad(offset,offset+1,offset+2,offset+3,reverse);
  }
  for(let j=0;j<m;j++)for(const i of [0,n]){
    const a=j*stride+i;
    edgeFace(a,a+stride,a+stride+underside,a+underside,(i===0)===right);
  }
  for(let i=0;i<n;i++)for(const j of [0,m]){
    const a=j*stride+i;
    edgeFace(a,a+1,a+1+underside,a+underside,(j===m)===right);
  }
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);
  // Use analytic top/bottom normals. Shared edges must not pull the normal
  // horizontal, which would draw a hard stripe on the top of every sheet.
  g.computeVertexNormals();
  const normals=g.attributes.normal;
  for(let lo=0;lo<=1;lo++)for(let j=0;j<=m;j++)for(let i=0;i<=n;i++){
    const k=lo*underside+j*stride+i;
    const x=positions[k*3],u=Math.PI*Math.abs(x-surface.centerX)/half;
    const dx=12*Math.cos(u)*Math.sign(x-surface.centerX)*Math.PI/half;
    const norm=new T.Vector3(-dx,1,surface.pitch).normalize().multiplyScalar(lo?-1:1);
    normals.setXYZ(k,norm.x,norm.y,norm.z);
  }
  return g;
}

function finishNotebook(set,layout,h,paper,redraw){
  const contacts=set.userData.contacts.notebookSurface;
  const surfaces=named(set,'Notebook writing surface');
  const covers=named(set,'Notebook cloth cover');
  const stacks=named(set,'Notebook signature');
  if(surfaces.length!==2)return;
  const paperFaces=pageMaterials(paper,redraw);
  const bounds=layout ? [[510,1350],[297,1338],[462,1518],[157,1503],[823,1368],[814,1519]]
    : [[1086,780],[925,769],[1058,933],[824,916],[1379,793],[1351,936]];
  const coverMat=mat(0x686b48,'weave');
  for(const [i,right] of [false,true].entries()){
    const leaf=surfaces[i], board=covers[i];
    const anchors=[bounds[0],bounds[right?4:1],bounds[2],bounds[right?5:3]];
    // Relative Z may include the integrator's near-to-far registration.
    const surface={...contacts,centerZ:contacts.centerZ-leaf.position.z,artHeight:h};
    const geometry=(thickness,layer,cover=false)=>pageBlock(surface,anchors,thickness,layer,right,cover);
    replacePart(leaf,geometry(1.25,0),null,paperFaces[i]);
    const signatures=stacks.slice(i*5,i*5+5);
    signatures.forEach((signature,index)=>{
      const layer=2.0+(4-index)*1.8;
      const signaturePaper=paper.clone();signaturePaper.color.multiplyScalar(index%2?.84:.96);
      replacePart(signature,geometry(2.3,layer),null,signaturePaper);
    });
    replacePart(board,geometry(7,10,true),null,coverMat);
  }
  for(const line of named(set,'Notebook drafting line'))set.remove(line);
}

export function finishBooks(set,layout,redraw) {
  if(set.userData.boundBooksFinished)return;
  const h=layout?1659:1024;
  const paper=mat(0xf4dfc2,'paper',.92);
  rebindVolumes(set,paper,layout===1);
  bridgeJoinery(set,layout,h);
  finishNotebook(set,layout,h,paper,redraw);
  set.userData.boundBooksFinished=true;
  set.updateMatrixWorld(true);
}
