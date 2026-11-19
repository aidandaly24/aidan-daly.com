import * as T from '../vendor/package/build/three.module.js';

function plasterArch(outer, radius, spring, height, depth, material, gable = 0) {
  const s = new T.Shape();
  s.moveTo(-outer, 0);
  s.lineTo(-outer, height);
  if (gable) s.lineTo(0,height+gable);
  s.lineTo(outer,height);
  s.lineTo(outer,0);
  s.lineTo(radius,0);
  s.lineTo(radius,spring);
  s.absarc(0,spring,radius,0,Math.PI,false);
  s.lineTo(-radius,0);
  s.closePath();
  const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:4,bevelSize:2,bevelThickness:2,curveSegments:36});
  g.translate(0,0,-depth);
  return new T.Mesh(g,material);
}

function solid(parent, geometry, material, position, name) {
  const mesh=new T.Mesh(geometry,material);
  mesh.name=name;
  mesh.position.set(...position);
  mesh.castShadow=mesh.receiveShadow=true;
  parent.add(mesh);
  return mesh;
}
function lathe(parent, name, profile, material, pos) {
  return solid(parent,new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),48),material,pos,name);
}

export function finishArchitecture(set,layout) {
  const h=layout?1659:1024;
  const chalk=new T.MeshStandardMaterial({color:0xf6dec1,roughness:.86});
  chalk.userData.setSurface='vellum';
  const deep=new T.MeshStandardMaterial({color:0xe2b98c,roughness:.93});
  const tile=new T.MeshStandardMaterial({color:0xd2915d,roughness:.83});
  const brass=new T.MeshStandardMaterial({color:0xd6a45a,metalness:.76,roughness:.29});
  const olive=new T.MeshStandardMaterial({color:0xa5a06d,roughness:.73});
  const remove=/^(House plaster block|House ivory gable|House arched door trim|Amber house door|Terra-cotta gable|Ivory tower|Tower cornice|Olive dome|Flagstaff|Flagstaff finial|Olive pennant|Bell hanger|Cast bell crown|Bell lip|Bell clapper)$/;
  for(const item of [...set.children]) if(remove.test(item.name))set.remove(item);

  // The gable faces slightly right in the mock. Its opening cuts all the
  // way into the plaster, so the back and reveal catch their own shadows.
  const house=new T.Group();
  const eave=layout?694:353, base=layout?794:450, wall=base-eave, rise=layout?42:53;
  const width=layout?58:78, depth=layout?78:106;
  house.name='Plaster reading house';house.position.set(layout?193:254,h-base,-97);house.rotation.y=.59;
  set.add(house);
  const wallMesh=plasterArch(width/2,layout?9:14,wall*.61,wall,depth,chalk,rise);
  wallMesh.name='Gabled house with recessed doorway';
  wallMesh.castShadow=wallMesh.receiveShadow=true;house.add(wallMesh);
  solid(house,new T.BoxGeometry(width-4,wall-4,4),deep,[0,wall/2,-depth+6],'Door recess rear wall');
  for(const side of [-1,1]){
    const half=width/2+5, slope=Math.atan2(rise,half);
    const roof=solid(house,new T.BoxGeometry(Math.hypot(half,rise)+7,7,depth+11,1,1,1),tile,[side*half/2,wall+rise/2+4,-depth/2],'Terracotta pitched roof');
    roof.rotation.z=-side*slope;
  }

  // Caps and curved profiles are solids of revolution, giving the dome
  // a highlight that turns continuously from the sunlit side into shade.
  const tower=new T.Group();
  const tx=layout?208:536, ty=layout?546:375, k=layout?.86:1;
  tower.name='Flag tower';tower.position.set(tx,h-ty,-157);tower.scale.setScalar(k);set.add(tower);
  const pier=plasterArch(50,15,58,118,61,chalk);
  pier.position.set(0,-118,0);pier.rotation.y=.28;pier.name='Limestone tower and arch reveal';
  pier.castShadow=pier.receiveShadow=true;tower.add(pier);
  const top=solid(tower,new T.BoxGeometry(111,11,76),chalk,[0,0,-30],'Capstone');
  top.rotation.y=.28;
  lathe(tower,'Patinated olive dome',Array.from({length:30},(_,i)=>{
    const a=i/29*Math.PI/2;return [50*Math.cos(a),48*Math.sin(a)];}),olive,[0,5,-28]);
  lathe(tower,'Brass flag finial',[[3,0],[5,2],[4,5],[2.5,7],[2.1,51],[3.9,52],[5.7,55],[5.2,58],[3.4,61],[0,62]],brass,[0,52,-28]);
  const flagGeo=new T.PlaneGeometry(57,23,22,6);
  const v=flagGeo.attributes.position;
  for(let i=0;i<v.count;i++){
    const u=(v.getX(i)+28.5)/57,w=v.getY(i)/23+.5;
    v.setXYZ(i,u*57,105+(w-1)*20*(1-u*.72)+5*Math.sin(u*Math.PI*2),
      -28+6*Math.sin(u*Math.PI*1.7));
  }
  flagGeo.computeVertexNormals();
  const fabric=olive.clone();fabric.side=T.DoubleSide;
  solid(tower,flagGeo,fabric,[0,0,0],'Curved cloth pennant');

  const bell=new T.Group();
  const bx=layout?814:1384,by=layout?505:355;
  bell.name='Bell and bronze yoke';bell.position.set(bx,h-by,-53);set.add(bell);
  lathe(bell,'Cast bronze bell',[[0,13],[4,13],[7,11],[8,7],[9,2],[10,-6],[13,-12],
    [16.8,-14],[17.5,-16],[16.4,-18],[13.6,-17],[11,-13],[8,-5],[6,5],[3,9],[0,9]],brass,[0,-4,0]);
  lathe(bell,'Bronze crown loop',[[1,0],[2,0],[2,15],[1,15]],brass,[0,7,0]);
  solid(bell,new T.TorusGeometry(4.8,1.5,9,22),brass,[0,15,1],'Bell suspension ring');
  solid(bell,new T.CylinderGeometry(1.7,1.7,20,12),brass,[0,-16,0],'Clapper stem');
  const clapper=solid(bell,new T.SphereGeometry(4.2,16,12),brass,[0,-24,0],'Clapper bulb');
  clapper.scale.y=1.15;
  solid(bell,new T.CylinderGeometry(2.2,2.4,30,12),brass,[0,31,0],'Bell suspension pin');

  // The toy has two separate olive blocks underneath one ivory keystone.
  // A square top supports the loose triangular roof at its original rest pose.
  for (const item of [...set.children]) if (['Olive arch pier','Ivory toy arch'].includes(item.name)) set.remove(item);
  const center = layout?635:1176;
  const baseY = layout?689:541, lintelY = layout?647:501, topY=layout?605:454;
  const widthToy = layout?83:85, pierWidth = (widthToy-34)/2;
  const toyWood = new T.MeshStandardMaterial({color:0xa49d6a,roughness:.69});
  const ivoryWood = new T.MeshStandardMaterial({color:0xf2d5b0,roughness:.76});
  function blockShape(shape, x, y, depth, material, name) {
    const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:1,bevelThickness:1,bevelSegments:3,curveSegments:24});
    const pos=g.attributes.position;
    for(let i=0;i<pos.count;i++)pos.setX(i,pos.getX(i)+11*(1-pos.getZ(i)/depth));
    g.computeVertexNormals();
    return solid(set,g,material,[x,h-y,32-depth],name);
  }
  for (const side of [-1,1]) {
    const pier=new T.Shape();
    const bh=baseY-lintelY;
    pier.moveTo(0,0);pier.lineTo(pierWidth,0);pier.lineTo(pierWidth,bh);pier.lineTo(0,bh);pier.closePath();
    blockShape(pier,center+(side<0?-widthToy/2:17),baseY,40,toyWood,'Building block pier');
  }
  const lintel=new T.Shape(),half=widthToy/2,opening=17,thick=lintelY-topY;
  lintel.moveTo(-half,0);lintel.lineTo(-half,thick);lintel.lineTo(half,thick);lintel.lineTo(half,0);
  lintel.lineTo(opening,0);lintel.lineTo(opening,4);lintel.absarc(0,4,opening,0,Math.PI,false);
  lintel.lineTo(-opening,0);lintel.closePath();
  blockShape(lintel,center,lintelY,40,ivoryWood,'Ivory arc building block');
  set.userData.contacts.roofHome = [layout?635.9:1177.8,h-topY+1,26];

  for(const o of set.children){
    if(o.name==='Bell tower')o.material=chalk;
    if(o.name==='Ivory arcade')o.material=chalk;
  }
}
