import manifest from '../../catalog/web-thumbnails.json' with {type:'json'};
import {catalogIdentityKey} from './catalog.ts';
import {downloadReviewedCommonsPhoto,type ReviewedCommonsPhoto} from './catalog-commons.ts';
import {retryAfterDelay} from './catalog-http.ts';
import type {CatalogEdition,RemoteCatalogThumbnail} from './types.ts';

type Label=Pick<CatalogEdition,'brand'|'name'|'concentration'>;
const reviews=new Map<string,ReviewedCommonsPhoto>();
for(const row of manifest as (Label & ReviewedCommonsPhoto)[]) {
 const key=catalogIdentityKey(row);
 if(!key||reviews.has(key)||!['front','front-angle'].includes(row.view)||!/^[a-f0-9]{40}$/.test(row.sha1))
  throw new Error('Invalid or duplicate reviewed photo for '+row.name);
 reviews.set(key,row);
}

export function hasWebThumbnail(label:Label) {
 const key=catalogIdentityKey(label);
 return key!==null&&reviews.has(key);
}

export function createWebThumbnailLookup(request:typeof fetch=fetch) {
 const pending=new Map<string,Promise<RemoteCatalogThumbnail|null>>();
 const cached=new Map<string,{photo:RemoteCatalogThumbnail|null;until:number}>();
 let queue:Promise<unknown>=Promise.resolve();
 let retryAt=0;
 const fetchWithBackoff:typeof fetch=async (input,options)=>{
  const response=await request(input,options);
  if(response.status===429||response.status===503)
   retryAt=Date.now()+retryAfterDelay(response.headers.get('retry-after'));
  return response;
 };
 return async (edition:CatalogEdition,admit:()=>boolean):Promise<RemoteCatalogThumbnail|null>=>{
  const key=catalogIdentityKey(edition);
  const review=key&&reviews.get(key);
  if(!key||!review) return null;
  const saved=cached.get(key);
  if(saved&&Date.now()<saved.until) return saved.photo;
  const existing=pending.get(key);
  if(existing) return existing;
  if(pending.size>=3||Date.now()<retryAt||!admit()) return null;
  const result=queue.then(async()=>{
   if(Date.now()<retryAt) return null;
   try {
    const photo=await downloadReviewedCommonsPhoto(review,fetchWithBackoff);
    if(!cached.has(key)&&cached.size>=32) cached.delete(cached.keys().next().value!);
    cached.set(key,{photo,until:Date.now()+(photo?15:1)*60_000});
    return photo;
   } catch {
    retryAt=Math.max(retryAt,Date.now()+60_000);
    return null;
   }
  }).finally(()=>pending.delete(key));
  pending.set(key,result);
  queue=result;
  return result;
 };
}

export const lookupWebThumbnail=createWebThumbnailLookup();
