// Optional local media-build tool. Requires @napi-rs/canvas and ffmpeg.
// Takes a complete genuine turntable directory, never synthesized camera angles.
import {createRequire} from 'node:module';
import {readFile,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createOrbitRenderer} from '../public/orbit.js';
const {createCanvas,loadImage,GlobalFonts}=createRequire(import.meta.url)('@napi-rs/canvas');
const root=new URL('../',import.meta.url),source=process.argv[2];
if(!source)throw Error('Pass the directory containing all144 actual1024px PNG camera views.');
for(let i=0;i<144;i++)await access(`${source}/frame-${String(i).padStart(3,'0')}.png`);
GlobalFonts.registerFromPath(new URL('public/assets/fonts/dm-sans.ttf',root).pathname,'DM');
const [logo,data]=await Promise.all([loadImage(new URL('public/assets/brand/aidan-daly-soft-3d-640.webp',root).pathname),readFile(new URL('public/assets/orbit-glyphs.json',root),'utf8').then(JSON.parse)]);
const width=1200,height=630,fps=30,duration=26,frames=fps*duration;
const canvas=createCanvas(width,height),ctx=canvas.getContext('2d'),body=createCanvas(1024,1024),b=body.getContext('2d');
const background=createCanvas(width,height),bg=background.getContext('2d');
bg.fillStyle='#eeeae1';bg.fillRect(0,0,width,height);const glow=bg.createRadialGradient(600,345,50,600,345,350);glow.addColorStop(0,'#ffffffdf');glow.addColorStop(1,'#ffffff00');bg.fillStyle=glow;bg.fillRect(150,40,900,580);
bg.drawImage(logo,46,30,210,48.56);bg.fillStyle='#4b4d43';bg.font='22px DM';bg.textAlign='center';bg.fillText('Hi, I’m Aidan Daly',600,102);
const orbit=createOrbitRenderer(data),cache=new Map();
async function frame(i){if(cache.has(i))return cache.get(i);const image=await loadImage(`${source}/frame-${String(i).padStart(3,'0')}.png`);cache.set(i,image);if(cache.size>6)cache.delete(cache.keys().next().value);return image;}
const output=new URL('public/assets/aidan-daly-preview-v2.mp4',root).pathname;
const encoder=spawn('ffmpeg',['-y','-loglevel','warning','-f','image2pipe','-vcodec','png','-framerate',String(fps),'-i','pipe:0','-an','-c:v','libx264','-threads','2','-preset','medium','-crf','23','-profile:v','high','-pix_fmt','yuv420p','-movflags','+faststart',output],{stdio:['pipe','inherit','inherit']});
const exit=once(encoder,'exit');
for(let i=0;i<frames;i++){
 const t=i/fps;
 // Two body turns and one opposite text turn form a clean26-second preview loop.
 const angle=t/13*Math.PI*2,position=(((-angle/(Math.PI*2)*144)%144)+144)%144,first=Math.floor(position),fraction=position-first;
 const [a,z]=await Promise.all([frame(first),frame((first+1)%144)]);
 b.clearRect(0,0,1024,1024);b.globalCompositeOperation='source-over';b.globalAlpha=1-fraction;b.drawImage(a,0,0);b.globalCompositeOperation='lighter';b.globalAlpha=fraction;b.drawImage(z,0,0);b.globalCompositeOperation='source-over';b.globalAlpha=1;
 ctx.clearRect(0,0,width,height);ctx.drawImage(background,0,0);ctx.save();ctx.translate(262.5,110);ctx.scale(.75,.75);orbit(ctx,-t/26*Math.PI*2,false);ctx.drawImage(body,146.2,3.5,607.5,607.5);orbit(ctx,-t/26*Math.PI*2,true);ctx.restore();
 if(!encoder.stdin.write(canvas.toBuffer('image/png')))await once(encoder.stdin,'drain');
 if(i%150===0)console.log(`Preview frame${i}/${frames}`);
}
encoder.stdin.end();const [code]=await exit;if(code!==0)throw Error(`Encoder exit${code}`);console.log(output);
