import { TAU, wrap } from './motion.js';

export function framePair(angle,count) {
  const position=wrap(-angle)/TAU*count,first=Math.floor(position)%count;
  return {first,second:(first+1)%count,fraction:position-Math.floor(position)};
}
export function tileRect(frame,spec) {
  return [(frame%spec.columns)*spec.tileWidth,Math.floor(frame/spec.columns)*spec.tileHeight,spec.tileWidth,spec.tileHeight];
}
export function neighboringPages(frame,framesPerPage,pageCount) {
  const current=Math.floor(frame/framesPerPage);
  return [...new Set([current,(current+1)%pageCount,(current-1+pageCount)%pageCount])];
}
async function bitmap(url) {
  const response=await fetch(url);
  if(!response.ok)throw Error('Portrait media unavailable');
  return createImageBitmap(await response.blob());
}

// Keep a complete small rotation available; decode only nearby high-resolution pages.
// Closing retired ImageBitmaps bounds decoded memory on phones and fast drag reversals.
export class Turntable {
  static async load(url,{highResolution=true}={}) {
    const response=await fetch(url);if(!response.ok)throw Error('Portrait manifest unavailable');
    const manifest=await response.json();
    if(manifest.type!=='rendered-turntable'||!Number.isInteger(manifest.frames)||manifest.frames<2||manifest.frames>240)throw Error('Invalid portrait');
    const root=new URL('.',new URL(url,location.href));
    const base=await bitmap(new URL(manifest.base.url,root));
    return new Turntable(manifest,root,base,highResolution);
  }
  constructor(manifest,root,base,highResolution) {
    this.manifest=manifest;this.root=root;this.base=base;this.highResolution=highResolution;
    this.cache=new Map();this.pending=new Set();this.failed=new Set();this.wanted=[];this.disposed=false;
    this.buffer=document.createElement('canvas');this.context=this.buffer.getContext('2d');
    this.lastQuality='base';
  }
  prefetch(first) {
    const hd=this.manifest.hd;if(!this.highResolution||!hd||this.disposed)return;
    this.wanted=neighboringPages(first,hd.framesPerPage,hd.pages.length);
    for(const [index,image] of this.cache)if(!this.wanted.includes(index)){image.close();this.cache.delete(index);}
    this.pump();
  }
  pump() {
    const hd=this.manifest.hd;if(this.disposed||!hd)return;
    for(const index of this.wanted) {
      if(this.pending.size>=2)break;
      if(this.cache.has(index)||this.pending.has(index)||this.failed.has(index))continue;
      this.pending.add(index);
      bitmap(new URL(hd.pages[index].url,this.root)).then(image=>{
        if(this.disposed||!this.wanted.includes(index))image.close();else this.cache.set(index,image);
      }).catch(()=>this.failed.add(index)).finally(()=>{this.pending.delete(index);this.pump();});
    }
  }
  draw(ctx,angle,{highResolution=true}={}) {
    const m=this.manifest,full=framePair(angle,m.frames);this.highResolution=highResolution;this.prefetch(full.first);
    let pair=framePair(angle,m.base.frames),sources=[this.base,this.base],specs=[m.base,m.base],indices=[pair.first,pair.second];
    const hd=m.hd;
    if(highResolution&&hd){
      const pages=[Math.floor(full.first/hd.framesPerPage),Math.floor(full.second/hd.framesPerPage)];
      if(pages.every(i=>this.cache.has(i))){pair=full;sources=pages.map(i=>this.cache.get(i));specs=pages.map(i=>hd.pages[i]);indices=[full.first%hd.framesPerPage,full.second%hd.framesPerPage];this.lastQuality='high';}
      else this.lastQuality='base';
    }else this.lastQuality='base';
    const [w,h]=[specs[0].tileWidth,specs[0].tileHeight];
    if(this.buffer.width!==w||this.buffer.height!==h){this.buffer.width=w;this.buffer.height=h;}
    const b=this.context;b.clearRect(0,0,w,h);b.globalCompositeOperation='source-over';b.globalAlpha=1-pair.fraction;
    b.drawImage(sources[0],...tileRect(indices[0],specs[0]),0,0,w,h);
    b.globalCompositeOperation='lighter';b.globalAlpha=pair.fraction;b.drawImage(sources[1],...tileRect(indices[1],specs[1]),0,0,w,h);
    b.globalCompositeOperation='source-over';b.globalAlpha=1;
    const [x,y,cw,ch]=m.crop;ctx.drawImage(this.buffer,146.2+x*607.5,3.5+y*607.5,cw*607.5,ch*607.5);
  }
  dispose(){this.disposed=true;this.base.close();for(const image of this.cache.values())image.close();this.cache.clear();this.buffer.width=this.buffer.height=1;}
  get decodedBytes(){let bytes=this.base.width*this.base.height*4;for(const image of this.cache.values())bytes+=image.width*image.height*4;return bytes;}
}
