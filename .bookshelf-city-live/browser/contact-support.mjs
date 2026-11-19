import { BufferGeometry, Float32BufferAttribute, Vector3 } from './vendor/package/build/three.module.js';
import { routeDepths } from './terrain-depth.mjs';
import { createContactDepth } from './contact-depth.mjs';

// The locked camera sees both layouts at their original pixel registration.
// The foreground book must be in front of the study platform in the portrait
// room. All of its attached hardware and the floor share that physical depth.
export function registerSetDepth(set, layout) {
  if (set.userData.depthRegistered) return;
  set.userData.depthRegistered = true;
  const info = set.userData.contacts;
  {
    const offset = layout ? 220 : 110;
    for (const part of set.children) {
      if (/^Notebook (cloth cover|signature|writing surface|drafting line)$|^Stool |^Splayed stool leg$/.test(part.name)) part.position.z += offset;
    }
    info.stool[2] += offset;
    info.notebookSurface.centerZ += offset;
    info.stoolLegDepths = info.stoolLegDepths.map(z => z + offset);
  }
  if (layout === 1) {
    const ground = set.getObjectByName('Peach cyclorama floor');
    // The studio floor meets the platform's lip, then the notebook's rear edge.
    // It descends beneath the book's binding toward its foreground cover.
    const bands = [[-1200,1200],[-270,1276],[-140,1290],[80,1299],
      [160,1325],[250,1413],[396,1520],[550,1580],[1700,1830]];
    // Seat the whole flat base of the terracotta pot on the small level
    // apron at the right. Its center corresponds to the original art mark.
    const potZ=160+(1407-1325)*90/(1413-1325);
    for (const part of set.children) {
      if (/^Terracotta (plant pot|pot rim)$|^Potting soil$|^Plant (stem|branch)$|^Potted olive leaf$/.test(part.name))
        part.position.z+=potZ-12;
    }
    const xs=[-1800,788,825,897,934,2748];
    const zs=[...new Set([...bands.map(([z])=>z),potZ-68,potZ-34,potZ+34,potZ+68])].sort((a,b)=>a-b);
    const coords=[], indices=[];
    for(let iz=0;iz<zs.length;iz++) {
      const z=zs[iz], i=Math.max(1,bands.findIndex(([at])=>at>=z));
      const [z0,y0]=bands[i-1],[z1,y1]=bands[i];
      const y=y0+(y1-y0)*(z-z0)/(z1-z0);
      const wz=Math.max(0,Math.min(1,(68-Math.abs(z-potZ))/34));
      for(let ix=0;ix<xs.length;ix++){
        const x=xs[ix],wx=Math.max(0,Math.min(1,(73-Math.abs(x-861))/37));
        coords.push(x,1659-y+(y-1407)*wx*wz,z);
        if(ix===xs.length-1 || iz===zs.length-1) continue;
        const k=iz*xs.length+ix;
        indices.push(k,k+xs.length,k+1,k+1,k+xs.length,k+xs.length+1);
      }
    }
    const geometry=new BufferGeometry();
    geometry.setAttribute('position',new Float32BufferAttribute(coords,3));
    geometry.setIndex(indices);geometry.computeVertexNormals();
    ground.geometry=geometry;
  }

  // Put the bound volume under the block station and the top of the ladder.
  // Both NPCs can now use its cloth cover directly, including during an orbit.
  const upperX=layout?530:1026, upperY=layout?693:546;
  const artHeight=layout?1659:1024;
  const upper=set.children.find(ob=>ob.name==='Cloth book cover' &&
    Math.abs(ob.position.x-upperX)<10 && Math.abs(artHeight-ob.position.y-upperY)<10);
  if (upper) {
    const entries=set.children;
    const index=entries.indexOf(upper);
    // The rear page block and its page-edge lines are one bound book.
    for (let i=index; i<entries.length; i++) {
      if (i>index && !['Book page block','Paper leaf edge'].includes(entries[i].name)) break;
      entries[i].position.z+=84;
    }
    upper.userData.walkable='upper';
    for(const name of ['Route tread ladder1 to upper','Route tread upper to blocks']) {
      const tread=set.getObjectByName(name);
      if(tread) set.remove(tread);
    }
  }
  // Rest the inclined ladder against the visible book's FRONT cover. Its
  // top stile touches the book. Its feet and the approaching actor are farther
  // forward, on the solid ivory landing below it.
  const ladderShift=74;
  for(const part of set.children) {
    if(/^Maple ladder (stile|rung)$/.test(part.name)) part.position.z+=ladderShift;
  }
  for(const rung of info.rungContacts) rung[2]+=ladderShift;
  const ledgeShift=layout?98:56;
  for(const [name,west,east,fromShift,toShift] of [
    ['Ivory landing walk pass to ledge',layout?646:1057,layout?741:1212,0,ledgeShift],
    ['Ivory landing walk ledge to ladder0',layout?741:1212,layout?850:1414,ledgeShift,107],
  ]) {
    const landing=set.getObjectByName(name);
    if(!landing) continue;
    const v=landing.geometry.getAttribute('position');
    for(let i=0;i<v.count;i++){
      const t=(v.getX(i)-west)/(east-west);
      v.setZ(i,v.getZ(i)+fromShift+(toShift-fromShift)*t);
    }
    v.needsUpdate=true;
    landing.geometry.computeVertexNormals();
    landing.geometry.computeBoundingBox();
    landing.geometry.computeBoundingSphere();
  }
  const podium=set.getObjectByName('Ivory lower podium');
  if(podium) {
    // A narrow bullnose returns to the existing plinth below the ladder,
    // leaving the potted tree and the foreground notebook in front of it.
    const endX=layout?853:1422, floorArt=layout?875:697;
    const mesh=podium.clone();
    mesh.name='Ivory ladder footing';
    mesh.position.set(0,0,0);
    mesh.scale.set(1,1,1);
    const h=layout?1659:1024, zContact=104, section=[];
    for(const [z,width,thickness] of [[-72,34,27],[98,26,20],[122,25,15]]) {
      const top=h-floorArt-(z-zContact)*.105;
      section.push(endX-width,top,z,endX+width,top,z,
        endX+width,top-thickness,z,endX-width,top-thickness,z);
    }
    const g=new BufferGeometry();
    g.setAttribute('position',new Float32BufferAttribute(section,3));
    const triangles=[0,2,1,0,3,2,8,9,10,8,10,11];
    for(let j=0;j<2;j++) for(let i=0;i<4;i++) {
      const a=4*j+i,b=4*j+(i+1)%4;
      triangles.push(a,a+4,b,b,a+4,b+4);
    }
    g.setIndex(triangles);
    g.computeVertexNormals();
    mesh.geometry=g;
    set.add(mesh);
  }
  // The drafting sheet is the visible route over the desktop floor. The
  // portrait set has open studio floor in this position. A second series
  // of green steps under the paper previously floated above the floor.
  const approach=set.getObjectByName('Route tread floor to toe');
  if(approach) set.remove(approach);
  // The toy roof and real piers use the original solid's front lane. The
  // actual top elevation is supplied by the final toy-arch model when present.
  const roofTop=layout?604:454;
  info.roofHome ??= [layout?636:1177.8,artHeight-roofTop+2.3,26];
  set.updateWorldMatrix(true,true);
}

export function bindSetContacts(set, layout) {
  registerSetDepth(set,layout);
  const info=set.userData.contacts;
  const surfaces=[], obstacles=[];
  set.traverse(mesh=>{
    if(!mesh.isMesh) return;
    let role;
    const name=mesh.name;
    if(name==='Peach cyclorama floor' || name==='Study floor platform') role='ground';
    if(name==='Notebook writing surface') role='notebook';
    if(name==='Maple ladder rung') role='ladder';
    if(!layout && name==='Curled drafting sheet') role='stairs';
    if(name==='Closed arched bridge deck') role='bridge';
    if(mesh.userData.walkable==='upper') role='upper';
    if(name==='Ivory ladder footing' || name.startsWith('Ivory landing walk') || name==='Route tread cross to overlook') role='landing';
    if(name.startsWith('Route tread') && /toe|s[123]/.test(name)) role='stairs';
    if(name==='Route tread ladder1 to upper' || name==='Route tread upper to blocks') role='upper';
    if(role) surfaces.push({mesh,role});
    if (/^Bridge (?:rear baluster|rear handrail)|^Chair back cushion|^Splayed stool leg|^Stool top|^Olive toolbox|^Maple ladder stile/.test(name)) obstacles.push(mesh);
  });
  const depths=routeDepths(layout);
  const vector=a=>new Vector3().fromArray(a);
  const anchors={seat:vector(info.seatedPelvis),keyboard0:vector(info.keyboard[0]),
    keyboard1:vector(info.keyboard[1]),stool:vector(info.stool),roof:vector(info.roofHome)};
  return createContactDepth(set,layout,{surfaces,obstacles,depths,anchors,
    rungContacts:info.rungContacts.map(vector),depthWeight:.60,maxHeightError:42});
}
