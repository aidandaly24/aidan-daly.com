import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { wrap, dragFrame, degrees } from '../public/spin.js';
test('rotation wraps cleanly at both ends', () => {
  assert.equal(wrap(-1, 72), 71); assert.equal(wrap(72, 72), 0); assert.equal(wrap(145, 72), 1);
});
test('drag rotation works in either direction at phone widths', () => {
  assert.ok(dragFrame(0, 80, 350, 72) > 0); assert.ok(dragFrame(0, -80, 350, 72) > 0);
  assert.ok(Number.isFinite(dragFrame(0, 20, 0, 72))); assert.equal(degrees(36, 72), 180);
});
test('requested copy and accessible controls exist', async () => {
  const html = await readFile('public/index.html','utf8');
  assert.match(html, /Hi, I’m/); assert.match(html, /Aidan Daly/); assert.match(html, /Coming soon/);
  assert.match(html, /role="slider"/); assert.match(html, /aria-describedby="spin-help"/);
  assert.match(html, /Pause automatic rotation/); assert.match(html, /<noscript>/);
});
test('all published rotation frames and poster exist', async () => {
  await access('public/assets/portrait.webp');
  const manifest = JSON.parse(await readFile('public/assets/turntable/manifest.json','utf8'));
  assert.ok(manifest.frames >= 36); assert.ok(manifest.width > 0); assert.ok(manifest.height > 0);
  for (let i=0;i<manifest.frames;i++) await access(`public/assets/turntable/frame-${String(i).padStart(3,'0')}.webp`);
});
test('static security and Vercel configuration', async () => {
  const config = JSON.parse(await readFile('vercel.json','utf8'));
  assert.equal(config.outputDirectory, 'dist'); assert.equal(config.framework, null);
  assert.ok(config.headers.some(rule => rule.headers.some(h => h.key === 'Content-Security-Policy')));
});
