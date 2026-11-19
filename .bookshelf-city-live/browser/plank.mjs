import {BufferGeometry, Float32BufferAttribute, Vector3, Mesh, MeshStandardMaterial, Color, LinearSRGBColorSpace} from './vendor/package/build/three.module.js';

// The source shot bevels a unit cube before the object's nonuniform scale.
// Blender's Z-up height becomes Three's Y-up height.
const radius = .018;
const segments = 3;
const inset = .5 - radius;
const axes = [new Vector3(1,0,0), new Vector3(0,1,0), new Vector3(0,0,1)];
const signs = [-1, 1];
export const legUnit = 108 / 1.4;
export const plankDimensions = new Vector3(1.4, .075, .16).multiplyScalar(legUnit);
export const palmOffsets = signs.map(sign => new Vector3(sign * .28, -.03, -.06).multiplyScalar(legUnit));

function plankGeometry() {
  const positions = [], normals = [];
  function vertex(centre, normal) {
    return { point: centre.clone().addScaledVector(normal, radius), normal };
  }
  function triangle(a, b, c) {
    const orientation = b.point.clone().sub(a.point).cross(c.point.clone().sub(a.point));
    if (orientation.dot(a.normal.clone().add(b.normal).add(c.normal)) < 0) [b, c] = [c, b];
    for (const v of [a, b, c]) {
      positions.push(v.point.x, v.point.y, v.point.z);
      normals.push(v.normal.x, v.normal.y, v.normal.z);
    }
  }
  function quad(a, b, c, d) { triangle(a,b,c); triangle(a,c,d); }

  for (let i = 0; i < 3; i++) {
    const axis = axes[i], u = axes[(i + 1) % 3], v = axes[(i + 2) % 3];
    for (const side of signs) {
      const normal = axis.clone().multiplyScalar(side);
      const centre = normal.clone().multiplyScalar(inset);
      const face = (x, y) => vertex(centre.clone().addScaledVector(u,x*inset).addScaledVector(v,y*inset),normal);
      quad(face(-1,-1), face(1,-1), face(1,1), face(-1,1));
    }
    for (const su of signs) for (const sv of signs) {
      const centre = u.clone().multiplyScalar(su*inset).addScaledVector(v,sv*inset);
      const edge = (step, end) => {
        const angle = step * Math.PI / (2 * segments);
        const normal = u.clone().multiplyScalar(su*Math.cos(angle)).addScaledVector(v,sv*Math.sin(angle));
        return vertex(centre.clone().addScaledVector(axis,end*inset),normal);
      };
      for (let j=0; j<segments; j++) quad(edge(j,-1),edge(j,1),edge(j+1,1),edge(j+1,-1));
    }
  }
  for (const x of signs) for (const y of signs) for (const z of signs) {
    const centre = new Vector3(x*inset, y*inset, z*inset);
    const corner = (i, j) => {
      const k = segments - i - j, angle = Math.PI / (2 * segments);
      return vertex(centre, new Vector3(x*Math.sin(i*angle), y*Math.sin(j*angle), z*Math.sin(k*angle)).normalize());
    };
    for (let i=0; i<segments; i++) for (let j=0; i+j<segments; j++) {
      triangle(corner(i,j), corner(i+1,j), corner(i,j+1));
      if (i+j+1<segments) triangle(corner(i+1,j),corner(i+1,j+1),corner(i,j+1));
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));
  return geometry;
}

export function createMaplePlank() {
  const wood = new MeshStandardMaterial({color: new Color().setRGB(.49,.265,.113,LinearSRGBColorSpace), roughness:.62});
  const mesh = new Mesh(plankGeometry(), wood);
  mesh.name = 'CARRY • two-hand maple plank';
  mesh.scale.copy(plankDimensions);
  return mesh;
}
