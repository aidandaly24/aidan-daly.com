import { loadActor, packageLiveCity } from './bookshelf-live.mjs';
import { cp, mkdir, rm } from 'node:fs/promises';
await import('./validate-media.mjs');
const actor = await loadActor();
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
await packageLiveCity(actor);
console.log('Built static site in dist/');
