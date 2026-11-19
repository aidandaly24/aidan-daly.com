import {
  BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial,
  SRGBColorSpace, TextureLoader, Vector3,
} from './vendor/package/build/three.module.js';

// Left and right lower corners, projected apex, then the depth of the right face.
// The two illustrations were composed independently at 1536×1024 and 948×1659.
const registration = [
  [[1143.2,453.8],[1212.4,451.8],[1178.5,410.9],[12.8,.7]],
  [[601.4,604.5],[670.4,602],[636.9,562.2],[12.2,.4]],
];

export function createArchRoof(layout, height, redraw) {
  const [leftPx,rightPx,topPx,depthPx] = registration[layout];
  const x = (leftPx[0]+rightPx[0])/2, y = (leftPx[1]+rightPx[1])/2;
  const home = new Vector3(x,height-y,26);
  const front = p => new Vector3(p[0]-x,y-p[1],6);
  const left = front(leftPx), right = front(rightPx), top = front(topPx);
  const depth = new Vector3(depthPx[0],-depthPx[1],-20);
  const back = p => p.clone().add(depth);
  const [farLeft,farRight,farTop] = [left,right,top].map(back);
  const positions = [], uvs = [];
  const uv = (x,y) => [(x+.5)/96,(y+.5)/48];
  function triangle(points, texture) {
    for (let i=0; i<3; i++) {
      positions.push(...points[i].toArray());
      uvs.push(...texture[i]);
    }
  }
  function quad(a,b,c,d,texture) {
    triangle([a,b,c],[texture[0],texture[1],texture[2]]);
    triangle([a,c,d],[texture[0],texture[2],texture[3]]);
  }

  const face = [uv(1,1),uv(69,1),uv(35,45)];
  const slope = [uv(72,1),uv(89,1),uv(89,45),uv(72,45)];
  triangle([left,right,top],face);
  triangle([farRight,farLeft,farTop],face);
  quad(right,farRight,farTop,top,slope);
  quad(farLeft,left,top,farTop,slope);

  // The thin dark lower edge is visible even while the block is held aloft.
  const rim = [uv(93,1),uv(93,46),uv(94,46),uv(94,1)];
  const edge = [left,right,farRight,farLeft];
  const lower = edge.map(p => p.clone().add(new Vector3(.35,-2.1,0)));
  for (let i=0; i<4; i++) {
    const j=(i+1)%4;
    quad(edge[i],edge[j],lower[j],lower[i],rim);
  }
  quad(...lower,rim);

  const geometry = new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));
  geometry.computeVertexNormals();
  const material = new MeshBasicMaterial({color:0xa38c59,side:DoubleSide});
  const mesh = new Mesh(geometry,material);
  mesh.name = 'Movable roof of the illustrated block arch';
  mesh.position.copy(home);
  if (typeof document !== 'undefined') {
    const url = new URL('./props/arch-roof-'+(layout?'portrait':'desktop')+'.png',import.meta.url);
    new TextureLoader().load(url.href,texture => {
      texture.colorSpace = SRGBColorSpace;
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate=true;
      redraw?.();
    });
  }
  // One palm near the crest and one on the lower slope. Place the nearer
  // hand toward the visible edge so its wrist reaches in front of the body.
  const grips = [top.clone().lerp(right,.18).addScaledVector(depth,.32),
    top.clone().lerp(right,.76).addScaledVector(depth,.16)];
  return {mesh,home,grips};
}
