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
  assert.match(html, /Recenter figure/); assert.match(html, /Add glasses/); assert.match(html, /<noscript>/);
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

test('portrait uses every animation frame and bounded-memory media',async()=>{
 const js=await readFile('public/app.js','utf8');
 assert.doesNotMatch(js,/lastDraw|t-lastDraw/);
 assert.match(js,/portrait.draw\(ctx,motion.angle/);
 assert.match(js,/motion.step\(dt\);draw\(\)/);
});

test('layout reserves viewport space for every element and removes the requested header label',async()=>{
 const html=await readFile('public/index.html','utf8'),css=await readFile('public/style.css','utf8');
 assert.doesNotMatch(html,/<span class="address">/);
 assert.match(html,/class="figure-viewport"/);assert.match(css,/height:100dvh/);assert.match(css,/100cqh \* 1\.40625/);
});

 test('pointer dragging does not outline the portrait viewport',async()=>{
 const css=await readFile('public/style.css','utf8');
 assert.doesNotMatch(css,/\.figure-viewport:focus-within/);
 assert.match(css,/:has\(\.figure-stage:focus-visible\)\+\.figure-controls #hint-text/);
 });

test('default portrait is no-glasses and toggles do not reset momentum',async()=>{
 const js=await readFile('public/app.js','utf8'),html=await readFile('public/index.html','utf8');
 assert.match(js,/variant='no-glasses'/);assert.match(html,/portrait-v2\/no-glasses\/poster.webp/);
 const switching=js.slice(js.indexOf('async function changeVariant'),js.indexOf('async function loadFrames'));
 assert.doesNotMatch(switching,/motion.reset|motion.angle\s*=/);
 assert.match(js,/token!==switchId/);assert.match(js,/loaded.dispose/);
});

test('preview metadata is crawler-readable and references public absolute assets',async()=>{
 const html=await readFile('public/index.html','utf8');
 for(const tag of ['og:image','og:image:width','og:image:height','twitter:card'])assert.ok(html.includes(tag));
 assert.match(html,/https:\/\/aidan-daly.com\/assets\/aidan-daly-preview-v2.jpg/);
 assert.match(html,/content="1200"/);assert.match(html,/content="630"/);
 assert.match(html,/apple-touch-icon/);
 await access('public/assets/aidan-daly-preview-v2.jpg');await access('public/assets/apple-touch-icon.png');
});
