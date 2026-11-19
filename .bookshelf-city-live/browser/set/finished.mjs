import {createBookshelfSet} from './index.mjs';
import {finishBooks} from './book-finish.mjs';
import {finishArchitecture} from './architecture.mjs';
import {finishPlants} from './plant-finish.mjs';
import {finishNook} from './nook-finish.mjs';
import {registerSetDepth} from '../contact-support.mjs';
import {finishMaterial} from '../surface-finish.mjs';

const finishes = {
  maple:'timber', lightWood:'timber', endgrain:'timber',
  olive:'weave', linen:'weave', ink:'weave', page:'paper',
  cream:'vellum', leaf:'moss', leafLight:'moss',
};

export function buildDiorama(layout, redraw) {
  const set = createBookshelfSet(layout);
  registerSetDepth(set,layout);
  finishBooks(set,layout,redraw);
  finishArchitecture(set,layout);
  finishPlants(set,layout);
  finishNook(set,layout,redraw);
  set.getObjectByName('Peach cyclorama floor').material.color.set(0xe8d6cd);
  set.traverse(part => {
    if (!part.isMesh) return;
    const materials = Array.isArray(part.material) ? part.material : [part.material];
    for (const mat of materials) finishMaterial(mat, mat.userData.setSurface || finishes[mat.name]);
  });
  set.updateMatrixWorld(true);
  return set;
}
