import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {readLimitedBody} from './catalog-http.ts';

export const reviewedImageByteLimit=5*1024*1024;
export const reviewedImagePixelLimit=25_000_000;
const pngHeader=Buffer.from([137,80,78,71,13,10,26,10]);
type ReviewedBytes={digest:string;algorithm:'sha1'|'sha256';bytes:number;userAgent:string};

// Callers validate the host and path against their source's policy before downloading.
export async function downloadCatalogPhoto(url:string,request:typeof fetch,reviewed?:ReviewedBytes):Promise<string|null> {
 if(reviewed&&(reviewed.bytes<1||reviewed.bytes>reviewedImageByteLimit)) return null;
 try {
  const res=await request(url,{
   headers:{accept:'image/jpeg, image/png, image/webp',...(reviewed?{'user-agent':reviewed.userAgent}:{})},
   credentials:'omit',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(reviewed?6000:2300),
  });
  const mime=res.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if(!res.ok||res.redirected||!mime||!['image/jpeg','image/png','image/webp'].includes(mime)) {
   await res.body?.cancel();
   return null;
  }
  const bytes=await readLimitedBody(res,reviewed?.bytes??2*1024*1024);
  if(!bytes) return null;
  if(reviewed&&(bytes.length!==reviewed.bytes||createHash(reviewed.algorithm).update(bytes).digest('hex')!==reviewed.digest)) return null;
  const type=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff?'jpeg':
   bytes.subarray(0,8).equals(pngHeader)?'png':
   bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'webp':null;
  if(!type||mime!=='image/'+type) return null;
  const image=sharp(bytes,{limitInputPixels:reviewed?reviewedImagePixelLimit:8_000_000});
  const meta=await image.metadata();
  if(meta.format!==type||(meta.pages??1)!==1||
   Math.min(meta.width,meta.height)<160||Math.max(meta.width/meta.height,meta.height/meta.width)>4) return null;
  const jpeg=await image.rotate().resize({width:768,height:768,fit:'inside',withoutEnlargement:true})
   .flatten({background:'#fff'}).jpeg({quality:82}).toBuffer();
  const {channels}=await sharp(jpeg).stats();
  return channels.some(channel=>channel.stdev>=8)?'data:image/jpeg;base64,'+jpeg.toString('base64'):null;
 } catch {
  return null;
 }
}
