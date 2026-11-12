import sharp,{type Sharp} from 'sharp';
import {z} from 'zod';
import identity from '../../catalog/identity.json' with {type:'json'};
import publicEditions from '../../catalog/thumbnail-editions.json' with {type:'json'};
import {catalogIdentityKey,catalogProfiles} from './catalog.ts';
import {readLimitedBody} from './catalog-http.ts';
import type {CatalogEdition} from './types.ts';

const shops=[
 {origin:'https://www.myperfumeshop.com.au',publisher:'My Perfume Shop',account:'0388/7287/5140',types:['Perfume & Cologne'],queryBrand:true},
 {origin:'https://bluemercury.com',publisher:'Bluemercury',account:'0283/0185/2747',types:['Perfumes','Colognes'],queryBrand:false},
 {origin:'https://perfumeonline.ca',publisher:'PerfumeOnline.ca',account:'2170/5343',types:['Men','Women','Unisex'],queryBrand:false},
];
type Shop=(typeof shops)[number];
type Photo={bytes:Buffer;sourceUrl:string;imageUrl:string;publisher:string};
const markers=Object.entries(identity.suffixes).flatMap(([code,names])=>names.map(name=>({code,name})))
 .sort((a,b)=>b.name.length-a.name.length);
const specificMarkers=markers.filter(({name})=>/^(?:ed[ctp]|eau de |extrait de |perfume oil$)/.test(name));
const imageConcentration=new RegExp('\\b(?:'+specificMarkers.map(({name})=>name).join('|')+')\\b','g');
const yearInName=/\s*\(((?:19|20)\d{2})\)/;
const unavailableTitle=/\b(?:tester|sample|vial|miniature|travel(?: size| spray)?|decant|discovery|gift set|bundle|refill|unboxed|deodorant|after shave|body lotion)\b/i;
const alternateView=/\b(?:back (?:view|of|label)|side (?:view|of)|rear|profile view|top view|bottom view|barcode|close[- ]up|cap detail|packaging|box(?:ed)?|carton|bottles|tester|sample|vial|refill|gift set|lifestyle)\b/i;
const frontDetail=/\b(?:front|label|embossed|lettering|logo|reading|reads|text)\b/i;
const marketingGender=/\s+for (?:m[ae]n|wom[ae]n|him|her|unisex)$/i;
const amountPattern=/\b(\d{1,3}(?:\.\d{1,2})?)\s*(ml|(?:fl\.?\s*)?oz\.?)\b/i;
const imageFormats:Record<string,string>={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'};
const imageType=/^image\/(?:jpeg|png|webp)$/;
const listingSchema=z.object({
 handle:z.string().max(150).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
 title:z.string().min(1).max(220),vendor:z.string().min(1).max(150),
});
const searchSchema=z.object({resources:z.object({results:z.object({products:z.array(z.unknown()).max(12)})})});
const assetSchema=z.string().max(1500).nullish();
const productSchema=listingSchema.extend({
 type:z.string().max(100),
 variants:z.array(z.object({title:z.string().max(200),featured_image:z.object({src:assetSchema}).nullish()})).max(150),
 featured_image:assetSchema,
 media:z.array(z.object({media_type:z.string(),src:assetSchema,alt:z.string().max(600).nullish()})).max(75),
});
type Product=z.infer<typeof productSchema>;

function labelWithoutYear(name:string) {
 return name.replace(yearInName,' ').replace(/\s+/g,' ').trim();
}

const catalogYears=new Map<string,Set<number>>();
for(const edition of [...catalogProfiles,...publicEditions]) {
 const year=edition.releaseYear??Number(edition.name.match(yearInName)?.[1]);
 if(!year) continue;
 const key=catalogIdentityKey({...edition,name:labelWithoutYear(edition.name)});
 if(!key) continue;
 const years=catalogYears.get(key)??new Set<number>();
 years.add(year);
 catalogYears.set(key,years);
}

function formatWords(text:string) {
 return text.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
}

function endingConcentration(title:string) {
 const label=formatWords(title);
 return markers.find(({name})=>label===name||label.endsWith(' '+name))?.code;
}

function exactListing(edition:CatalogEdition,requiredYear:number|undefined,keys:readonly string[],listing:z.infer<typeof listingSchema>) {
 if(unavailableTitle.test(listing.title)) return null;
 const year=Number(listing.title.match(yearInName)?.[1]);
 if(requiredYear?year!==requiredYear:year&&year!==edition.releaseYear) return null;
 let title=labelWithoutYear(listing.title);
 const withoutGender=title.replace(marketingGender,'');
 if(endingConcentration(withoutGender)) title=withoutGender;
 const concentration=endingConcentration(title);
 if(concentration&&concentration!==edition.concentration) return null;
 const key=catalogIdentityKey({brand:listing.vendor,name:title,concentration:edition.concentration});
 return key&&keys.includes(key)?{concentration}:null;
}

function retailVariant(title:string,listingConcentration:string|undefined) {
 const amount=title.match(amountPattern);
 if(!amount) return null;
 const ml=Number(amount[1])*(amount[2].toLowerCase()==='ml'?1:29.5735);
 if(ml<29||ml>300) return null;
 const label=formatWords(title.replace(amount[0],'')).replace(/(?:^|\s)(?:boxed|sealed|refillable)$/,'').trim();
 const concentration=label?markers.find(marker=>marker.name===label)?.code:listingConcentration;
 // An empty label is a retail size even if its concentration is unconfirmed.
 return !label||concentration?{concentration}:null;
}

function imageAsset(raw:string|null|undefined,shop:Shop) {
 if(!raw) return null;
 try {
  const url=new URL(raw,shop.origin);
  if(url.protocol!=='https:'||url.username||url.password||url.port||/%(?:2f|5c)/i.test(url.pathname)) return null;
  const prefix=url.origin===shop.origin?'/cdn/shop/':url.origin==='https://cdn.shopify.com'?'/s/files/1/'+shop.account+'/':null;
  if(!prefix||!url.pathname.startsWith(prefix)||!/^(?:files|products)\/[^/]+\.(?:jpe?g|png|webp)$/i.test(url.pathname.slice(prefix.length))) return null;
  const version=url.searchParams.get('v');
  url.search=version&&/^\d{1,15}$/.test(version)?'?v='+version:'';
  url.hash='';
  return url;
 } catch { return null; }
}

function imageKey(url:URL|null) {
 // Storefront and Shopify CDN URLs can address the same variant image.
 return url?.pathname.split('/').slice(-2).join('/');
}

function productPhotos(shop:Shop,product:Product,expected:string,listingConcentration:string|undefined) {
 const variants=product.variants.map(row=>({retail:retailVariant(row.title,listingConcentration),image:imageKey(imageAsset(row.featured_image?.src,shop))}));
 if(!variants.some(v=>v.retail?.concentration===expected)) return [];
 const mixed=variants.some(v=>v.retail&&v.retail.concentration!==expected);
 const hero=imageKey(imageAsset(product.featured_image,shop));
 return product.media.flatMap(row=>{
  if(row.media_type!=='image') return [];
  const url=imageAsset(row.src,shop);
  if(!url) return [];
  const label=formatWords((row.alt??'')+' '+decodeURIComponent(url.pathname.split('/').at(-1)!));
  if(alternateView.test(label)||[...label.matchAll(imageConcentration)].some(([name])=>specificMarkers.some(marker=>marker.name===name&&marker.code!==expected))) return [];
  const key=imageKey(url);
  const associated=variants.filter(v=>v.image===key);
  const retail=associated.some(v=>v.retail?.concentration===expected);
  if(associated.some(v=>v.retail&&v.retail.concentration!==expected)||!retail&&(associated.length||mixed)) return [];
  const detailed=/\bbottle\b/i.test(row.alt??'')&&frontDetail.test(row.alt??'');
  const featured=hero===key;
  if(!detailed&&!featured&&!retail) return [];
  const imageUrl=url.href;
  url.searchParams.set('width','1000');
  return [{url,imageUrl,detailed,priority:Number(detailed)*4+Number(featured)*2+Number(retail)}];
 });
}

async function readResponse(request:typeof fetch,url:URL,signal:AbortSignal,type:RegExp,limit:number) {
 const response=await request(url,{signal,redirect:'error',credentials:'omit',cache:'no-store',headers:{Accept:type===imageType?'image/jpeg, image/png, image/webp':'application/json'}});
 const mime=response.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()??'';
 if(!response.ok||response.redirected||!type.test(mime)) {
  await response.body?.cancel();
  return null;
 }
 const bytes=await readLimitedBody(response,limit);
 return bytes?{bytes,mime}:null;
}

async function readJson(request:typeof fetch,url:URL,signal:AbortSignal):Promise<unknown> {
 // Shopify serves the product .js endpoint as JavaScript MIME, with a JSON body.
 const mime=url.pathname.endsWith('.js')?/^(?:application\/json|text\/javascript)$/:/^application\/json$/;
 const response=await readResponse(request,url,signal,mime,512*1024);
 return response?JSON.parse(response.bytes.toString('utf8')):null;
}

// An isolated retail hero should show one centered object with a narrower cap or
// neck. Generic captions need a transparent cutout as additional evidence.
async function looksLikePackshot(photo:Sharp,detailed:boolean) {
 const side=64;
 const pixels=await photo.clone().resize(side,side,{fit:'fill'}).toColourspace('srgb').ensureAlpha().raw().toBuffer();
 let transparent=0;
 for(let offset=3;offset<pixels.length;offset+=4) if(pixels[offset]<25) transparent++;
 const cutout=transparent>=side*side*0.35;
 if(!detailed&&!cutout) return false;
 const rows=new Uint8Array(side);
 const columns=new Uint8Array(side);
 let top=side,bottom=-1,left=side,right=-1;
 for(let y=0;y<side;y++) {
  let first=side,last=-1;
  for(let x=0;x<side;x++) {
   const offset=4*(y*side+x);
   const alpha=pixels[offset+3];
   const foreground=cutout?alpha>=120:(255-Math.min(pixels[offset],pixels[offset+1],pixels[offset+2]))*alpha>=27*255;
   if(!foreground) continue;
   first=Math.min(first,x);
   last=x;
   columns[x]++;
  }
  if(last<0) continue;
  rows[y]=last-first+1;
  top=Math.min(top,y);
  bottom=y;
  left=Math.min(left,first);
  right=Math.max(right,last);
 }
 const height=bottom-top+1;
 const width=right-left+1;
 if(top<2||left<2||bottom>side-3||right>side-3||height<22||width<8||width>50||Math.abs(left+right-side+1)>15) return false;
 const subject=[rows.slice(top,bottom+1),columns.slice(left,right+1)];
 if(subject.some(axis=>axis.some((count,i)=>!count&&!axis[i+1]))) return false;
 const upperRows=rows.slice(top+1,top+1+Math.max(4,Math.round(height*0.1))).sort();
 const cap=upperRows[Math.floor((upperRows.length-1)/2)];
 const body=Math.max(...rows.slice(top+Math.round(height*0.35),top+Math.round(height*0.72)));
 return cap>=2&&cap<=body*(detailed?0.94:0.83);
}

async function fetchPhoto(request:typeof fetch,url:URL,detailed:boolean,signal:AbortSignal) {
 const input=await readResponse(request,url,signal,imageType,4*1024*1024);
 if(!input||signal.aborted) return null;
 const photo=sharp(input.bytes,{limitInputPixels:10_000_000}).autoOrient();
 const info=await photo.metadata();
 const {width,height}=info.autoOrient;
 if(info.format!==imageFormats[input.mime]||(info.pages??1)>1||Math.min(width,height)<350||Math.max(width,height)>4000||
  width>height*1.5||height>width*2.5) return null;
 if(!(await looksLikePackshot(photo,detailed))) return null;
 return photo.flatten({background:'#fff'}).resize(900,900,{fit:'inside',withoutEnlargement:true}).jpeg({quality:84}).toBuffer();
}

async function searchShop(
 shop:Shop,edition:CatalogEdition,requiredYear:number|undefined,keys:readonly string[],request:typeof fetch,signal:AbortSignal,
) {
 try {
  const url=new URL('/search/suggest.json',shop.origin);
  url.search=new URLSearchParams({
   q:[shop.queryBrand?edition.brand:'',labelWithoutYear(edition.name)].filter(Boolean).join(' '),
   'resources[type]':'product','resources[limit]':'10','resources[options][fields]':'title,vendor,variants.title',
  }).toString();
  const search=searchSchema.safeParse(await readJson(request,url,signal));
  if(!search.success) return null;
  const handles=new Set<string>();
  for(const raw of search.data.resources.results.products) {
   const listing=listingSchema.safeParse(raw);
   if(listing.success&&exactListing(edition,requiredYear,keys,listing.data)) handles.add(listing.data.handle);
  }
  const listings=await Promise.all([...handles].slice(0,2).map(async handle=>{
   const productPage=new URL('/products/'+handle,shop.origin);
   const data=await readJson(request,new URL(productPage.href+'.js'),signal).catch(()=>null);
   const product=productSchema.safeParse(data);
   if(!product.success||product.data.handle!==handle||!shop.types.includes(product.data.type)) return [];
   const exact=exactListing(edition,requiredYear,keys,product.data);
   return exact?productPhotos(shop,product.data,edition.concentration,exact.concentration)
    .map(candidate=>({...candidate,sourceUrl:productPage.href})):[];
  }));
  const candidates=listings.flat().sort((a,b)=>b.priority-a.priority);
  for(const {url,imageUrl,detailed,priority,sourceUrl} of candidates.slice(0,3)) {
   if(signal.aborted) break;
   const bytes=await fetchPhoto(request,url,detailed,signal).catch(()=>null);
   if(bytes) return {bytes,sourceUrl,imageUrl,publisher:shop.publisher,priority};
  }
  return null;
 } catch { return null; }
}

export async function findAutomaticCatalogPhoto(edition:CatalogEdition,request:typeof fetch=fetch):Promise<Photo|null> {
 const key=catalogIdentityKey({...edition,name:labelWithoutYear(edition.name)});
 if(!key) return null;
 const namedYear=Number(edition.name.match(yearInName)?.[1]);
 const ambiguousYear=(catalogYears.get(key)?.size??0)>1;
 const requiredYear=namedYear||(ambiguousYear?edition.releaseYear:undefined);
 if(ambiguousYear&&!requiredYear) return null;
 const keys=[key];
 if(edition.id==='scento:versace-the-dreamer-toilette') {
  const alias=catalogIdentityKey({...edition,name:'The Dreamer'});
  if(alias) keys.push(alias);
 }
 const signal=AbortSignal.timeout(6000);
 const photos=await Promise.all(shops.map(shop=>searchShop(shop,edition,requiredYear,keys,request,signal)));
 const best=photos.filter(photo=>photo!==null).sort((a,b)=>b.priority-a.priority)[0];
 if(!best) return null;
 const {bytes,sourceUrl,imageUrl,publisher}=best;
 return {bytes,sourceUrl,imageUrl,publisher};
}
