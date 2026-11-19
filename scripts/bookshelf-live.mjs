import { createHash } from 'node:crypto';
import { cp, readFile, writeFile } from 'node:fs/promises';

export async function loadActor() {
  let { BOOKSHELF_AIDAN_GLB: path, BOOKSHELF_AIDAN_SHA256: approvedDigest } = process.env;
  if (path === undefined && approvedDigest === undefined) {
    path = '.bookshelf-city-live/actor/aidan.glb';
    approvedDigest = await readFile('.bookshelf-city-live/actor/aidan.sha256', 'ascii')
      .then(value => value.trim())
      .catch(error => {
        if (error.code !== 'ENOENT') throw error;
        throw new Error('Stage the approved Aidan GLB and its export receipt with install.py.');
      });
  }
  if (!path || !/^[a-f0-9]{64}$/.test(approvedDigest ?? '')) {
    throw new Error('Set BOOKSHELF_AIDAN_GLB and the approved BOOKSHELF_AIDAN_SHA256.');
  }

  const actor = await readFile(path);
  const digest = createHash('sha256').update(actor).digest('hex');
  if (digest !== approvedDigest) throw new Error('Aidan GLB digest differs from the approved export.');

  if (actor.length < 28 || actor.toString('ascii', 0, 4) !== 'glTF' ||
      actor.readUInt32LE(4) !== 2 || actor.readUInt32LE(8) !== actor.length ||
      actor.toString('ascii', 16, 20) !== 'JSON') {
    throw new Error('Expected a complete GLB 2.0 actor.');
  }
  const jsonEnd = 20 + actor.readUInt32LE(12);
  if (jsonEnd + 8 > actor.length || actor.toString('hex', jsonEnd + 4, jsonEnd + 8) !== '42494e00' ||
      jsonEnd + 8 + actor.readUInt32LE(jsonEnd) !== actor.length) {
    throw new Error('Expected the actor’s embedded binary chunk.');
  }
  const model = JSON.parse(actor.toString('utf8', 20, jsonEnd));
  const nodes = model.nodes ?? [];
  const names = new Set(nodes.map(node => node.name));
  const surfaces = nodes.filter(node => node.mesh !== undefined);
  const parents = new Map();
  for (const node of nodes) {
    for (const child of node.children ?? []) parents.set(nodes[child], node);
  }
  function surfaceNames(node) {
    const names = [model.meshes?.[node.mesh]?.name, node.name];
    const visited = new Set([node]);
    // gltfpack may keep the named part on a parent of the quantized mesh.
    while (!node.name) {
      node = parents.get(node);
      if (!node || visited.has(node)) break;
      visited.add(node);
      names.push(node.name);
    }
    return names;
  }
  const skinned = new Set(surfaces.filter(node => node.skin !== undefined).flatMap(surfaceNames));
  const limbs = ['Left', 'Right'].map(side => 'Selected source connected arm and hand ' + side);
  const hasJeans = [...skinned].some(name => name?.startsWith('BOOKWALK_') &&
    name.includes('ContinuousTailoredMesh'));
  const contacts = ['contact_crown', 'contact_palm_L', 'contact_palm_R', 'contact_sole_L', 'contact_sole_R'];
  const meshopt = 'EXT_meshopt_compression';
  const buffers = model.buffers ?? [];
  const views = model.bufferViews ?? [];
  const usesMeshopt = model.extensionsUsed?.includes(meshopt);
  const binaryLength = actor.readUInt32LE(jsonEnd);
  const padding = binaryLength - buffers[0]?.byteLength;
  const embedded = Number.isInteger(padding) && padding >= 0 && padding <= 3 &&
    buffers.every(buffer => buffer.uri === undefined) &&
    (buffers.length === 1 || (buffers.length === 2 && usesMeshopt &&
      buffers[1].extensions?.[meshopt]?.fallback === true &&
      views.some(view => view.buffer === 1)));
  const supportedViews = views.every(view => {
    const compressed = view.extensions?.[meshopt];
    if (!compressed) return view.buffer === 0;
    return usesMeshopt && compressed.buffer === 0 &&
      (view.buffer === 0 || view.buffer === 1 && buffers.length === 2) &&
      ['ATTRIBUTES', 'TRIANGLES', 'INDICES'].includes(compressed.mode) &&
      [undefined, 'NONE', 'OCTAHEDRAL', 'QUATERNION', 'EXPONENTIAL', 'COLOR'].includes(compressed.filter) &&
      Number.isSafeInteger(compressed.count * compressed.byteStride) &&
      compressed.count * compressed.byteStride === view.byteLength &&
      compressed.byteLength > 0 && (compressed.byteOffset ?? 0) >= 0 &&
      (compressed.byteOffset ?? 0) + compressed.byteLength <= buffers[0].byteLength;
  });
  if (!model.skins?.length || !hasJeans || !limbs.every(limb => skinned.has(limb)) ||
      !surfaces.some(node => surfaceNames(node).includes('Aidan retopologized head and connected neck')) ||
      !contacts.every(contact => names.has(contact)) || !embedded || !supportedViews ||
      model.images?.some(image => !views[image.bufferView] || image.uri !== undefined)) {
    throw new Error('Expected the skinned Aidan actor with its native contact markers and embedded resources.');
  }
  return actor;
}

export async function packageLiveCity(actor) {
  await cp('.bookshelf-city-live/browser', 'dist/bookshelf-live', { recursive: true });
  await writeFile('dist/bookshelf-live/art/aidan.glb', actor);
  await cp('.bookshelf-city-live/index.html', 'dist/index.html');
}
