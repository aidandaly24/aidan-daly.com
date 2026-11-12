// Reproduce the site's own canvas composition from licensed rendered media.
// No browser capture or private photos are used.
import {createRequire} from 'node:module';
const {createCanvas,loadImage,GlobalFonts}=createRequire(import.meta.url)('@napi-rs/canvas');
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createOrbitRenderer} from '../public/orbit.js';
const root=new URL('../',import.meta.url);
GlobalFonts.registerFromPath(new URL('public/assets/fonts/dm-sans.ttf',root).pathname,'DM');
const [portrait,logo,data]=await Promise.all([
 loadImage(new URL('public/assets/portrait-v2/no-glasses/poster.webp',root).pathname),
 loadImage(new URL('public/assets/brand/aidan-daly-soft-3d-640.webp',root).pathname),
 readFile(new URL('public/assets/orbit-glyphs.json',root),'utf8').then(JSON.parse),
]);
const c=createCanvas(1200,630),ctx=c.getContext('2d');
ctx.fillStyle='#eeeae1';ctx.fillRect(0,0,1200,630);
const glow=ctx.createRadialGradient(600,345,50,600,345,350);glow.addColorStop(0,'#ffffffdf');glow.addColorStop(1,'#ffffff00');ctx.fillStyle=glow;ctx.fillRect(150,40,900,580);
ctx.drawImage(logo,46,30,210,48.56);ctx.fillStyle='#4b4d43';ctx.font='22px DM';ctx.textAlign='center';ctx.fillText('Hi, I’m Aidan Daly',600,102);
ctx.save();ctx.translate(262.5,110);ctx.scale(.75,.75);const orbit=createOrbitRenderer(data);orbit(ctx,0,false);ctx.drawImage(portrait,146.2,3.5,607.5,607.5);orbit(ctx,0,true);ctx.restore();
await writeFile(new URL('public/assets/aidan-daly-preview-v2.jpg',root),c.toBuffer('image/jpeg',94));
console.log('Created1200×630 share preview from the actual site composition.');

const icon=createCanvas(180,180),ic=icon.getContext('2d');ic.fillStyle='#eeeae1';ic.fillRect(0,0,180,180);ic.drawImage(portrait,300,45,424,424,0,0,180,180);
await writeFile(new URL('public/assets/apple-touch-icon.png',root),icon.toBuffer('image/png'));
