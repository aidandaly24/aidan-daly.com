import * as THREE from '../vendor/package/build/three.module.js';
import { nodes, edges } from '../city.mjs';

const dimensions = [[1536, 1024], [948, 1659]];
const tone = {
  peach: 0xeed4be, maple: 0xd69a5e, endgrain: 0xa86e40, lightWood: 0xebbb80,
  leaf: 0x778044, leafLight: 0x9a9c55, bark: 0x74512d, linen: 0xa5a073,
  olive: 0x858358, ink: 0x747353, cream: 0xefcd9e, page: 0xf8e5bf,
  brass: 0xb27b30, dark: 0x39291b, terracotta: 0xbf713f, screen: 0x293b24,
};
const Y = new THREE.Vector3(0, 1, 0);
const boxGeo = new THREE.BoxGeometry();
const sphereGeo = new THREE.SphereGeometry(1, 20, 14);
const mix = THREE.MathUtils.lerp;

export function createBookshelfSet(layout) {
  if (layout !== 0 && layout !== 1) throw new RangeError('Bookshelf layout must be 0 or 1');
  const portrait = layout === 1;
  const [w, h] = dimensions[layout];
  const set = new THREE.Group();
  set.name = 'Bookshelf City solid set';
  const p = (x, y, z) => new THREE.Vector3(x, h - y, z);
  const materials = {};
  for (const [key, color] of Object.entries(tone)) {
    materials[key] = new THREE.MeshStandardMaterial({
      name:key, color, roughness: key === 'brass' ? .31 : .82,
      metalness: key === 'brass' ? .53 : 0,
      emissive: key === 'screen' ? color : 0, emissiveIntensity: .21,
    });
  }

  function mesh(name, geo, color) {
    const ob = new THREE.Mesh(geo, materials[color]);
    ob.name = name;
    ob.castShadow = ob.receiveShadow = true;
    set.add(ob);
    return ob;
  }

  function box(name, x, y, z, dx, dy, dz, color) {
    const ob = mesh(name, boxGeo, color);
    ob.position.copy(p(x, y, z));
    ob.scale.set(dx, dy, dz);
    return ob;
  }

  function ell(name, x, y, z, rx, ry, rz, color) {
    const ob = mesh(name, sphereGeo, color);
    ob.position.copy(p(x, y, z));
    ob.scale.set(rx, ry, rz);
    return ob;
  }

  function bar(name, a, b, r, color, endRadius = r, sides = 12) {
    const start = p(...a);
    const end = p(...b);
    const axis = end.clone().sub(start);
    const ob = mesh(name, new THREE.CylinderGeometry(endRadius, r, axis.length(), sides), color);
    ob.position.copy(start.lerp(end, .5));
    ob.quaternion.setFromUnitVectors(Y, axis.normalize());
    return ob;
  }

  // Closed extrusion from an image-space outline. zNear is the unshifted face.
  function outline(name, points, zNear, depth, color, bevel = 0, shear = [0, 0]) {
    const poly = new THREE.Shape();
    const [x0, y0] = points[0];
    poly.moveTo(0, 0);
    for (const [x, y] of points.slice(1)) poly.lineTo(x - x0, y0 - y);
    poly.closePath();
    const geo = new THREE.ExtrudeGeometry(poly, {
      depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3,
    });
    const positions = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < positions.count; i++) {
      const t = 1 - positions.getZ(i) / depth;
      positions.setXY(i, positions.getX(i) + shear[0] * t, positions.getY(i) - shear[1] * t);
      uv.setXY(i, uv.getX(i) / 80, uv.getY(i) / 80);
    }
    geo.computeVertexNormals();
    const ob = mesh(name, geo, color);
    ob.position.copy(p(x0, y0, zNear - depth));
    return ob;
  }

  function rounded(name, x, y, width, height, front, depth, color, radius = 5, shear) {
    return outline(name, [[x+radius,y+radius],[x+width-radius,y+radius],
      [x+width-radius,y+height-radius],[x+radius,y+height-radius]], front-radius,
    depth-2*radius, color, radius, shear);
  }

  // The spine is a closed cloth wrap around the page block, with separate cover lips.
  function book(x, y, width, height, z, color, spineLeft = true, depth = 100) {
    const bevel = Math.min(8, height / 5, width / 5);
    const shift = [depth * .11, -depth * .19];
    rounded('Cloth book cover', x, y, width, height, z, depth, color, bevel, shift);
    const upright = height > 1.4 * width;
    if (upright) {
      rounded('Upright book binding', x + 3, y + 7, width - 6, height - 12,
        z+1, 14, color === 'page' ? 'cream' : color, 3);
      return;
    }
    const lip = Math.min(9, height * .19);
    const spine = Math.min(35, width * .24);
    const px = x + (spineLeft ? spine : 4);
    const pw = width - spine - 4;
    rounded('Book page block', px, y + lip, pw, height - lip * 2,
      z + 1, depth - 11, 'page', Math.min(4, height/12), shift);
    for (let py = y + lip + 4; py < y + height - lip - 1; py += 4) {
      box('Paper leaf edge', px + pw/2, py, z + 1.2, pw-6, .55, .6, 'cream');
    }
  }

  function arch(name, cx, spring, rx, ry, bottom, thickness, front, depth, color, shear) {
    const points = [[cx-rx, bottom]];
    for (let i = 0; i <= 32; i++) {
      const a = Math.PI * (1 - i/32);
      points.push([cx + rx*Math.cos(a), spring - ry*Math.sin(a)]);
    }
    points.push([cx+rx,bottom],[cx+rx-thickness,bottom]);
    for (let i = 32; i >= 0; i--) {
      const a = Math.PI * (1 - i/32);
      points.push([cx+(rx-thickness)*Math.cos(a), spring-(ry-thickness)*Math.sin(a)]);
    }
    points.push([cx-rx+thickness,bottom]);
    outline(name, points, front, depth, color, Math.min(3, thickness/8), shear);
  }

  function along(name, points, width, thick, color, pitch = 0) {
    // Shared cross-sections give the curved slab continuous caps and side faces.
    const vertices = [];
    for (const [x, y, z] of points) {
      const back = h-y+pitch*width/2;
      const front = h-y-pitch*width/2;
      vertices.push(x,back,z-width/2, x,front,z+width/2,
        x,front-thick,z+width/2, x,back-thick,z-width/2);
    }
    const indices = [0,1,2, 0,2,3];
    for (let i = 0; i < points.length-1; i++) {
      for (let j = 0; j < 4; j++) {
        const a = i*4+j;
        const b = i*4+(j+1)%4;
        indices.push(a,a+4,b, b,a+4,b+4);
      }
    }
    const e = (points.length-1)*4;
    indices.push(e,e+2,e+1, e,e+3,e+2);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(points.flatMap(([x]) =>
      [x/85,0,x/85,1,x/85,1.1,x/85,2.1]), 2));
    for (let i=0;i<indices.length;i+=3) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return mesh(name,geo,color);
  }

  const floorY = portrait ? 1402 : 929;
  const groundColor = new THREE.MeshStandardMaterial({color:tone.peach,roughness:1});
  if (portrait) {
    // Transition from the higher study area to the open book in the foreground.
    const bands = [[-1200,1200],[-270,1276],[-140,1290],
      [145,1518],[255,1556],[1700,1830]];
    const floorGeo = new THREE.BufferGeometry();
    floorGeo.setAttribute('position',new THREE.Float32BufferAttribute(bands.flatMap(([z,y])=>
      [-1800,h-y,z,w+1800,h-y,z]),3));
    floorGeo.setIndex(bands.slice(1).flatMap((_, i) =>
      [2*i,2*i+2,2*i+1,2*i+1,2*i+2,2*i+3]));
    floorGeo.computeVertexNormals();
    const ground = mesh('Peach cyclorama floor',floorGeo,'peach');
    ground.material = groundColor;
    ground.castShadow = false;
    const platform = along('Study floor platform',
      [[-130,1289,1],[526,1289,1],[615,1282,-20]],165,12,'maple',.12);
    platform.castShadow = false;
  } else {
    const ground = along('Peach cyclorama floor', [[-1800,floorY,0],
      [w+1800,floorY,0]],3400,28,'peach',.13);
    ground.material = groundColor;
    ground.castShadow = false;
  }

  // Desktop and portrait plates are composed separately, rather than cropped.
  const leftBooks = portrait
    ? [[-38,612,82,214,'page'],[35,592,41,235,'olive'],[82,590,46,245,'linen'],
       [-40,833,213,69,'linen'],[-25,908,208,66,'olive'],[-45,975,122,315,'olive']]
    : [[-28,291,80,185,'page'],[48,276,62,202,'olive'],[73,301,35,174,'page'],
       [105,271,62,208,'linen'],[-26,483,180,55,'linen'],[-28,550,158,54,'olive'],
       [-70,613,137,302,'linen']];
  for (const [x,y,dw,dh,c] of leftBooks) book(x,y,dw,dh,-52,c);
  const steps = portrait
    ? [[519,1152,292,82],[498,1061,248,94],[492,973,205,85],[592,905,219,65]]
    : [[518,800,275,79],[510,724,246,78],[492,653,216,70],[537,605,134,49]];
  steps.forEach(([x,y,dw,dh],i) => book(x,y,dw,dh,-7,i%2 ? 'olive' : 'linen',i!==2,118));
  if (portrait) {
    book(780,909,78,306,4,'linen',true,144);
    book(822,907,42,301,-5,'olive',true,135);
  } else {
    book(263,398,216,55,-76,'linen',false,109);
    book(303,453,193,143,-62,'olive',true,122);
    book(495,467,32,173,-35,'page');
    book(526,470,29,174,-37,'page');
  }

  function tower(x, y, k) {
    arch('Ivory tower',x,y+99*k,61*k,53*k,y+160*k,23*k,-181,86*k,'cream',[10,-12]);
    rounded('Tower cornice', x-63*k,y+42*k,126*k,13*k,-174,85*k,'page',3);
    const dome = [[x-50*k,y+43*k]];
    for (let i=0;i<=18;i++) {
      const a = Math.PI*(1-i/18);
      dome.push([x+50*k*Math.cos(a),y+43*k-47*k*Math.sin(a)]);
    }
    outline('Olive dome',dome,-170,72*k,'olive',2,[6,-3]);
    bar('Flagstaff',[x,y-6*k,-150],[x,y-58*k,-150],2.7*k,'brass');
    ell('Flagstaff finial',x,y-60*k,-150,5*k,5*k,5*k,'brass');
    const flag = [[0,0],[11,-4],[23,-1],[41,6],[54,1],[49,11],[36,16],[18,13],[0,17]];
    outline('Olive pennant',flag.map(([a,b])=>[x+a*k,y-53*k+b*k]),-149,2,'olive');
  }
  tower(portrait ? 208 : 536, portrait ? 498 : 330, portrait ? .88 : 1);
  for (let i=0;i<3;i++) {
    const x = (portrait ? 277 : 624) + i*(portrait ? 34 : 48);
    arch('Ivory arcade',x,portrait?647:483,portrait?19:26,22,portrait?750:582,10,-235,49,'cream');
  }
  const bx = portrait ? 814 : 1384;
  const by = portrait ? 505 : 355;
  arch('Bell tower',bx,by,portrait?72:74,69,portrait?696:547,28,-89,110,'cream',[15,-5]);
  bar('Bell hanger',[bx,by-44,-61],[bx,by-24,-61],3,'dark');
  bar('Cast bell crown',[bx,by+12,-54],[bx,by-22,-54],14,'brass',7,24);
  ell('Bell lip',bx,by+11,-54,19,5,16,'brass');
  ell('Bell clapper',bx,by+17,-50,4,5,4,'brass');

  const house = portrait ? [179,698,1] : [214,357,1.17];
  const [hx,hy,hk] = house;
  rounded('House plaster block',hx-57*hk,hy-16*hk,115*hk,115*hk,-116,84,'cream',4,[18,-9]);
  outline('House ivory gable',[[hx-58*hk,hy-8*hk],[hx+25*hk,hy-51*hk],
    [hx+59*hk,hy-9*hk]],-105,82,'cream',1,[14,-4]);
  arch('House arched door trim',hx+26*hk,hy+27*hk,15*hk,14*hk,hy+96*hk,4*hk,-102,8,'page');
  rounded('Amber house door',hx+15*hk,hy+19*hk,22*hk,77*hk,-104,10,'lightWood',3);
  outline('Terra-cotta gable',[[hx-65*hk,hy-14*hk],[hx+24*hk,hy-60*hk],
    [hx+65*hk,hy-14*hk],[hx+24*hk,hy-51*hk],[hx-65*hk,hy-5*hk]],-98,85,'terracotta',2,[14,-4]);

  const right = portrait ? [530,693,399,112] : [1026,546,484,96];
  book(...right,-19,'linen',false,155);
  rounded('Ivory landing riser',portrait?604:976,portrait?811:641,portrait?355:610,
    portrait?71:65,-32,147,'cream',7,[15,-18]);
  rounded('Ivory lower podium',portrait?718:1340,portrait?890:708,portrait?275:250,
    portrait?312:130,-29,155,'cream',11,[17,-24]);
  const upright = portrait
    ? [[511,618,62,76,'olive'],[563,647,54,43,'page'],[760,605,47,83,'olive'],
       [804,578,31,111,'cream'],[854,541,47,149,'linen'],[898,564,57,129,'page']]
    : [[1007,482,65,62,'olive'],[1057,500,67,46,'cream'],[1326,488,57,54,'olive'],
       [1381,429,36,115,'cream'],[1446,375,50,169,'linen'],[1491,395,54,148,'page']];
  for (const [x,y,dw,dh,c] of upright) book(x,y,dw,dh,-85,c);
  for (const [x,y] of (portrait ? [[621,646],[665,646]] : [[1147,520],[1209,520]])) {
    rounded('Olive arch pier',x-17,y,34,43,4,54,'linen',3);
  }
  arch('Ivory toy arch',portrait?638:1178,portrait?646:502,45,39,portrait?650:506,23,4,56,'page');

  const greenery = portrait
    ? [[25,579,25],[51,553,32],[103,554,36],[131,576,28],[245,677,25],[280,705,21],
       [570,602,34],[617,575,40],[923,542,34],[514,957,36],[493,922,31]]
    : [[314,370,37],[355,384,28],[518,479,28],[591,505,31],[643,546,19],
       [1077,468,32],[1115,450,45],[1508,375,40],[861,730,38],[819,738,23],[981,592,42]];
  for (const [x,y,r] of greenery) {
    ell('Moss mound',x,y,-167,r,r*.82,r,'leaf');
    for (let n=0;n<7;n++) {
      const a=n*2.39996;
      ell('Moss tuft',x+Math.cos(a)*r*.57,y+Math.sin(a)*r*.46,-145+(n%3)*6,
        r*.43,r*.44,r*.43,n%3 ? 'leaf' : 'leafLight');
    }
  }

  const span = portrait ? [268,665,827,137] : [620,1020,642,124];
  const [west,east,endY,rise] = span;
  const bridgeY = t => endY - 15*Math.sin(t*Math.PI) + (portrait ? 26 : 12) * Math.pow(t, 4);
  const deck = Array.from({length: 33}, (_,i) => {
    const t=i/32;
    return [mix(west,east,t),bridgeY(t),16];
  });
  const bridge = along('Closed arched bridge deck',deck,103,19,'maple',.21);
  const spring = endY + rise*.48;
  arch('Bridge load-bearing arch', (west+east)/2,spring,(east-west)/2,rise*.52,
    endY+rise,32,61,86,'maple');
  for (let i=1;i<26;i++) {
    const t=i/26;
    const x=mix(west,east,t), y=bridgeY(t);
    bar('Bridge stave joint',[x,y-10.4,-33],[x,y+10.6,67],.52,'endgrain',.52,5);
  }
  for (let i=0;i<=8;i++) {
    const t=i/8, x=mix(west,east,t), y=bridgeY(t), railY=y-38-29*Math.sin(t*Math.PI);
    bar('Bridge rear baluster',[x,y+5,-29],[x,railY,-29],i%4 ? 3 : 5,
      i%4 ? 'maple' : 'brass');
    if (i%4===0) ell('Bridge finial',x,railY-5,-29,7,7,7,'brass');
  }
  along('Bridge rear handrail',deck.map(([x,y],i)=>[x,y-38-29*Math.sin(i/32*Math.PI),-29]),
    9,6,'lightWood');

  const ladder = portrait ? [800,692,853,875] : [1378,549,1422,697];
  const [lx,ly,fx,fy] = ladder;
  for (const side of [-1,1]) bar('Maple ladder stile',[lx+side*17,ly,-5],
    [fx+side*17,fy,30],5,'maple',5,8);
  const rungContacts = [];
  for (let i=1;i<7;i++) {
    const t=i/7,x=mix(lx,fx,t),y=mix(ly,fy,t),z=mix(-5,30,t);
    bar('Maple ladder rung',[x-17,y,z],[x+17,y,z],3.4,'lightWood',3.4,8);
    rungContacts.push(p(x,y-3.4,z).toArray());
  }

  const cx = portrait ? 282 : 273;
  const base = portrait ? 1303 : 921;
  const apex = portrait ? 838 : 450;
  const sr = apex + 256;

  // Warm inner wall follows the roof and clears the bookshelf behind the arch.
  const wall = [[cx-234,base],[cx-234,sr]];
  for (let i=0;i<=28;i++) {
    const t=Math.PI*(1-i/28);
    wall.push([cx+234*Math.cos(t),sr-226*Math.sin(t)]);
  }
  wall.push([cx+234,base]);
  outline('Full alcove liner',wall,-160,24,'maple',2);
  arch('Bent maple study alcove',cx,sr,264,256,base,42,51,216,'maple',[13,-6]);
  const shelfY=portrait?958:577;
  rounded('Floating maple shelf',cx-122,shelfY-5,228,11,-36,90,'lightWood',3);
  for(let i=0;i<7;i++){
    const bh=[52,63,70,56,68,65,46][i];
    book(cx-72+i*16,shelfY-bh-5,16,bh,-43,i>4?'linen':'page',true,55);
  }

  const dx=portrait?18:0,dy=portrait?377:0;
  const at=(x,y,z)=>[x+dx,y+dy,z];
  const desktop = [[57,920],[73,821],[99,795],[140,783],[182,784],[185,799],
    [149,805],[126,820],[111,840],[101,920]];
  outline('Bent side table',desktop.map(([x,y])=>[x+dx,y+dy]),67,98,'maple',4,[9,-15]);
  const desk = [[275,773],[333,769],[420,766],[465,778],[497,809],[522,915],[485,916],
    [470,834],[448,803],[385,793],[275,791]];
  outline('Bent maple work desk',desk.map(([x,y])=>[x+dx,y+dy]),34,130,'maple',4,[15,-13]);
  rounded('Desk modesty panel',300+dx,788+dy,174,126,-68,23,'endgrain',4);
  const screen = [[312,742],[327,650],[437,642],[421,748]];
  outline('Monitor opaque case',screen.map(([x,y])=>[x+dx,y+dy]),-19,13,'cream',3,[2,-3]);
  outline('Dark monitor glass',[[319,730],[332,653],[434,646],[419,736]]
    .map(([x,y])=>[x+dx,y+dy]),-15,2,'screen',1);
  for (let i=0;i<11;i++) {
    const lineY = 662+i*5.7;
    const lineX = 341-i*.75;
    box('Terminal prompt',lineX+dx,lineY+dy,-13,2.7,1.5,1,'leafLight');
    const lineWidth=[24,33,14,54,31,23,51][i%7];
    box('Terminal text',lineX+7+lineWidth/2+dx,lineY+dy,-13,lineWidth,1.5,1,i%3?'page':'leafLight');
  }
  bar('Monitor stand',at(374,744,-27),at(377,767,-15),4,'cream',7);
  rounded('Keyboard',313+dx,765+dy,66,12,29,36,'page',2,[6,-4]);
  for (let i=0;i<12;i++) box('Keyboard key',318+dx+i*4.9,768+dy,29.7,3.5,1.2,2,'cream');
  rounded('Notebook on the desk',393+dx,775+dy,77,11,12,32,'linen',2,[8,-5]);
  rounded('Notebook on the desk',400+dx,769+dy,72,9,13,30,'page',2,[8,-5]);
  bar('Pencil cup',at(461,776,9),at(461,745,9),12,'cream',14);
  for(let i=0;i<5;i++) bar('Pencil',at(454+i*4,751,8+i%2*4),
    at(447+i*7,720+i%2*5,8+i%2*4),1.4,i%2?'olive':'maple');

  const sx = portrait ? 301 : 285;
  const sy = portrait ? 1191 : 815;
  const chairFloor = portrait ? 1287 : 914;
  // The swivel chair has one gas lift and a braced five-spoke caster base.
  const seat = ell('Chair seat cushion',sx-7,sy+23,14,47,14,36,'linen');
  seat.rotation.z = -.035;
  const back = ell('Chair back cushion',sx-69,sy-53,11,26,64,39,'olive');
  back.rotation.z = .26;
  bar('Chair back spine',[sx-56,sy+15,13],[sx-64,sy-35,11],6,'ink');
  bar('Chair back attachment',[sx-16,sy+24,14],[sx-56,sy+15,13],6,'dark');
  for(const side of [-1,1]) {
    const z=14+side*31;
    bar('Chair armrest upright',[sx-9,sy+27,z],[sx-9,sy-12,z],4,'dark');
    ell('Chair armrest pad',sx+1,sy-13,z,35,8,8,'linen');
  }
  const hub=[sx-13,chairFloor-23,14];
  bar('Chair gas lift',[sx-13,sy+29,14],hub,6.5,'brass');
  ell('Chair base hub',...hub,9,7,9,'dark');
  for(let i=0;i<5;i++){
    const a=i*2*Math.PI/5+.4;
    const x=hub[0]+54*Math.cos(a), z=hub[2]+50*Math.sin(a);
    const wheelFloor = portrait ? 1289 + (z-1)*.12 : floorY + z*.13;
    const y=wheelFloor-12;
    bar('Chair caster spoke',hub,[x,y-2,z],3.4,'brass',2.8,8);
    bar('Chair caster fork',[x,y-4,z],[x,y+3,z],3,'dark');
    ell('Chair caster wheel',x,y+5,z,7,7,5,'dark');
  }

  bar('Lamp foot',at(132,786,64),at(132,781,64),20,'brass',20,28);
  const armA=at(132,775,64), armB=at(106,690,62), armC=at(157,652,55);
  bar('Lamp lower arm',armA,armB,3.3,'brass');
  bar('Lamp upper arm',armB,armC,3.3,'brass');
  for (const joint of [armA,armB,armC]) ell('Lamp hinge',...joint,6,6,6,'brass');
  bar('Lamp metal shade',at(180,677,53),at(166,648,53),24,'brass',7,24);
  ell('Lamp diffuser',...at(180,676,54),20,6,18,'page').rotation.z=.4;
  bar('Terracotta coffee mug',at(181,796,67),at(181,767,67),11,'terracotta',13,24);
  ell('Coffee surface',...at(181,767,67),10.5,2,10.5,'dark');
  const handle=mesh('Coffee mug handle',new THREE.TorusGeometry(7,2.2,8,16),'terracotta');
  handle.position.copy(p(...at(196,780,67)));

  const vineX=portrait?150:139, vineY=portrait?771:431;
  for (let branch=0;branch<5;branch++) {
    let a=[vineX+(branch-2)*13,vineY,57+branch*3];
    for (let i=1;i<=6-branch%3;i++){
      const b=[a[0]+Math.sin(i*.7+branch)*13-3,a[1]+18+branch,a[2]+2];
      bar('Trailing pothos stem',a,b,1.1,'bark');
      const leaf=ell('Pothos leaf',b[0]+(i%2?10:-10),b[1]+8,b[2],12,21,4,i%3?'leaf':'leafLight');
      leaf.rotation.z=i%2?.54:-.56;
      a=b;
    }
  }
  for (let i=0;i<3;i++) {
    ell('Shelf plant leaf',cx+60+i*9,shelfY-40+i%2*6,-34,7,13,6,i%2?'leaf':'leafLight');
  }
  bar('Shelf plant pot',[cx+67,shelfY-5,-33],[cx+67,shelfY-28,-33],10,'cream',13,18);

  const pot = portrait ? [861,1407] : [1449,894];
  const [px,py] = pot;
  const potZ = portrait ? 12 : 60;
  bar('Terracotta plant pot',[px,py,potZ],[px,py-75,potZ],31,'terracotta',42,24);
  bar('Terracotta pot rim',[px,py-69,potZ],[px,py-81,potZ],43,'terracotta',44,24);
  ell('Potting soil',px,py-80,potZ,38,4,38,'bark');
  for (const [off, high] of [[-74,149],[-42,176],[-9,182],[42,220],[68,187]]) {
    const a=[px,py-79,potZ],b=[px+off*.34,py-115,potZ],c=[px+off,py-high,potZ];
    bar('Plant stem',a,b,2.9,'bark',2.2);
    bar('Plant branch',b,c,2.2,'bark',.8);
    for (let i=0;i<3;i++){
      const t=.44+i*.27, side=(i%2?1:-1);
      const leaf=ell('Potted olive leaf',mix(b[0],c[0],t)+12*side,mix(b[1],c[1],t)-11,
        potZ+2+i,8,23,3.3,i%2?'leafLight':'leaf');
      leaf.rotation.z=side*.62+off*.004;
    }
  }

  const [nbx,nby,nw] = portrait ? [487,1432,336] : [1102,853,276];
  const pageZ = portrait ? 55 : -68;
  const pagePitch = portrait ? .72 : .69;
  for (const side of [-1,1]) {
    const section = (layer) => Array.from({length:15}, (_,i)=>{
      const t=i/14;
      return [nbx+side*nw*t,nby-12*Math.sin(Math.PI*t)-layer,pageZ];
    }).sort((a,b)=>a[0]-b[0]);
    along('Notebook cloth cover',section(0),254,11,'olive',pagePitch);
    for (let i=0;i<5;i++) along('Notebook signature',section(4+i*3),252-i*4,3.4,i%2?'cream':'page',pagePitch);
    along('Notebook writing surface',section(20),231,3,'page',pagePitch);
  }
  // Drafting marks follow the left page surface in three dimensions.
  const inkPoint = (u,v) => {
    const x = nbx - nw*u, z=pageZ+v*100;
    return [x,nby-20-12*Math.sin(Math.PI*u)+pagePitch*(z-pageZ)-.6,z];
  };
  for(const [a,b] of [[[.23,-.36],[.67,-.36]],[[.67,-.36],[.71,-.19]],
    [[.71,-.19],[.26,-.16]],[[.26,-.16],[.23,-.36]],[[.31,-.17],[.29,.24]],
    [[.35,-.17],[.34,.24]],[[.59,-.18],[.77,.22]],[[.63,-.18],[.8,.22]],
    [[.21,.24],[.84,.24]],[[.18,-.56],[.85,-.56]]]) {
    bar('Notebook drafting line',inkPoint(...a),inkPoint(...b),.55,'ink',.55,6);
  }
  const paperRoll = portrait
    ? [[471,1161,21],[496,1159,22],[519,1171,24],[544,1197,27],[567,1240,30],[591,1264,30]]
    : [[456,779,35],[482,790,37],[511,834,37],[543,880,39],[575,905,41],
       [618,908,42],[656,894,42],[700,857,42],[738,839,42],[773,848,42],[823,895,42]];
  along('Curled drafting sheet',paperRoll,68,2,'page',.29);
  const [tx,ty] = portrait ? [690,1328] : [1249,757];
  const stoolTopDepth=22;
  const pageRest = (x,y) => pageZ + (y-nby+20+12*Math.sin(Math.PI*Math.abs(x-nbx)/nw))/pagePitch;
  bar('Stool edge',[tx,ty+12,stoolTopDepth],[tx,ty-3,stoolTopDepth],54,'maple',55,32)
    .scale.z=.64;
  ell('Stool top',tx,ty-3,stoolTopDepth,55,8,36,'lightWood');
  for (const [x,y,z,ox,oy,c] of [[-34,7,23,-54,121,'maple'],
    [33,7,22,62,111,'maple'],[4,6,-25,24,87,'maple']]) {
    bar('Splayed stool leg',[tx+x,ty+y,stoolTopDepth+z],
      [tx+ox,ty+oy,pageRest(tx+ox,ty+oy)],11,c,8,12);
  }

  const [caseX,caseY] = portrait ? [268,810] : [624,619];
  rounded('Olive toolbox',caseX-43,caseY-20,86,44,-2,48,'olive',5);
  rounded('Toolbox lid',caseX-45,caseY-23,90,12,1,49,'linen',3);
  box('Toolbox latch',caseX+8,caseY-1,1.8,8,14,3,'brass');
  bar('Toolbox handle riser',[caseX-16,caseY-24,-12],[caseX-13,caseY-34,-12],3,'brass');
  bar('Toolbox handle grip',[caseX-13,caseY-34,-12],[caseX+12,caseY-34,-12],3,'dark');
  bar('Toolbox handle riser',[caseX+12,caseY-34,-12],[caseX+16,caseY-24,-12],3,'brass');

  // Match the scheduler's screen-space route without requiring changes to city.mjs.
  // Structural treads use node height as the point of sole contact at z=16.
  const routes = {};
  const deckDepth = 56;
  for (const [from,to] of edges(layout)) {
    const a=nodes[from][layout],b=nodes[to][layout];
    routes[from+'-'+to] = { from:p(...a,16).toArray(), to:p(...b,16).toArray(),
      minZ:16-deckDepth/2,maxZ:16+deckDepth/2, kind:from==='ladder0'?'ladder':'walk' };
    if (from==='ladder0') continue;
    const lowGround=['desk','floor','notebook','stool'];
    // The peach stage handles ground contact; each higher segment has an actual surface.
    if(lowGround.includes(from)&&lowGround.includes(to)) continue;
    if (['cross-mid','mid-east','cross-westDock','east-eastDock'].includes(from+'-'+to)) continue;
    const onLedge=['east-pass','pass-ledge','ledge-ladder0'].includes(from+'-'+to);
    if (onLedge) {
      const [left,right]=a[0]<b[0] ? [a,b] : [b,a];
      along('Ivory landing walk '+from+' to '+to,[[...left,6],[...right,6]],99,24,'cream',.16);
      continue;
    }
    const [left,right]=a[0]<b[0] ? [a,b] : [b,a];
    const onSteps=['toe','s1','s2','s3'].includes(from) || ['toe','s1','s2','s3'].includes(to);
    const points=[];
    if(onSteps) {
      for(let i=0;i<4;i++) {
        const x=mix(left[0],right[0],i/4),next=mix(left[0],right[0],(i+1)/4);
        const y=mix(left[1],right[1],i/4);
        points.push([x,y,16],[next,y,16]);
      }
      points.push([right[0],right[1],16]);
    } else {
      points.push([...left,16],[...right,16]);
    }
    along('Route tread '+from+' to '+to,points,deckDepth,onSteps?17:9,onSteps?'linen':'maple');
  }

  set.userData.contacts = {
    layout, dimensions:[w,h], routes, rungContacts,
    stations:Object.fromEntries(Object.entries(nodes).map(([key, coordinates])=>
      [key,p(...coordinates[layout],16).toArray()])),
    seat:p(sx,sy+9,14).toArray(),
    seatedPelvis:p(sx,sy,portrait?18:17).toArray(),
    keyboard:(portrait?[[335,1145],[365,1148]]:[[317,767],[347,771]])
      .map(([x,y],i)=>p(x,y,28+i*3).toArray()),
    stool:p(portrait?644:1201,portrait?1328:764,29).toArray(),
    bridgeDepth:[16-103/2,16+103/2],
    chairArmrestDepth:[-17,45],
    notebookSurface:{centerX:nbx,halfWidth:nw,centerY:h-nby+20,centerZ:pageZ,pitch:pagePitch},
    stoolLegDepths:[[-54,121],[62,111],[24,87]].map(([x,y])=>pageRest(tx+x,ty+y)),
  };
  bridge.userData.walkable = true;
  return set;
}
