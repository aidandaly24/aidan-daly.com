import * as T from '../vendor/package/build/three.module.js';

const grainColour = 0xf1c18d;
const up = new T.Vector3(0, 1, 0);
const tau = Math.PI * 2;
let maple, workspace, sampledSurfaces;
function mapleTexture() {
  if (maple) return maple;
  // Continuous grain follows the bend. The same lamina appears along both legs.
  const w=256,h=128,data=new Uint8Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=x/w*tau,v=y/h*tau;
    const drift=.51*Math.sin(u)+.21*Math.cos(3*u+v)+.11*Math.sin(2*u-2*v);
    const fine=Math.cos(41*v+drift*2.7)+.65*Math.cos(23*v+drift*5);
    const veins=Math.pow(.5+.5*Math.cos(8*v+drift+.38*Math.sin(2*v)),9);
    const grain=249+fine*2.5-15*veins-2*Math.cos(v*5);
    const i=(y*w+x)*4;
    data[i]=Math.min(255,grain);data[i+1]=Math.min(255,grain-1);data[i+2]=Math.min(255,grain-2);data[i+3]=255;
  }
  maple=new T.DataTexture(data,w,h);
  maple.wrapS=maple.wrapT=T.RepeatWrapping;
  maple.magFilter=T.LinearFilter;maple.minFilter=T.LinearMipmapLinearFilter;
  maple.generateMipmaps=true;maple.colorSpace=T.SRGBColorSpace;maple.needsUpdate=true;
  return maple;
}

// These two seamless, high-pass samples are made from clear material regions
// of the approved mock. Each object is lit by the room at its actual depth.
function originalMaterials() {
  if (!sampledSurfaces) {
    const loader=new T.TextureLoader();
    function load(filename) {
      return loader.loadAsync(new URL('../props/'+filename,import.meta.url).href).then(texture=>{
        texture.wrapS=texture.wrapT=T.RepeatWrapping;
        texture.colorSpace=T.SRGBColorSpace;
        return texture;
      });
    }
    sampledSurfaces=Promise.all([load('nook-maple.png'),load('nook-upholstery.png')]).then(([timber,fabric])=>{
      fabric.repeat.set(8,4);
      return {timber,fabric};
    });
  }
  return sampledSurfaces;
}

function timber() {
  return new T.MeshStandardMaterial({color:grainColour,map:mapleTexture(),roughness:.56});
}
function paint(color,roughness=.7,metalness=0) {
  return new T.MeshStandardMaterial({color,roughness,metalness});
}
function geometry(position, uv, indices, colors) {
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(position,3));
  if(uv)geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  if(colors)geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
function path2(first, segments) {
  const path=new T.CurvePath();
  let a=new T.Vector2(...first);
  for(const seg of segments){
    const pts=seg.map(p=>new T.Vector2(...p)), b=pts.at(-1);
    path.add(pts.length===1?new T.LineCurve(a,b):new T.CubicBezierCurve(a,pts[0],pts[1],b));
    a=b;
  }
  return path;
}
function bentBoard(path, h, front, back, half, radius, shear, count) {
  const vertices=[],uv=[],indices=[],cross=[],perimeter=[];
  const corners=[[half-radius,front-radius,90], [half-radius,back+radius,0],
    [-half+radius,back+radius,-90],[-half+radius,front-radius,-180]];
  for(const [cx,cz,start] of corners)for(let i=0;i<=4;i++){
    const a=(start-i*22.5)*Math.PI/180;
    cross.push([cx+radius*Math.cos(a),cz+radius*Math.sin(a)]);
  }
  cross.push(cross[0]);perimeter[0]=0;
  for(let j=1;j<cross.length;j++)perimeter[j]=perimeter[j-1]+Math.hypot(cross[j][0]-cross[j-1][0],cross[j][1]-cross[j-1][1]);
  const ring=cross.length,length=path.getLength();
  for(let i=0;i<=count;i++){
    const t=i/count, at=path.getPointAt(t), tangent=path.getTangentAt(t);
    for(let j=0;j<ring;j++){
      const [r,z]=cross[j], backAmount=(front-z)/(front-back);
      vertices.push(at.x+tangent.y*r+shear[0]*backAmount, h-at.y+tangent.x*r-shear[1]*backAmount,z);
      uv.push(t*length/248,perimeter[j]/115);
      if(i<count&&j<ring-1){
        const a=i*ring+j;indices.push(a,a+ring,a+1,a+1,a+ring,a+ring+1);
      }
    }
  }
  for(let j=1;j<ring-2;j++){
    indices.push(0,j,j+1,count*ring,count*ring+j+1,count*ring+j);
  }
  return geometry(vertices,uv,indices);
}
function backPanel(cx,sr,base,h) {
  const vertices=[],colors=[],indices=[],uSteps=56,vSteps=28;
  // Soft irradiance rises from the sheltered spring of the arch toward the
  // desk, then falls off below the table. Stops are sampled clear timber
  // swatches from the original alcove, independent of any objects in it.
  const stops=[[0,0x4d2910],[25,0x512c11],[56,0x815024],[100,0xa56d38],
    [153,0xd29351],[215,0xe5a569],[273,0xe2a269],[314,0xd49860],
    [358,0xa36835],[434,0x9d6130],[500,0x965c2c]].map(([t,c])=>[t,new T.Color(c)]);
  const color=new T.Color();
  for(let j=0;j<=vSteps;j++)for(let i=0;i<=uSteps;i++){
    const u=i/uSteps, t=j/vSteps;
    const x=cx+233*(u*2-1), top=sr-233*Math.sqrt(Math.max(0,1-(u*2-1)**2));
    const y=T.MathUtils.lerp(base,top,t);
    const edge=Math.min(x-(cx-234),cx+234-x,(y-top)*.92);
    const distance=y-(sr-236);
    let k=1;while(k<stops.length-1 && distance>stops[k][0])k++;
    const [t0,c0]=stops[k-1],[t1,c1]=stops[k];
    const blend=T.MathUtils.smoothstep(distance,t0,t1);
    color.copy(c0).lerp(c1,blend);
    const shelf=.30*Math.exp(-Math.pow((x-cx)/118,4)-Math.pow((y-sr+114)/20,2));
    const corner=.25*Math.exp(-edge/33);
    const floor=.15*Math.exp(-(base-y)/16);
    const glow=Math.exp(-Math.pow((x-cx+135)/96,2)-Math.pow((y-sr-36)/70,2));
    const shadow=(1-corner)*(1-floor)*(1-shelf);
    vertices.push(x,h-y,-78-3*Math.sin(u*Math.PI));
    colors.push(color.r*shadow*1.38+glow*.27,color.g*shadow*1.33+glow*.155,color.b*shadow*1.26+glow*.071);
    if(j<vSteps&&i<uSteps){
      const a=j*(uSteps+1)+i;
      indices.push(a,a+1,a+uSteps+1,a+1,a+uSteps+2,a+uSteps+1);
    }
  }
  // The liner is a fitted timber back, closed all around. Preserve the
  // smooth front normal by giving the perimeter and rear their own vertices.
  const faceCount=vertices.length/3,frontIndices=[...indices];
  for(let i=0;i<faceCount;i++){
    vertices.push(vertices[i*3],vertices[i*3+1],vertices[i*3+2]-12);
    colors.push(colors[i*3]*.72,colors[i*3+1]*.72,colors[i*3+2]*.72);
  }
  for(let i=0;i<frontIndices.length;i+=3)indices.push(faceCount+frontIndices[i],faceCount+frontIndices[i+2],faceCount+frontIndices[i+1]);
  const rim=[];
  for(let i=0;i<=uSteps;i++)rim.push(i);
  for(let j=1;j<=vSteps;j++)rim.push(j*(uSteps+1)+uSteps);
  for(let i=uSteps-1;i>=0;i--)rim.push(vSteps*(uSteps+1)+i);
  for(let j=vSteps-1;j>0;j--)rim.push(j*(uSteps+1));
  for(let j=0;j<rim.length;j++){
    const a=rim[j],b=rim[(j+1)%rim.length],k=vertices.length/3;
    for(const i of [a,a+faceCount,b+faceCount,b]){
      vertices.push(vertices[i*3],vertices[i*3+1],vertices[i*3+2]);
      colors.push(colors[i*3],colors[i*3+1],colors[i*3+2]);
    }
    indices.push(k,k+1,k+2,k,k+2,k+3);
  }
  return geometry(vertices,null,indices,colors);
}
const power=(v,n)=>Math.sign(v)*Math.abs(v)**n;
function cushionGeo(map,latitudes=20,longitudes=44) {
  const pts=[],uv=[],indices=[];
  for(let y=0;y<=latitudes;y++)for(let x=0;x<=longitudes;x++){
    const lat=(y/latitudes-.5)*Math.PI,lon=x/longitudes*tau;
    pts.push(...map(lat,lon));uv.push(x/longitudes,y/latitudes);
    if(y<latitudes&&x<longitudes){
      const a=y*(longitudes+1)+x;
      indices.push(a,a+longitudes+1,a+1,a+1,a+longitudes+1,a+longitudes+2);
    }
  }
  return geometry(pts,uv,indices);
}
function seamGeo(map, latitude, radius) {
  const points=Array.from({length:48},(_,i)=>new T.Vector3(...map(latitude,i/48*tau)));
  return new T.TubeGeometry(new T.CatmullRomCurve3(points,true,'centripetal'),64,radius,5,true);
}

export function finishNook(set,layout,redraw) {
  if(set.userData.nookFinished)return;
  set.userData.nookFinished=true;
  const portrait=Boolean(layout),h=portrait?1659:1024;
  const dx=portrait?18:0,dy=portrait?377:0;
  const cx=portrait?282:273,sr=(portrait?838:450)+256,base=portrait?1303:921;
  const sx=portrait?301:285, sy=portrait?1191:815;
  const wood=timber(),under=paint(0xc88a53,.74);
  const cloth=paint(0xa7a171,.94),stitch=paint(0xb8b384,.96);
  const brass=paint(0xd8a052,.32,.58),dark=paint(0x51422e,.54,.24);
  const satin=paint(0xdfcbb0,.4,.38),keys=paint(0xf4dfc6,.67);
  if(typeof document!=='undefined')originalMaterials().then(({timber,fabric})=>{
    wood.map=timber;wood.bumpMap=timber;wood.bumpScale=.035;wood.color.set(0xffc790);wood.needsUpdate=true;
    cloth.map=fabric;cloth.bumpMap=fabric;cloth.bumpScale=.035;cloth.color.set(0xb0a774);cloth.needsUpdate=true;
    under.map=mapleTexture();under.needsUpdate=true;
    redraw?.();
  }).catch(()=>{});
  function mesh(name,geo,mat) {
    const ob=new T.Mesh(geo,mat);ob.name=name;ob.castShadow=ob.receiveShadow=true;
    set.add(ob);return ob;
  }
  function bar(name,a,b,r,r2,mat,sides=16){
    const d=b.clone().sub(a), ob=mesh(name,new T.CylinderGeometry(r2,r,d.length(),sides),mat);
    ob.position.copy(a).lerp(b,.5);ob.quaternion.setFromUnitVectors(up,d.normalize());return ob;
  }
  function P(x,y,z){return new T.Vector3(x,h-y,z);}
  function A(x,y,z){return P(x+dx,y+dy,z);}
  const remove=new Set(['Bent maple study alcove','Full alcove liner','Bent side table',
    'Bent maple work desk','Floating maple shelf','Terminal text','Terminal prompt','Chair seat cushion',
    'Chair back cushion','Chair armrest pad','Keyboard key','Monitor stand','Dark monitor glass','Desk modesty panel',
    'Lamp metal shade','Lamp diffuser','Terracotta coffee mug','Coffee surface','Coffee mug handle']);
  for(const child of [...set.children])if(remove.has(child.name))set.remove(child);

  const arch=path2([cx-244,base],[
    [[cx-244,sr]],[[cx-244,sr-130.5],[cx-134.8,sr-236],[cx,sr-236]],
    [[cx+134.8,sr-236],[cx+244,sr-130.5],[cx+244,sr]],[[cx+244,base]],
  ]);
  mesh('Bent maple study alcove',bentBoard(arch,h,55,-118,20.5,4,[10,-7],104),wood);
  const liner=paint(0xffffff,.89);liner.vertexColors=true;
  mesh('Full alcove liner',backPanel(cx,sr,base,h),liner);
  // The outside book stack sits behind the closed interior, including its page lips.
  for(const ob of set.children)if(/^(Cloth book cover|Upright book binding|Book page block|Paper leaf edge)$/.test(ob.name)){
    const bounds=new T.Box3().setFromObject(ob);
    const exteriorBinding=bounds.min.x<cx-120 || bounds.min.x>cx+26;
    const shelfItem=bounds.min.x>=cx-82 && bounds.max.x<=cx+65 && bounds.max.z>=-45;
    if(exteriorBinding && !shelfItem && bounds.min.x<cx+230 && bounds.max.z>-85 && bounds.max.z < -47 && h-bounds.min.y>sr-194
      && h-bounds.max.y<base){
      ob.position.z-=bounds.max.z+86;
    }
  }
  for (const ob of set.children) {
    if(ob.name==='Notebook on the desk') {ob.position.y+=5;ob.position.z+=24;}
  }
  const shelfY=portrait?958:577;
  mesh('Floating maple shelf',bentBoard(path2([cx-126,shelfY],[[[cx+106,shelfY]]]),h,-29,-109,5.2,2.5,[4,-5],8),wood);
  const seatMap=(lat,lon)=>{
    const ring=Math.pow(Math.max(0,Math.cos(lat)),.66), ny=power(Math.sin(lat),.66);
    const x=power(Math.cos(lon),.67)*ring,z=power(Math.sin(lon),.70)*ring;
    return [sx-7+x*58-z*2, h-(sy+23)+ny*15+.35*x,14+z*(36+2*x)];
  };
  const backMap=(lat,lon)=>{
    const t=power(Math.sin(lat),.70),r=Math.pow(Math.max(0,Math.cos(lat)),.50);
    const x=power(Math.cos(lon),.74)*r,z=power(Math.sin(lon),.71)*r;
    return [sx-71-15*t+x*(23.5-3*t)-4*z,h-(sy-40)+t*69-z*3+3*x,11+z*(38+3*t)];
  };
  mesh('Chair seat cushion',cushionGeo(seatMap),cloth);
  mesh('Chair seat welt',seamGeo(seatMap,-.31,.8),stitch);
  mesh('Chair back cushion',cushionGeo(backMap),cloth);
  // A curved welt follows the near-side edge of the back from the underside to its crest.
  const backProfile=[];
  for(let i=0;i<60;i++){
    const a=i/60*tau,lat=Math.asin(.92*Math.sin(a));
    const lon=Math.atan2(.86,Math.cos(a));
    backProfile.push(new T.Vector3(...backMap(lat,lon)));
  }
  mesh('Chair back welt',new T.TubeGeometry(new T.CatmullRomCurve3(backProfile,true),84,.7,6,true),stitch);
  for(const side of [-1,1]){
    const z=14+side*31;
    const pad=(lat,lon)=>{
      const r=Math.pow(Math.max(0,Math.cos(lat)),.52);
      return [sx+1+38*power(Math.cos(lon),.68)*r,h-(sy-13)+10*power(Math.sin(lat),.7),z+11*power(Math.sin(lon),.65)*r];
    };
    mesh('Chair armrest pad',cushionGeo(pad,14,32),cloth);
    mesh('Chair armrest welt',seamGeo(pad,-.38,.62),stitch);
  }
  for(const ob of set.children){
    if(ob.name==='Chair caster spoke'||ob.name==='Chair gas lift')ob.material=brass;
    if(ob.name==='Chair base hub'||ob.name==='Chair caster fork'||ob.name==='Chair caster wheel')ob.material=dark;
  }
  for(const wheel of set.children.filter(o=>o.name==='Chair caster wheel')){
    const c=wheel.position;
    bar('Wheel bushing',c.clone().add(new T.Vector3(0,0,3.4)),c.clone().add(new T.Vector3(0,0,5.1)),2.65,2.4,brass);
  }
  const deskPath=(a,segments)=>path2([a[0]+dx,a[1]+dy],segments.map(s=>s.map(([x,y])=>[x+dx,y+dy])));
  const desk=deskPath([257,787],[
    [[303,780],[377,784],[427,789]],[[470,782],[483,801],[493,835]],
    [[501,858],[506,885],[506,917]],
  ]);
  mesh('Bent maple work desk',bentBoard(desk,h,33,-72,8,3,[11,-12],65),wood);
  // A narrow face rail and the modesty panel close the space under the worktop.
  const apron=new T.BoxGeometry(229,117,16,16,14,1);
  const apronColors=[],apronXYZ=apron.getAttribute('position');
  const ochre=new T.Color(0xd68a39),umber=new T.Color(0x884616);
  for(let i=0;i<apronXYZ.count;i++){
    const y=apronXYZ.getY(i),x=apronXYZ.getX(i);
    const shade=.28+.60*T.MathUtils.smoothstep(y,0,59)+.13*T.MathUtils.smoothstep(Math.abs(x),75,115);
    const color=ochre.clone().lerp(umber,Math.min(.94,shade));
    apronColors.push(...color.toArray());
  }
  under.color.set(0xffffff);under.vertexColors=true;
  apron.setAttribute('color',new T.Float32BufferAttribute(apronColors,3));
  const panelUV=apron.getAttribute('uv');
  for(let i=0;i<panelUV.count;i++) {const x=panelUV.getX(i), y=panelUV.getY(i);panelUV.setXY(i,y*.8,x*1.9);}
  const panel=mesh('Desk modesty panel',apron,under);panel.position.copy(A(379,852,-56));
  const side=deskPath([78,919],[
    [[80,880],[85,845],[99,818]],[[107,799],[119,794],[139,793]],
    [[159,791],[177,790],[202,788]],
  ]);
  mesh('Bent side table',bentBoard(side,h,68,-29,15.5,4,[12,-16],54),wood);
  // A small row of casebound books. Each cloth case wraps independently
  // around the rounded spine; the page blocks reveal only at the heads.
  for (const ob of [...set.children]) {
    if(!/^(Cloth book cover|Upright book binding|Book page block)$/.test(ob.name))continue;
    const box=new T.Box3().setFromObject(ob);
    if(box.min.x>cx-86 && box.max.x<cx+67 && box.max.z> -55 && box.max.z < -35 &&
      Math.abs(h-box.min.y-shelfY)<14) set.remove(ob);
  }
  const volumes=[[17,55,0xd7bb91],[15,62,0xf0d5a7],[18,70,0xdbc299],[14,63,0xeed8b3],
    [16,69,0xd5bd92],[18,65,0x928954],[15,45,0xb2a678]];
  let bookX=cx-72;
  volumes.forEach(([width,height,color],i)=>{
    const depth=39+i%3*3, half=width/2, wrap=new T.Shape();
    wrap.moveTo(-half,-depth);wrap.lineTo(-half,-3);wrap.quadraticCurveTo(-half,1,0,1.4);
    wrap.quadraticCurveTo(half,1,half,-3);wrap.lineTo(half,-depth);wrap.lineTo(half-1.3,-depth);
    wrap.lineTo(half-1.3,-3.5);wrap.quadraticCurveTo(half-1.3,-.7,0,-.3);
    wrap.quadraticCurveTo(-half+1.3,-.7,-half+1.3,-3.5);wrap.lineTo(-half+1.3,-depth);
    wrap.closePath();
    const geo=new T.ExtrudeGeometry(wrap,{depth:height,bevelEnabled:true,bevelSize:.5,bevelThickness:.65,bevelSegments:2,curveSegments:8});
    // Extrude up and face the rounded spine toward the observer.
    geo.rotateX(-Math.PI/2);geo.rotateY(Math.PI);
    const front=-37+(i%3)*1.9, bottom=shelfY-5.0;
    const ob=mesh('Nook cloth book spine',geo,paint(color,.88));
    ob.position.copy(P(bookX+half,bottom,front));
    const paper=mesh('Nook bound page block',new T.BoxGeometry(width-2.4,height-2.2,depth-3.1),
      paint(i%2?0xe6d3a9:0xf3debd,.9));
    paper.position.copy(P(bookX+half,bottom-height/2,front-depth/2-1.2));
    bookX+=width+1.65;
  });
  const glass=[
    A(332,653,-13),A(434,646,-13),A(419,736,-13),A(319,730,-13),
  ];
  // This texture contains only the original monitor's code and dark glass.
  const display=new T.MeshBasicMaterial({color:0x293b24});
  const glassVertices=[...glass,...glass.map(v=>v.clone().add(new T.Vector3(0,0,-.9)))];
  const glassIndex=[0,2,1,0,3,2,4,5,6,4,6,7];
  for(let i=0;i<4;i++){const j=(i+1)%4;glassIndex.push(i,j,i+4,j,j+4,i+4);}
  const glassGeo=geometry(glassVertices.flatMap(v=>v.toArray()),
    [0,1,1,1,1,0,0,0,0,1,1,1,1,0,0,0],glassIndex);
  const screen=mesh('Dark monitor glass',glassGeo,display);screen.castShadow=false;
  if(typeof document!=='undefined'){
    const loader=new T.TextureLoader();
    workspace??=loader.load(new URL('../props/display-workspace.png',import.meta.url).href,()=>redraw?.());
    workspace.colorSpace=T.SRGBColorSpace;
    display.map=workspace;display.color.set(0xffffff);
  }
  const stand=deskPath([374,739],[
    [[374,747],[383,758],[379,763]],[[377,768],[366,768],[350,768]],
  ]);
  mesh('Monitor stand',bentBoard(stand,h,-17,-40,2.7,1.3,[2,-2],20),satin);
  const board=set.getObjectByName('Keyboard');
  if(board){
    board.material=keys;
    // Keycap top faces meet the actor's registered wrist plane.
    const keyGeom=new T.BoxGeometry(1,1,1);
    const keyset=new T.InstancedMesh(keyGeom,paint(0xffeed9,.75),42);
    keyset.name='Beveled keyboard rows';keyset.receiveShadow=true;
    const matrix=new T.Matrix4(),q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),-.025);
    let idx=0;
    for(let j=0;j<3;j++)for(let i=0;i<14;i++){
      const x=317+4.1*i+j*.85;
      matrix.compose(A(x,768+j*1.83+(x-344)*.026,30+j*1.3),q,new T.Vector3(3.36,1.1,2.6));
      keyset.setMatrixAt(idx++,matrix);
    }
    set.add(keyset);
  }
  // Broad pressed-metal shade, hinge rivets and a second link on the articulated arm.
  for(const ob of set.children){
    if(/^Lamp (foot|hinge|metal shade|lower arm|upper arm)$/.test(ob.name))ob.material=brass;
    if(ob.name==='Lamp diffuser'){
      ob.material=new T.MeshStandardMaterial({color:0xfff0bf,emissive:0xffdf93,emissiveIntensity:.65,roughness:.48});
    }
  }
  const lathe=(profile)=>new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),40);
  const mouth=A(180,677,58), cap=A(166,648,44);
  const lampRotation=new T.Quaternion().setFromUnitVectors(up,cap.clone().sub(mouth).normalize());
  const lampBody=mesh('Spun brass lampshade',lathe([[23.5,0],[24,.8],[23.8,2.0],
    [21.5,7.2],[18.1,12.7],[13.9,17.1],[9.2,19.6],[7.3,21],[6.8,31],
    [5.8,32],[4.8,31],[5.6,21],[7.4,19],[13,15.7],[17.4,11.7],[22.2,3],[22.5,0],[23.5,0]]),brass);
  lampBody.position.copy(mouth);lampBody.quaternion.copy(lampRotation);
  const diffuser=mesh('Recessed enamel reflector',new T.SphereGeometry(1,32,16),
    new T.MeshStandardMaterial({color:0xffe6ad,emissive:0xffebc5,emissiveIntensity:.74,roughness:.7}));
  diffuser.position.copy(mouth).addScaledVector(up.clone().applyQuaternion(lampRotation),1);
  diffuser.quaternion.copy(lampRotation);diffuser.scale.set(22.2,2,22.2);
  const glaze=paint(0xb76535,.27);
  const cup=mesh('Glazed terracotta mug',lathe([[.1,0],[9,0],[11,1.1],[11.8,4.5],
    [13.4,28],[13.7,29.2],[13.1,30.0],[12.1,30],[11.8,29],[10.5,5.5],[8.8,3.3],[.1,3.3]]),glaze);
  cup.position.copy(A(181,796,67));cup.rotation.x=.18;
  const coffee=mesh('Coffee meniscus',new T.SphereGeometry(1,28,12),paint(0x432417,.22));
  coffee.position.copy(cup.position).addScaledVector(up.clone().applyQuaternion(cup.quaternion),27.5);
  coffee.quaternion.copy(cup.quaternion);coffee.scale.set(12.0,.9,12.0);
  const loop=new T.CubicBezierCurve3(A(192,771,70),A(211,766,68),A(208,793,68),A(192,788,69));
  mesh('Glazed mug handle',new T.TubeGeometry(loop,24,2.7,10,false),glaze);
  bar('Lamp spring link',A(136,774,63),A(110,690,63),1.6,1.5,brass);
  bar('Lamp spring link',A(111,693,62),A(157,656,55),1.6,1.4,brass);
  for(const [x,y,z] of [[132,775,64],[106,690,62],[157,652,55]]){
    bar('Lamp hinge rivet',A(x,y,z+4),A(x,y,z+6.4),2.5,2.0,dark);
  }
  set.updateMatrixWorld(true);
}
