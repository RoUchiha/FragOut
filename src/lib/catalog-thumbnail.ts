import sharp from 'sharp';
import {fetchFragellaPayload,pickFragellaEdition,readLimitedBody} from './fragella.ts';
import type {CatalogEdition,RemoteCatalogThumbnail} from './types.ts';

const cacheDuration=5*60_000;
const cacheLimit=32;
const imageLimit=2*1024*1024;
const assetUrl=/^https:\/\/cdn\.fragella\.com\/images\/([a-z0-9][a-z0-9_-]{0,149})\.(?:jpe?g|webp|png)$/i;
const placeholder=/(?:^|[_-])(?:default|placeholder|unavailable|missing|no[-_]?image|no[-_]?photo)(?:[_-]|$)/i;

function imageCandidate(value:unknown) {
 if(typeof value!=='string'||value!==value.trim()||!value.startsWith('https://cdn.fragella.com/images/')) return null;
 const slug=assetUrl.exec(value)?.[1]?.toLowerCase();
 return slug&&!placeholder.test(slug)?{url:value,slug}:null;
}

async function downloadImage(url:string,request:typeof fetch):Promise<string|null> {
 try {
  const res=await request(url,{
   headers:{accept:'image/jpeg, image/png, image/webp'},credentials:'omit',redirect:'error',
   cache:'no-store',signal:AbortSignal.timeout(2300),
  });
  const mime=res.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if(!res.ok||!mime||!['image/jpeg','image/png','image/webp'].includes(mime)) {
   await res.body?.cancel();
   return null;
  }
  const bytes=await readLimitedBody(res,imageLimit);
  if(!bytes) return null;
  const type=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff?'jpeg':
   bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))?'png':
   bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'?'webp':null;
  if(!type||mime!=='image/'+type) return null;
  const image=sharp(bytes,{limitInputPixels:8_000_000});
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

export function createFragellaThumbnailLookup(request:typeof fetch=fetch) {
 const cached=new Map<string,{photo:RemoteCatalogThumbnail;expiresAt:number}>();
 const pending=new Map<string,Promise<RemoteCatalogThumbnail|null>>();
 let retryAt=0;
 async function load(edition:CatalogEdition,key:string) {
  let row;
  try {
   row=pickFragellaEdition(edition,await fetchFragellaPayload(edition,key,request));
  } catch {
   retryAt=Date.now()+60_000;
   return null;
  }
  if(!row) return null;
  const primary=imageCandidate(row['Image URL']);
  const alternate=imageCandidate(row['Image URL Transparent']);
  // A transparent image must identify the same bottle as the primary.
  const sameBottle=alternate?.slug===(primary?.slug??row._id.toLowerCase());
  const candidates=new Set([primary?.url,sameBottle?alternate?.url:undefined]);
  for(const candidate of candidates) {
   if(!candidate) continue;
   const uri=await downloadImage(candidate,request);
   if(!uri) continue;
   const photo:RemoteCatalogThumbnail={
    uri,caption:edition.name+' bottle',
    source:{id:'fragella-thumbnail',publisher:'Fragella',url:'https://app.fragella.com/fragrance/'+row._id,kind:'photo',
     credit:'Bottle image via Fragella'},
   };
   if(cached.size>=cacheLimit) cached.delete(cached.keys().next().value!);
   cached.set(edition.id,{photo,expiresAt:Date.now()+cacheDuration});
   return photo;
  }
  return null;
 }
 return async (edition:CatalogEdition,key:string,admit:()=>boolean=()=>true):Promise<RemoteCatalogThumbnail|null>=>{
  if(!key) return null;
  const previous=cached.get(edition.id);
  if(previous&&previous.expiresAt>Date.now()) return previous.photo;
  if(previous) cached.delete(edition.id);
  const existing=pending.get(edition.id);
  if(existing) return existing;
  if(Date.now()<retryAt||!admit()) return null;
  const lookup=load(edition,key).finally(()=>pending.delete(edition.id));
  pending.set(edition.id,lookup);
  return lookup;
 };
}

export const lookupFragellaThumbnail=createFragellaThumbnailLookup();
