import {Matrix4, Mesh} from '../vendor/package/build/three.module.js';
import {mergeGeometries} from '../addons/utils/BufferGeometryUtils.js';

// Keep the named source solids for grounding and station lookup. Submit their
// immutable triangles in material batches; the freely moving props and actors
// are separate scene objects. World transforms and normals are baked only once.
export function batchScenery(set) {
  set.updateMatrixWorld(true);
  const local = new Matrix4().copy(set.matrixWorld).invert();
  const groups = new Map();
  set.traverseVisible(mesh => {
    if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || mesh.children.length ||
        Array.isArray(mesh.material) || mesh.material.transparent || mesh.geometry.morphAttributes.position) return;
    const g=mesh.geometry;
    if (!g.getAttribute('position') || !g.getAttribute('normal')) return;
    const attrs=Object.entries(g.attributes).map(([key,a])=>key+':'+a.itemSize+':'+a.normalized).sort();
    const key=[mesh.material.uuid,mesh.castShadow,mesh.receiveShadow,mesh.renderOrder,...attrs].join('/');
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(mesh);
  });
  for (const sources of groups.values()) {
    if (sources.length < 3) continue;
    const geometries = sources.map(mesh => {
      const g=mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      g.applyMatrix4(new Matrix4().multiplyMatrices(local,mesh.matrixWorld));
      return g;
    });
    const geo=mergeGeometries(geometries);
    for (const g of geometries) g.dispose();
    if (!geo) continue;
    geo.computeBoundingSphere();
    const first=sources[0], batch=new Mesh(geo,first.material);
    batch.name='Static '+(first.material.name || first.name);
    batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;
    batch.renderOrder=first.renderOrder;
    for(const source of sources)source.visible=false;
    set.add(batch);
  }
}
