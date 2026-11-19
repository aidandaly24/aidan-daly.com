import*as T from'./vendor/package/build/three.module.js';import{City,dt}from'./city.mjs';import{createView}from'./scene.mjs';
const fig=document.querySelector('figure'),mq=matchMedia('(prefers-reduced-motion: reduce)'),seed=crypto.getRandomValues(new Uint32Array(1))[0];
let l=-1,view,city,renderer,prev=0,acc=0;let startedAt=0;
function resize(){let next=innerWidth/innerHeight<.92?1:0;if(l!==next){let previous=city?.clock||0;l=next;renderer?.dispose();fig.replaceChildren();view=createView(l);city=new City(seed,l); // no seek or teleport on normal resizes; a changed art orientation starts its own coherent session.
let name=l?'portrait':'desktop',img=new Image;img.src='./art/'+name+'.webp';fig.append(img);
renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.setClearColor(0,0);fig.append(renderer.domElement);
for(let [kind,rect]of [['armrest',l?[266,1162,343,1235]:[251,788,326,862]],['rail',l?[130,821,731,926]:[500,630,1141,776]]]){let im=new Image;im.src='./art/'+name+'-'+kind+'.png';im.className='front';Object.assign(im.style,{left:100*rect[0]/view.w+'%',top:100*rect[1]/view.h+'%',width:100*(rect[2]-rect[0])/view.w+'%'});fig.append(im)}}
let k=Math.min(innerWidth/view.w,innerHeight/view.h);fig.style.width=view.w*k+'px';fig.style.height=view.h*k+'px';renderer.setSize(Math.ceil(view.w*k),Math.ceil(view.h*k),false);view.sync(city);renderer.render(view.scene,view.cam)}
function animate(now){if(!mq.matches&&!document.hidden){acc+=prev?Math.min(.12,(now-prev)/1000):0;while(acc>=dt){city.tick();acc-=dt}view.sync(city);renderer.render(view.scene,view.cam)}prev=now;requestAnimationFrame(animate)}resize();addEventListener('resize',resize);requestAnimationFrame(animate)
