import {readFile,stat} from 'node:fs/promises';
for(const variant of ['no-glasses','glasses']) {
 const dir=`public/assets/portrait-v2/${variant}/`,m=JSON.parse(await readFile(dir+'manifest.json','utf8'));
 if(m.type!=='rendered-turntable'||m.crop.length!==4)throw Error('Invalid rendered portrait manifest');
 if(variant==='no-glasses'&&(m.frames!==144||m.sourceSize!==1024||m.hd?.pages.length!==12))throw Error('High-resolution sequence is incomplete');
 const files=[m.base,...(m.hd?.pages||[])];
 for(const item of files) {
  if(!/^[a-z0-9-]+\.webp$/.test(item.url))throw Error('Invalid media path');
  const info=await stat(dir+item.url);
  if(info.size!==item.bytes||info.size===0)throw Error(`Incomplete portrait media: ${item.url}`);
 }
 for(let i=0;i<(m.hd?.pages.length||0);i++)if(m.hd.pages[i].start!==i*12||m.hd.pages[i].frames!==12)throw Error('Missing actual camera angles');
}
console.log('Validated complete portrait media.');

const html=await readFile('public/index.html','utf8');
if(html.includes('og:video')){
 const image=await stat('public/assets/aidan-daly-preview-v2.jpg'),icon=await stat('public/assets/apple-touch-icon.png'),video=await stat('public/assets/aidan-daly-preview-v2.mp4');
 if(video.size===0||image.size+icon.size+video.size>10_000_000)throw Error('Share preview is incomplete or exceeds the Messages resource budget');
}
