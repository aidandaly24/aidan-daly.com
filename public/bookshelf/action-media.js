// Playback for genuine articulated renders. This module is intentionally not
// mounted until a verified character loop and matched composition are supplied.
// Images are discrete animation frames: never cross-fade limbs to fake motion.
export const MAX_PAGE_BYTES = 24 * 1024 * 1024;

export function validateActionManifest(m) {
  if(m?.type!=='rendered-action'||!Number.isInteger(m.frames)||m.frames<2||m.frames>360||!Number.isFinite(m.fps)||m.fps<12||m.fps>60)throw Error('Invalid action timing');
  if(!Number.isInteger(m.framesPerPage)||m.framesPerPage<1||m.framesPerPage>16)throw Error('Invalid action page size');
  if(!m.tiers||!Object.keys(m.tiers).length)throw Error('Missing action tiers');
  for(const t of Object.values(m.tiers)){
    if(!Number.isInteger(t.width)||!Number.isInteger(t.height)||t.width<1||t.height<1||t.width>2048||t.height>2048)throw Error('Invalid action dimensions');
    if(!Array.isArray(t.pages)||t.pages.length!==Math.ceil(m.frames/m.framesPerPage))throw Error('Incomplete action sequence');
    for(const p of t.pages){
      if(typeof p.url!=='string'||!p.url||p.url.startsWith('/')||/^(?:[a-z]+:|\/\/)/i.test(p.url)||p.url.split('/').includes('..'))throw Error('Action pages must be local relative assets');
      if(!Number.isInteger(p.columns)||!Number.isInteger(p.rows)||p.columns<1||p.rows<1||p.columns*p.rows<m.framesPerPage)throw Error('Invalid action atlas');
      if(p.columns*t.width>4096||p.rows*t.height>4096||p.columns*p.rows*t.width*t.height*4>MAX_PAGE_BYTES)throw Error('Action atlas exceeds memory budget');
    }
  }
  return m;
}

export function actionFrame(seconds,fps,frames){
  const duration=frames/fps;
  return Math.min(frames-1,Math.floor(((seconds%duration+duration)%duration)*fps+1e-8));
}

export function actionPages(frame,framesPerPage,pageCount){
  const current=Math.floor(frame/framesPerPage);
  return [...new Set([current,(current+1)%pageCount])];
}

export function chooseActionTier(manifest,{displayHeight,dpr=1,saveData=false,maxDecodedBytes=24*1024*1024}={}){
  const tiers=Object.entries(validateActionManifest(manifest).tiers).sort((a,b)=>a[1].height-b[1].height);
  const allowed=tiers.filter(([,t])=>Math.max(...t.pages.map(p=>p.columns*p.rows*t.width*t.height*4))*Math.min(3,t.pages.length)<=maxDecodedBytes);
  if(!allowed.length)return null; // Keep a static poster rather than exceed the device budget.
  if(saveData)return allowed[0][0];
  const target=Math.max(1,displayHeight||1)*Math.max(1,Math.min(dpr,3));
  return (allowed.find(([,t])=>t.height>=target)||allowed.at(-1))[0];
}

async function decodeBitmap(url){
  const response=await fetch(url);if(!response.ok)throw Error('Action frame unavailable');
  return createImageBitmap(await response.blob());
}

export class ActionSequence {
  static async load(url,{tier='mobile',decode=decodeBitmap}={}){
    const response=await fetch(url);if(!response.ok)throw Error('Action manifest unavailable');
    const manifest=validateActionManifest(await response.json());
    return new ActionSequence(manifest,new URL('.',new URL(url,location.href)),tier,decode);
  }
  constructor(manifest,root,tier,decode=decodeBitmap){
    this.manifest=validateActionManifest(manifest);this.tier=manifest.tiers[tier];
    if(!this.tier)throw Error('Unknown action tier');
    this.root=root;this.decode=decode;this.cache=new Map();this.pending=new Set();this.failed=new Set();this.wanted=[];this.disposed=false;this.lastDraw=null;
  }
  prefetch(frame){
    if(this.disposed)return;
    this.wanted=actionPages(frame,this.manifest.framesPerPage,this.tier.pages.length);
    for(const [index,image] of this.cache)if(!this.wanted.includes(index)){image.close();this.cache.delete(index);}
    this.pump();
  }
  pump(){
    if(this.disposed)return;
    for(const index of this.wanted){
      // One in-flight page limits transient memory when another scene is active.
      if(this.pending.size)break;
      if(this.cache.has(index)||this.pending.has(index)||this.failed.has(index))continue;
      this.pending.add(index);
      this.decode(new URL(this.tier.pages[index].url,this.root)).then(image=>{
        const p=this.tier.pages[index];
        if(image.width!==p.columns*this.tier.width||image.height!==p.rows*this.tier.height){image.close();throw Error('Action atlas dimensions do not match');}
        if(this.disposed||!this.wanted.includes(index))image.close();else this.cache.set(index,image);
      }).catch(()=>this.failed.add(index)).finally(()=>{this.pending.delete(index);this.pump();});
    }
  }
  draw(ctx,frame){
    if(this.disposed)return false;
    this.prefetch(frame);
    const pageIndex=Math.floor(frame/this.manifest.framesPerPage),image=this.cache.get(pageIndex);
    // Hold the last correct frame during a slow load. Do not blank or skip ahead.
    if(!image)return false;
    const previous=this.lastDraw;
    if(previous?.ctx===ctx&&previous.frame===frame&&previous.width===ctx.canvas.width&&previous.height===ctx.canvas.height)return true;
    const p=this.tier.pages[pageIndex],local=frame%this.manifest.framesPerPage,{width:w,height:h}=this.tier;
    ctx.clearRect(0,0,ctx.canvas.width,ctx.canvas.height);
    ctx.drawImage(image,(local%p.columns)*w,Math.floor(local/p.columns)*h,w,h,0,0,ctx.canvas.width,ctx.canvas.height);
    this.lastDraw={ctx,frame,width:ctx.canvas.width,height:ctx.canvas.height};
    return true;
  }
  dispose(){this.disposed=true;for(const image of this.cache.values())image.close();this.cache.clear();this.lastDraw=null;}
  get decodedBytes(){return [...this.cache.values()].reduce((sum,image)=>sum+image.width*image.height*4,0);}
}

export class ActionPlayback {
  constructor(sequence){this.sequence=sequence;this.seconds=0;}
  tick(ctx,delta,{playing=true,visible=true}={}){
    const m=this.sequence.manifest,next=this.seconds+(playing&&visible?Math.max(0,Math.min(delta,.1)):0),frame=actionFrame(next,m.fps,m.frames);
    if(this.sequence.draw(ctx,frame)){this.seconds=next%(m.frames/m.fps);return true;}
    return false;
  }
  reset(){this.seconds=0;}
}
