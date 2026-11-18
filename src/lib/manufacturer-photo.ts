import sharp from 'sharp';
import {createHash} from 'node:crypto';
import manufacturerImages from '../../catalog/manufacturer-images.json' with {type:'json'};
import parfumoImages from '../../catalog/parfumo-images.json' with {type:'json'};
import publicEditions from '../../catalog/thumbnail-editions.json' with {type:'json'};
import identity from '../../catalog/identity.json' with {type:'json'};
import {catalogIdentityKey,catalogProfiles,findCatalogProfile} from './catalog.ts';
import {readLimitedBody} from './catalog-http.ts';
import {looksLikePackshot} from './bottle-packshot.ts';
import type {CatalogEdition} from './types.ts';

type Candidate={imageUrl:string;priority:number};
export interface ManufacturerPhoto {bytes:Buffer;sourceUrl:string;imageUrl:string;publisher:string}
type PhotoSet={sourceUrl:string;publisher:string;candidates:Candidate[]};
type Product={name:string;brand?:string;description?:string;category?:string;url?:string;releaseDate?:string;images:{src:string;alt?:string;main?:boolean}[]};
const agent='FragOut/0.1 catalog-images (+https://github.com/RoUchiha/FragOut)';
const text=(value:string)=>decode(value.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const normalize=(value:string)=>value.replace(/[™®℠]/g,'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[’']/g,'').replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const house=(name:string)=>normalize(name)==='al haramain perfumes'?'al haramain':identity.houseAliases[normalize(name) as keyof typeof identity.houseAliases]??normalize(name);
const noYear=(name:string)=>name.replace(/\s*\((?:19|20)\d{2}\)/g,'').trim();
const noSize=(name:string)=>name.replace(/\b\d{1,4}(?:\.\d+)?\s*(?:ml|(?:fl\.?\s*)?oz\.?)\b/gi,' ').replace(/\s+/g,' ').trim();
const unsuitable=/\b(?:gift\s*set|bundle|tester|sample|vial|refill|after\s*shave|deodorant|body\s*lotion|body\s*wash|candle)\b/i;
const alternateView=/\b(?:overhead|flat\s*lay|top\s*view|bottom\s*view|back|rear|barcode|box|carton|packaging|lifestyle|ingredients?|swatch|layering|routine|olfactorymap|infographic|feels\s*like|year\s*story|cheirosa\s*effect|people|model|beach|travel\s*size|refill|bottles)\b/i;
const frontView=/\b(?:front|frontangle|packshot|flacon|bottle)\b/i;
const manufacturerOrigins=new Map<string,Set<string>>(),storeRoots=new Map<string,Set<string>>();
for(const profile of catalogProfiles)for(const source of profile.sources.filter(source=>source.kind==='house')){
 try{
  const url=new URL(source.url);if(url.protocol!=='https:'||url.username||url.password||url.port)continue;
  const key=house(profile.brand),origins=manufacturerOrigins.get(key)??new Set<string>();origins.add(url.origin);manufacturerOrigins.set(key,origins);
  if(/\/products\/[a-z\d]+(?:-[a-z\d]+)*\/?$/.test(url.pathname)){const roots=storeRoots.get(key)??new Set<string>();roots.add(url.origin);storeRoots.set(key,roots);}
 }catch{/* Only reviewed HTTPS official links establish an issuer. */}
}
const formats=Object.entries(identity.suffixes).flatMap(([code,names])=>names.map(name=>({code,name}))).sort((a,b)=>b.name.length-a.name.length);
const concentrations=new Map<string,Set<string>>();
for(const row of [...catalogProfiles,...publicEditions]){
 const key=catalogIdentityKey({...row,name:noYear(row.name)});if(!key)continue;
 const [brand,name]=JSON.parse(key),base=JSON.stringify([brand,name]),codes=concentrations.get(base)??new Set<string>();codes.add(row.concentration);concentrations.set(base,codes);
}
function decode(value:string){return value.replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:x[\da-f]+|\d+);/gi,entity=>{
 const named:Record<string,string>={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '};
 if(named[entity.toLowerCase()])return named[entity.toLowerCase()];
 const code=/^&#x/i.test(entity)?parseInt(entity.slice(3,-1),16):Number(entity.slice(2,-1));return code>0&&code<=0x10ffff?String.fromCodePoint(code):'';
});}
const attributes=(tag:string)=>new Map([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(([,name,a,b,c])=>[name.toLowerCase(),decode(a??b??c)]));

function officialUrl(value:string,edition:CatalogEdition){
 try{const url=new URL(decode(value));
  if(url.protocol!=='https:'||url.username||url.password||url.hash||url.port||!manufacturerOrigins.get(house(edition.brand))?.has(url.origin)||
   url.pathname==='/'||/%(?:2f|5c|2e)/i.test(url.pathname)||/\/(?:account|admin|login|checkout|cart|apps|api)(?:\/|$)/i.test(url.pathname))return null;
  return url;
 }catch{return null;}
}
function canonical(value:string){const url=new URL(value);url.search='';url.hash='';return url.href.replace(/\.js$/,'').replace(/\/$/,'');}
function assetUrl(value:string,source:URL,edition:CatalogEdition){
 try{
  const url=new URL(decode(value),source);if(url.protocol==='http:'&&(url.hostname===source.hostname||url.hostname==='cdn.shopify.com'))url.protocol='https:';
  if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||/%(?:2f|5c|2e)/i.test(url.pathname)||! /\.(?:jpe?g|png|webp)$/i.test(url.pathname))return null;
  const own=url.origin===source.origin;
  const shopify=url.hostname==='cdn.shopify.com'&&/^\/s\/files\/1\/(?:\d+\/){2,3}(?:files|products)\//.test(url.pathname);
  const cdn=['images.ctfassets.net','images.prismic.io','cdn.media.amplience.net'].includes(url.hostname);
  const brandCdn=house(edition.brand)==='carolina herrera'&&url.origin==='https://medias.carolinaherrera.com'&&url.pathname.startsWith('/medias/sys_master/images/');
  if(!own&&!shopify&&!cdn&&!brandCdn)return null;
  const query=new URLSearchParams();for(const key of ['v','width','height','sw','sh','quality','sm','sfrm']){const value=url.searchParams.get(key);if(value&&/^[a-z\d_.-]{1,30}$/i.test(value))query.set(key,value);}
  url.search=query.toString();if(own&&url.pathname.startsWith('/cdn/shop/')||shopify)url.searchParams.set('width','1200');
  return url.href;
 }catch{return null;}
}
function concentration(value:string){
 const label=normalize(value);
 return formats.find(({name})=>label===name||label.endsWith(' '+name)||label.startsWith(name+' ')||label.includes(' '+name+' '))?.code;
}
function productMatches(edition:CatalogEdition,product:Product,pageTitle:string){
 if(unsuitable.test(product.name))return false;
 if(product.brand&&normalize(product.brand)!=='vendor unknown'&&house(product.brand)!==house(edition.brand))return false;
 const profile=findCatalogProfile(edition) as (ReturnType<typeof findCatalogProfile>&{aliases?:string[]});
 const keys=new Set([edition.name,...(profile?.aliases??[])].map(name=>catalogIdentityKey({...edition,name:noYear(name)})));
 let clean=noSize(noYear(product.name));
 if(house(edition.brand)==='al haramain')clean=clean.replace(/^Haramain\b/i,'Al Haramain');
 const names=[clean,clean.replace(/\s+(?:spray|for men|for women|for him|for her|unisex)$/i,'')];
 if(!names.some(name=>keys.has(catalogIdentityKey({...edition,name}))))return false;
 const requiredYear=Number(edition.name.match(/\((\d{4})\)/)?.[1]);
 if(requiredYear){const year=Number(product.name.match(/\((\d{4})\)/)?.[1]??product.releaseDate?.slice(0,4));if(year!==requiredYear)return false;}
 const category=concentration(product.category??'');
 const explicit=category??concentration(product.name.replace(/\bLe Parfum\b/gi,edition.concentration==='EDP'?'':'Le Parfum'));
 const title=pageTitle&&keys.has(catalogIdentityKey({...edition,name:noSize(noYear(pageTitle.replace(/\s*[|–—]\s*.*$/,'')))}))?concentration(pageTitle):undefined;
 const code=explicit??title??concentration(text(product.description??'').slice(0,350));
 if(code)return code===edition.concentration;
 const key=catalogIdentityKey({...edition,name:noYear(edition.name)}),[brand,name]=key?JSON.parse(key):[];
 return !!profile?.notes.length&&concentrations.get(JSON.stringify([brand,name]))?.size===1;
}
function imageRows(value:unknown):{src:string;alt?:string}[]{
 return (Array.isArray(value)?value:[value]).flatMap(row=>typeof row==='string'?[{src:row}]:row&&typeof row==='object'&&typeof row.url==='string'?[{src:row.url,alt:row.caption}]:[]);
}

export function manufacturerImageCandidates(edition:CatalogEdition,input:string,source:string):PhotoSet|null {
 const page=officialUrl(source,edition);if(!page)return null;
 let roots:any[]=[],pageTitle='',mainHeading='',pageCanonical=false,htmlImages:Product['images']=[];
 const trimmed=input.trim();
 if(trimmed.startsWith('{')||trimmed.startsWith('[')){try{const value=JSON.parse(input);roots=Array.isArray(value)?value:[value];}catch{return null;}}
 else{
  pageTitle=text(input.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]??'');
  const canon=[...input.matchAll(/<link\b[^>]*>/gi)].map(([tag])=>attributes(tag)).find(row=>row.get('rel')==='canonical')?.get('href');
  if(canon&&canonical(canon)!==canonical(source))return null;
  pageCanonical=!!canon;
  mainHeading=text(input.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]??'');
  htmlImages=[...input.matchAll(/<img\b[^>]*>/gi)].slice(0,300).map(([tag])=>attributes(tag)).filter(row=>row.get('src')&&row.get('alt')).map(row=>({src:row.get('src')!,alt:row.get('alt')!}));
  for(const [,raw] of input.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))try{const value=JSON.parse(raw);roots.push(...(Array.isArray(value)?value:[value]));}catch{/* Invalid schema cannot establish a product. */}
 }
 const products:Product[]=[];
 for(const root of roots.slice(0,100)){
  if(root?.title&&root?.handle){
   if(!/^[a-z\d]+(?:-[a-z\d]+)*$/.test(root.handle)||!page.pathname.replace(/\/$/,'').endsWith('/products/'+root.handle))continue;
   const variants=Array.isArray(root.variants)?root.variants:[];
   const codes=new Set(variants.map((row:any)=>concentration(row.title??'')).filter(Boolean));
   if(codes.size>1||codes.size===1&&!codes.has(edition.concentration))continue;
   const images=(Array.isArray(root.media)?root.media:[]).filter((row:any)=>row.media_type==='image'&&typeof row.src==='string').map((row:any)=>({src:row.src,alt:row.alt??'',main:row.src===root.featured_image}));
   if(!images.length)images.push(...imageRows([root.featured_image,...(Array.isArray(root.images)?root.images:[])]).map(row=>({...row,main:row.src===root.featured_image})));
   products.push({name:root.title,brand:root.vendor,description:root.description,category:root.type,url:source,images});continue;
  }
  const rows=[root,...(Array.isArray(root?.['@graph'])?root['@graph']:[])];
  for(const row of rows.slice(0,100))if(['Product','ProductGroup'].includes(row?.['@type'])){
   for(const product of [row,...(Array.isArray(row.hasVariant)?row.hasVariant:[])].slice(0,100)){
    if(typeof product.name!=='string')continue;
    let brand=typeof product.brand==='string'?product.brand:product.brand?.name;
    // This storefront emits its locale as Brand; its issuer URL must still match.
    if(house(edition.brand)==='jo malone london'&&brand==='United Kingdom  - English'&&product.brand?.url===page.origin+'/')brand=edition.brand;
    products.push({name:product.name,brand,description:product.description??row.description,category:product.category,url:product.url,releaseDate:product.releaseDate,
     images:imageRows(product.image).map((image,index)=>({...image,main:index===0}))});
   }
  }
 }
 if(pageCanonical&&pageTitle&&mainHeading&&
  productMatches(edition,{name:pageTitle.replace(/\s*[|–—]\s*.*$/,''),images:[]},'')&&
  productMatches(edition,{name:mainHeading,description:pageTitle,images:[]},pageTitle)){
  const images=htmlImages.filter(image=>productMatches(edition,{name:image.alt!,description:pageTitle,images:[]},pageTitle));
  if(images.length)products.push({name:mainHeading,description:pageTitle,url:source,images});
 }
 const candidates=new Map<string,Candidate>();
 for(const product of products){
  if(product.url){try{if(canonical(product.url)!==canonical(source))continue;}catch{continue;}}
  if(!productMatches(edition,product,pageTitle))continue;
  for(const image of product.images.slice(0,30)){
   const url=assetUrl(image.src,page,edition);if(!url)continue;
   const label=normalize((image.alt??'')+' '+decodeURIComponent(new URL(url).pathname.split('/').at(-1)!));
   if(alternateView.test(label)||unsuitable.test(label))continue;
   const priority=Number(frontView.test(label))*4+Number(image.main)*2;
   candidates.set(url,{imageUrl:url,priority:Math.max(priority,candidates.get(url)?.priority??0)});
  }
 }
 return candidates.size?{sourceUrl:canonical(source),publisher:edition.brand+' (official)',candidates:[...candidates.values()].sort((a,b)=>b.priority-a.priority).slice(0,6)}:null;
}

export function createManufacturerPhotoFinder(request:typeof fetch=fetch,options:{timeoutMs?:number}={}){
 const claims=new Map<string,string>();
 return async(edition:CatalogEdition):Promise<ManufacturerPhoto|null>=>{
  const profile=findCatalogProfile(edition),known=(manufacturerImages as Record<string,{sourceUrl:string}>)[profile?.id??edition.id];
  const pages=[known?.sourceUrl,...(profile?.sources.filter(source=>source.kind==='house').map(source=>source.url)??[])].filter((url):url is string=>!!url&&!!officialUrl(url,edition));
  const signal=AbortSignal.timeout(options.timeoutMs??6500);
  async function read(input:string,image=false){
   let url=input;
   for(let redirects=0;redirects<3;redirects++){
    const response=await request(url,{signal,redirect:'manual',credentials:'omit',cache:'no-store',headers:{Accept:image?'image/jpeg, image/png, image/webp':'text/html, application/json','User-Agent':agent}});
    if(!image&&[301,302,307,308].includes(response.status)){
     const location=response.headers.get('location');await response.body?.cancel();if(!location)return null;
     const next=officialUrl(new URL(location,url).href,edition);if(!next)return null;url=next.href;continue;
    }
    const mime=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()??'';
    if(!response.ok||response.redirected||!(image?/^image\/(?:jpeg|png|webp)$/:/^(?:text\/html|application\/json|text\/javascript)$/).test(mime)){await response.body?.cancel();return null;}
    const bytes=await readLimitedBody(response,image?6_000_000:2_000_000);return bytes?{bytes,mime,url}:null;
   }
   return null;
  }
  try{
   if(!pages.length){
    for(const origin of [...(storeRoots.get(house(edition.brand))??[])].slice(0,2)){
     const url=new URL('/search/suggest.json',origin);url.search=new URLSearchParams({q:noYear(edition.name),'resources[type]':'product','resources[limit]':'8'}).toString();
     const response=await read(url.href);if(!response)continue;
     const results=JSON.parse(response.bytes.toString('utf8'))?.resources?.results?.products;
     if(Array.isArray(results))for(const row of results.slice(0,8))if(typeof row.handle==='string'&&/^[a-z\d]+(?:-[a-z\d]+)*$/.test(row.handle))pages.push(origin+'/products/'+row.handle);
    }
   }
   for(const source of [...new Set(pages)].slice(0,2)){
    const url=new URL(source),shopify=/\/products\/[a-z\d]+(?:-[a-z\d]+)*\/?$/.test(url.pathname);
    let set:PhotoSet|null=null;
    for(const target of shopify?[source.replace(/\/$/,'')+'.js',source]:[source]){
     const page=await read(target);if(!page)continue;
     set=manufacturerImageCandidates(edition,page.bytes.toString('utf8'),page.url.replace(/\.js$/,''));if(set)break;
    }
    if(!set)continue;
    for(const candidate of set.candidates.slice(0,4)){
     try{
     const image=await read(candidate.imageUrl,true);if(!image)continue;
     const photo=sharp(image.bytes,{limitInputPixels:16_000_000,failOn:'error'}).autoOrient(),metadata=await photo.metadata();
     const types:Record<string,string>={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'};
     if(metadata.format!==types[image.mime]||(metadata.pages??1)>1||!metadata.width||!metadata.height||Math.min(metadata.width,metadata.height)<350||Math.max(metadata.width,metadata.height)>4000)continue;
     if(!await looksLikePackshot(photo,true))continue;
     const bytes=await photo.flatten({background:'#fff'}).resize(900,900,{fit:'inside',withoutEnlargement:true}).jpeg({quality:86}).toBuffer();if(bytes.length>650_000)continue;
     const hash=createHash('sha256').update(bytes).digest('hex'),id=profile?.id??edition.id;
     if(Object.entries({...parfumoImages,...manufacturerImages}).some(([other,row])=>other!==id&&(row as {imageHash?:string}).imageHash===hash))continue;
     if(claims.has(hash)&&claims.get(hash)!==id)continue;
     if(!claims.has(hash)&&claims.size>=512)claims.delete(claims.keys().next().value!);
     claims.set(hash,id);
     return {bytes,sourceUrl:set.sourceUrl,imageUrl:candidate.imageUrl,publisher:set.publisher};
     }catch{/* A broken gallery asset does not hide another validated bottle shot. */}
    }
   }
  }catch{/* An unavailable or uncertain official image falls through to retailers. */}
  return null;
 };
}
const defaultFinder=createManufacturerPhotoFinder();
export const findManufacturerCatalogPhoto=(edition:CatalogEdition,request:typeof fetch=fetch)=>request===fetch?defaultFinder(edition):createManufacturerPhotoFinder(request)(edition);
