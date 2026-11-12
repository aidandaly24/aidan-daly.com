import { cp, mkdir, rm } from 'node:fs/promises';
await import('./validate-media.mjs');
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
console.log('Built static site in dist/');
