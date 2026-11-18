import sharp from 'sharp';
import {createHash} from 'node:crypto';
import knownImages from '../../catalog/parfumo-images.json' with {type:'json'};
import publicEditions from '../../catalog/thumbnail-editions.json' with {type:'json'};
import identity from '../../catalog/identity.json' with {type:'json'};
import {catalogIdentityKey,catalogProfiles,findCatalogProfile} from './catalog.ts';
import {readLimitedBody} from './catalog-http.ts';
import type {CatalogEdition} from './types.ts';

const origin='https://www.parfumo.com',mediaOrigin='https://media.parfumo.com';
const agent='FragOut/0.1 catalog-images (+https://github.com/RoUchiha/FragOut)';
const ttl=24*60*60*1000;
const noYear=(name:string)=>name.replace(/\s*\((?:19|20)\d{2}\)/g,'').trim();
const text=(value:string)=>decode(value.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const normalize=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[’']/g,'').replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const photoHouseAliases:Record<string,string>={'editions de parfums frederic malle':'frederic malle'};
const house=(name:string)=>photoHouseAliases[normalize(name)]??identity.houseAliases[normalize(name) as keyof typeof identity.houseAliases]??normalize(name);
const nameForKey=(name:string)=>noYear(name).replace(/\b(\d)\s+(am|pm)\b/gi,'$1$2')
 .replace(/\s*\/\s*(?=[^()]*[\u0600-\u06ff])[^()]*/g,' ').replace(/\s*\(Perfume\)$/i,'')
 .replace(/\(Eau de (Parfum|Toilette) Intense\)/gi,(_all,format)=>' Intense Eau de '+format)
 .replace(/^Emporio Armani\s*[-–—:]?\s*(?=Stronger With You\b)/i,'').trim();
const sourceHouse=(edition:CatalogEdition)=>house(edition.brand);
const photoAliases:Record<string,string[]>={
 'prada-lhomme-prada-edt':["L'Homme"],
 'versace-dylan-blue-edt':['Versace pour Homme Dylan Blue'],
};
const trailingFormat=(name:string,edition?:CatalogEdition)=>{
 const match=[...formats].sort(([a],[b])=>b.length-a.length).find(([label])=>normalize(name).endsWith(' '+label));
 return match&&(!edition||match[1]===edition.concentration||!normalize(edition.name).endsWith(' '+match[0]))?match[1]:undefined;
};
const formats=new Map(Object.entries(identity.suffixes).flatMap(([code,names])=>names.map(name=>[normalize(name),code])));
const concentrations=new Map<string,Set<string>>();
const years=new Map<string,Set<number>>();
for(const item of [...catalogProfiles,...publicEditions]){
 const key=catalogIdentityKey({...item,brand:sourceHouse(item),name:nameForKey(item.name)});
 if(!key)continue;
 const [brand,name]=JSON.parse(key),label=JSON.stringify([brand,name]);
 const values=concentrations.get(label)??new Set<string>();values.add(item.concentration);concentrations.set(label,values);
 const year=item.releaseYear??Number(item.name.match(/\((\d{4})\)/)?.[1]);
 if(year){const values=years.get(key)??new Set<number>();values.add(year);years.set(key,values);}
}

function decode(value:string){return value.replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x[\da-f]+|\d+);/gi,entity=>{
 const named:Record<string,string>={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '};
 if(named[entity.toLowerCase()])return named[entity.toLowerCase()];
 const code=entity.toLowerCase().startsWith('&#x')?parseInt(entity.slice(3,-1),16):Number(entity.slice(2,-1));
 return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';
});}
const attributes=(tag:string)=>new Map([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(([,name,a,b,c])=>[name.toLowerCase(),decode(a??b??c)]));

function pageUrl(value:string,kind:'brand'|'product'|'either'='product'){
 try{
  const url=new URL(decode(value));
  if(url.origin!==origin||url.username||url.password||url.hash||/%(?:2f|5c|2e)/i.test(url.pathname))return null;
  const parts=url.pathname.split('/').filter(Boolean);
  if(parts[0]!=='Perfumes'||parts.length<(kind==='product'?3:2)||parts.length>(kind==='brand'?2:3)||parts.some(part=>!/^[-\w%().+]+$/.test(part)))return null;
  url.search='';return url.href;
 }catch{return null;}
}
function imageUrl(value:string){
 try{
  const url=new URL(decode(value));
  if(url.origin!==mediaOrigin||url.username||url.password||url.hash||/%(?:2f|5c|2e)/i.test(url.pathname)||
   !/^\/perfumes\/[a-f\d]{2}\/[a-z\d_%()-]+_\d{3,4}\.(?:jpe?g|png|webp)$/i.test(url.pathname)||
   /(?:^|[-_/])(?:box|carton|tester|sample|back|rear|logo|placeholder|default)(?:[-_.]|$)/i.test(url.pathname))return null;
  url.search='';url.searchParams.set('width','1000');url.searchParams.set('quality','90');return url.href;
 }catch{return null;}
}
function keysFor(edition:CatalogEdition){
 const profile=findCatalogProfile(edition) as (ReturnType<typeof findCatalogProfile>&{aliases?:string[]});
 return new Set([edition.name,...(profile?.aliases??[]),...(photoAliases[profile?.id??edition.id]??[])].map(name=>catalogIdentityKey({...edition,brand:sourceHouse(edition),name:nameForKey(name)})).filter(Boolean));
}
function labelParts(label:string,edition?:CatalogEdition){
 const matched=label.match(/^(.*) by (.+)$/);if(!matched)return null;
 const name=matched[1].trim(),brand=matched[2].trim(),suffix=name.match(/\(([^()]+)\)$/)?.[1];
 const intense=suffix?.match(/^eau de (parfum|toilette) intense$/i);
 const concentration=suffix?formats.get(normalize(suffix))??(intense?intense[1].toLowerCase()==='parfum'?'EDP':'EDT':undefined):edition?trailingFormat(name,edition):undefined;
 return {name,brand,concentration};
}
function matches(edition:CatalogEdition,label:{name:string;brand:string;concentration?:string},year?:number){
 const key=catalogIdentityKey({...edition,brand:sourceHouse(edition),name:nameForKey(edition.name)});
 const namedYear=Number(edition.name.match(/\((\d{4})\)/)?.[1]);
 const ambiguous=(years.get(key??'')?.size??0)>1;
 const required=namedYear||(ambiguous?edition.releaseYear:undefined);
 return (!ambiguous||!!required)&&house(label.brand)===sourceHouse(edition)&&(!label.concentration||label.concentration===edition.concentration)&&
  keysFor(edition).has(catalogIdentityKey({...label,brand:house(label.brand),name:nameForKey(label.name),concentration:edition.concentration}))&&
  (required?year===required:!label.concentration||!edition.releaseYear||!year||year===edition.releaseYear);
}

export interface ParfumoImage {sourceUrl:string;imageUrl:string;concentrationEvidence:'explicit'|'cross-checked-single-edition'}
export interface ParfumoListing {url:string;name:string;brand:string;concentration?:string;releaseYear?:number}
export interface ParfumoPhoto extends ParfumoImage {bytes:Buffer;publisher:'Parfumo'}

export function parseParfumoBrands(html:string){
 const brands=new Map<string,{name:string;url:string}>();
 for(const [,tag,content] of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)){
  const attrs=attributes(tag),url=pageUrl(attrs.get('href')??'','brand');
  if(url&&attrs.get('class')?.split(/\s+/).includes('p-box'))brands.set(url,{name:text(content),url});
 }
 return [...brands.values()];
}

export function parseParfumoBrandPage(html:string,source:string):ParfumoListing[]{
 const root=pageUrl(source,'brand');if(!root)return [];
 const entries=new Map<string,ParfumoListing>();
 for(const [,content] of html.matchAll(/<div\s+class=["']col["'][^>]*>([\s\S]*?)(?=<div\s+class=["']col["']|$)/gi)){
  const link=content.match(/<a\b([^>]*)>\s*(<img\b[^>]*>)\s*<\/a>/i);if(!link)continue;
  const url=pageUrl(attributes(link[1]).get('href')??''),img=attributes(link[2]),label=labelParts(img.get('alt')??'');
  if(!url||!url.startsWith(root+'/')||!imageUrl(img.get('src')??'')||!label)continue;
  const year=Number(content.match(/\/Release_Years\/((?:19|20)\d{2})/)?.[1]);
  entries.set(url,{url,...label,...(year?{releaseYear:year}:{})});
 }
 return [...entries.values()];
}

export function parseParfumoPhotoPage(edition:CatalogEdition,html:string,source:string):ParfumoImage|null {
 const page=pageUrl(source);if(!page)return null;
 const canonical=[...html.matchAll(/<link\b[^>]*>/gi)].map(([tag])=>attributes(tag)).find(attrs=>attrs.get('rel')==='canonical');
 if(pageUrl(canonical?.get('href')??'')!==page)return null;
 let breadcrumb:{name?:string}[]|undefined;
 for(const [,raw] of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{const json=JSON.parse(raw),items=Array.isArray(json)?json:[json,...(Array.isArray(json['@graph'])?json['@graph']:[])];
   const trail=items.find(item=>item?.['@type']==='BreadcrumbList');if(Array.isArray(trail?.itemListElement))breadcrumb=trail.itemListElement;
  }catch{/* Invalid structured data does not establish an identity. */}
 }
 if(!breadcrumb||breadcrumb.length<4)return null;
 const brand=decode(breadcrumb.at(-2)?.name??''),name=decode(breadcrumb.at(-1)?.name??'');
 const heading=[...html.matchAll(/<h1\b([^>]*)>([\s\S]*?)<\/h1>/gi)].find(([,tag])=>attributes(tag).get('class')?.split(/\s+/).includes('p_name_h1'))?.[2];
 if(!heading)return null;
 const year=Number(heading.match(/\/Release_Years\/((?:19|20)\d{2})/)?.[1]);
 const field=heading.match(/<span\b[^>]*class=["'][^"']*\bp_con\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
 const fieldName=field?normalize(text(field[1])):'';
 const concentration=field?formats.get(fieldName)??(fieldName==='eau de parfum intense'?'EDP':fieldName==='eau de toilette intense'?'EDT':trailingFormat(name,edition)):trailingFormat(name,edition);
 if(!matches(edition,{name,brand,concentration},year||undefined))return null;
 let concentrationEvidence:ParfumoImage['concentrationEvidence']='explicit';
 if(!concentration){
  const profile=findCatalogProfile(edition),key=catalogIdentityKey({...edition,brand:sourceHouse(edition),name:nameForKey(edition.name)});
  const [brandKey,nameKey]=key?JSON.parse(key):[];
  if(!profile||!profile.notes.length||
   (concentrations.get(JSON.stringify([brandKey,nameKey]))?.size??0)!==1)return null;
  concentrationEvidence='cross-checked-single-edition';
 }
 const images=[...html.matchAll(/<img\b[^>]*>/gi)].map(([tag])=>attributes(tag)).filter(attrs=>attrs.get('class')?.split(/\s+/).includes('p-main-img')&&attrs.get('itemprop')==='image');
 if(images.length!==1)return null;
 const image=images[0],label=labelParts(image.get('alt')??'',edition),asset=imageUrl(image.get('src')??'');
 if(!asset||!label||!matches(edition,label,year||undefined))return null;
 return {sourceUrl:page,imageUrl:asset,concentrationEvidence};
}

export function createParfumoPhotoFinder(request:typeof fetch=fetch,{timeoutMs=8000,maxBrandPages=3,onCollision}:{timeoutMs?:number;maxBrandPages?:number;onCollision?:(ids:string[])=>void}={}){
 let directory:{at:number;value:{name:string;url:string}[]}|undefined;
 const pages=new Map<string,{at:number;value:ParfumoListing[]}>();
 const seenImages=new Map<string,string>();
 async function read(url:string,signal:AbortSignal,image=false):Promise<{bytes:Buffer;url:string;mime:string}|null>{
  for(let redirect=0;redirect<3;redirect++){
   const response=await request(url,{signal,redirect:'manual',credentials:'omit',cache:'no-store',headers:{Accept:image?'image/jpeg, image/png, image/webp':'text/html','User-Agent':agent}});
   if(!image&&[301,302,307,308].includes(response.status)){
    const next=pageUrl(new URL(response.headers.get('location')??'',url).href,'either');await response.body?.cancel();
    if(!next)return null;url=next;continue;
   }
   const mime=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()??'';
   if(!response.ok||response.redirected||!(image?/^image\/(?:jpeg|png|webp)$/:/^text\/html$/).test(mime)){await response.body?.cancel();return null;}
   const bytes=await readLimitedBody(response,image?8_000_000:2_000_000);return bytes?{bytes,url,mime}:null;
  }
  return null;
 }
 async function candidates(edition:CatalogEdition,signal:AbortSignal,discoveryOnly=false){
  const profile=findCatalogProfile(edition),known=(knownImages as Record<string,{sourceUrl:string}>)[profile?.id??edition.id];
  const direct=known?.sourceUrl??[...(profile?.links??[]),...(profile?.sources??[])].map(item=>item.url).find(url=>pageUrl(url));
  const resolved=direct?pageUrl(direct):null;
  const result=resolved&&!discoveryOnly?[resolved]:[];
  if(result.length)return result;
  if(!directory||Date.now()-directory.at>ttl){
   const page=await read(origin+'/Brands',signal),value=page?parseParfumoBrands(page.bytes.toString('utf8')):[];
   directory={at:Date.now()-(value.length?0:ttl-300000),value};
  }
  const brand=directory.value.find(row=>house(row.name)===house(edition.brand));if(!brand)return [];
  for(let number=1;number<=Math.max(1,Math.min(5,maxBrandPages));number++){
   const url=brand.url+(number>1?'?current_page='+number:'');let cached=pages.get(url);
   if(!cached||Date.now()-cached.at>ttl){
    const page=await read(url,signal),value=page?parseParfumoBrandPage(page.bytes.toString('utf8'),brand.url):[];
    cached={at:Date.now()-(value.length?0:ttl-300000),value};
    if(pages.size>=200)pages.delete(pages.keys().next().value!);pages.set(url,cached);
   }
   const matchesForEdition=cached.value.filter(row=>matches(edition,row,row.releaseYear));
   result.push(...matchesForEdition.map(row=>row.url));if(result.length||cached.value.length<20)break;
  }
  return [...new Set(result)].slice(0,2);
 }
 return async(edition:CatalogEdition):Promise<ParfumoPhoto|null>=>{
  const signal=AbortSignal.timeout(timeoutMs);
  try{
   const visited=new Set<string>();
   for(const discoveryOnly of [false,true])for(const candidate of await candidates(edition,signal,discoveryOnly)){
    if(visited.has(candidate))continue;visited.add(candidate);const page=await read(candidate,signal);if(!page)continue;
    const match=parseParfumoPhotoPage(edition,page.bytes.toString('utf8'),page.url);if(!match)continue;
    const image=await read(match.imageUrl,signal,true);if(!image)continue;
    const photo=sharp(image.bytes,{limitInputPixels:16_000_000,failOn:'error'}).autoOrient(),metadata=await photo.metadata();
    const formats:Record<string,string>={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'};
    if(metadata.format!==formats[image.mime]||(metadata.pages??1)!==1||!metadata.width||!metadata.height||
     Math.min(metadata.width,metadata.height)<350||Math.max(metadata.width,metadata.height)>4000)continue;
    const stats=await photo.stats();if(stats.channels.every(channel=>channel.stdev<5))continue;
    const bytes=await photo.flatten({background:'#fff'}).resize(900,900,{fit:'inside',withoutEnlargement:true}).jpeg({quality:86}).toBuffer();
    if(bytes.length>650_000)continue;
    const hash=createHash('sha256').update(bytes).digest('hex'),id=findCatalogProfile(edition)?.id??edition.id;
    const known=knownImages as Record<string,{imageHash?:string}>;
    const conflicts=[...(seenImages.has(hash)&&seenImages.get(hash)!==id?[seenImages.get(hash)!]:[]),...Object.entries(known).filter(([other,record])=>other!==id&&record.imageHash===hash).map(([other])=>other)];
    if(conflicts.length){onCollision?.([id,...conflicts]);continue;}
    if(seenImages.size>=512)seenImages.delete(seenImages.keys().next().value!);seenImages.set(hash,id);
    return {...match,bytes,publisher:'Parfumo'};
   }
  }catch{/* Unavailable or uncertain public sources fall back to existing retailers. */}
  return null;
 };
}

const defaultFinder=createParfumoPhotoFinder();
export const findParfumoCatalogPhoto=(edition:CatalogEdition,request:typeof fetch=fetch)=>request===fetch?defaultFinder(edition):createParfumoPhotoFinder(request)(edition);
