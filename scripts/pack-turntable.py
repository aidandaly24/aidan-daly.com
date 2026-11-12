"""Pack completed, verified renders. Never substitute or invent missing angles."""
from pathlib import Path
from PIL import Image
import argparse, json, math

p=argparse.ArgumentParser()
p.add_argument('--source',required=True)
p.add_argument('--output',required=True)
p.add_argument('--frames',type=int,required=True)
p.add_argument('--format',default='png')
p.add_argument('--hd',action='store_true')
p.add_argument('--incremental',action='store_true',help='Pack completed HD pages only; do not write a publishable manifest.')
a=p.parse_args()
src=Path(a.source);out=Path(a.output)
paths=[src/f'frame-{i:03}.{a.format}' for i in range(a.frames)]
missing=[str(x) for x in paths if not x.exists()]
assert not missing or a.incremental, f'Missing {len(missing)} actual rendered angles: {missing[:4]}'
out.mkdir(parents=True,exist_ok=True)
size=Image.open(paths[0]).width
crop=[5/16,1/16,3/8,29/32]
box=(round(size*crop[0]),round(size*crop[1]),round(size*(crop[0]+crop[2])),round(size*(crop[1]+crop[3])))
images=[]
for path in paths:
 if not path.exists():
  images.append(None);continue
 im=Image.open(path).convert('RGBA');assert im.size==(size,size)
 bbox=im.getchannel('A').point(lambda x:255 if x>2 else 0).getbbox()
 assert bbox and bbox[0]>=box[0] and bbox[1]>=box[1] and bbox[2]<=box[2] and bbox[3]<=box[3],(path,bbox,box)
 images.append(im.crop(box))

def sheet(frames,tile,columns,path):
 w,h=tile;result=Image.new('RGBA',(w*columns,h*math.ceil(len(frames)/columns)))
 for i,im in enumerate(frames):
  # Resizing is only for responsive media delivery, not retouching the character.
  result.paste(im.resize(tile,Image.Resampling.LANCZOS),(i%columns*w,i//columns*h))
 result.save(path,format='WEBP',quality=88,method=6,exact=True)
 return {'url':path.name,'columns':columns,'tileWidth':w,'tileHeight':h,'bytes':path.stat().st_size}

if a.incremental:
 assert a.hd
 for start in range(0,a.frames,12):
  group=images[start:start+12]
  if all(x is not None for x in group):
   path=out/f'hd-{start//12:02}.webp'
   if not path.exists():
    sheet(group,images[0].size,4,path);print('Packed completed page',start//12,flush=True)
 raise SystemExit(0)

stride=2 if a.frames==144 else 1
base_size=min(size,512)
base_tile=(round(base_size*crop[2]),round(base_size*crop[3]))
base=sheet(images[::stride],base_tile,12,out/'base.webp');base['frames']=len(images[::stride])
manifest={'version':'v12-hires-2','type':'rendered-turntable','frames':a.frames,'sourceSize':size,'crop':crop,'base':base}
if a.hd:
 pages=[]
 for start in range(0,a.frames,12):
  path=out/f'hd-{start//12:02}.webp'
  if path.exists():
   saved=Image.open(path);assert saved.size==(images[0].width*4,images[0].height*math.ceil(len(images[start:start+12])/4))
   page={'url':path.name,'columns':4,'tileWidth':images[0].width,'tileHeight':images[0].height,'bytes':path.stat().st_size}
  else:page=sheet(images[start:start+12],images[0].size,4,path)
  page['start']=start;page['frames']=len(images[start:start+12]);pages.append(page)
 manifest['hd']={'framesPerPage':12,'pages':pages}
Image.open(paths[0]).save(out/'poster.webp',format='WEBP',quality=90,method=6,exact=True)
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'frames':len(paths),'totalBytes':sum(x.stat().st_size for x in out.iterdir()),'baseDecodedBytes':base_tile[0]*base_tile[1]*base['frames']*4,'maxHdCacheBytes':images[0].width*images[0].height*12*3*4},indent=2))
