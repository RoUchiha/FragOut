import {createHash} from 'node:crypto';
import {z} from 'zod';
import {readLimitedBody} from './catalog-http.ts';
import {downloadCatalogPhoto,reviewedImageByteLimit,reviewedImagePixelLimit} from './catalog-image.ts';
import type {CatalogEdition,CatalogSource,RemoteCatalogThumbnail} from './types.ts';

const commons='https://commons.wikimedia.org';
const uploads='https://upload.wikimedia.org';
const previews='https://thumb.wikimedia.org';
const fileName=/^File:[^|/\\\u0000-\u001f]{1,230}\.(?:jpe?g|png|webp)$/i;
const field=z.object({value:z.string().max(8000)});
const imageInfo=z.object({
 sha1:z.string().regex(/^[0-9a-f]{40}$/),url:z.string().max(1000),thumburl:z.string().max(1000).optional(),
 size:z.number().int().positive(),width:z.number().int().positive(),height:z.number().int().positive(),
 mime:z.enum(['image/jpeg','image/png','image/webp']),
 extmetadata:z.object({Artist:field,LicenseUrl:field,ImageDescription:field.optional(),Restrictions:field.optional()}),
});
const pages=z.object({query:z.object({pages:z.array(z.object({
 title:z.string(),imageinfo:z.array(z.unknown()).optional(),
})).max(10)}).optional()});
type CommonsCandidate={file:string;asset:string;preview?:string;sha1:string;bytes:number;width:number;height:number;
 description:string;source:CatalogSource};
export type ReviewedCommonsPhoto={file:string;sha1:string;view:'front'|'front-angle';caption:string;licenseUrl:string;
 preview?:{sha256:string;bytes:number}};

function userAgent() {
 const contact=process.env.FRAGOUT_WIKIMEDIA_CONTACT?.trim();
 return contact&&/^[\x21-\x7e]{1,160}$/.test(contact)?
  'FragOutCatalog/0.1 ('+contact+')':'FragOutCatalog/0.1 (fragrance catalog photo lookup)';
}

function text(value:string,limit:number) {
 return value.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"')
  .replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim().slice(0,limit);
}

function commonsLicense(value:string):{name:string;url:string}|null {
 const match=/^https?:\/\/creativecommons\.org\/licenses\/(by|by-sa)\/(2\.0|2\.5|3\.0|4\.0)\/?$/.exec(value.trim());
 if(match) return {name:'CC '+match[1].toUpperCase()+' '+match[2],url:'https://creativecommons.org/licenses/'+match[1]+'/'+match[2]+'/'};
 return /^https?:\/\/creativecommons\.org\/publicdomain\/zero\/1\.0\/?$/.test(value.trim())?
  {name:'CC0 1.0',url:'https://creativecommons.org/publicdomain/zero/1.0/'}:null;
}

function previewAsset(value:string|undefined,name:string,directory:string) {
 if(!value) return undefined;
 try {
  const url=new URL(value);
  if(![uploads,previews].includes(url.origin)||url.username||url.password||url.hash) return undefined;
  const path=decodeURIComponent(url.pathname);
  const prefix='/wikipedia/commons/thumb/'+directory[0]+'/'+directory+'/'+name+'/';
  if(!path.startsWith(prefix)) return undefined;
  const variant=/^([1-9]\d{2,3})px-(.+)$/.exec(path.slice(prefix.length));
  if(!variant||Number(variant[1])>1280||variant[2]!==name) return undefined;
  url.search='';
  return url.href;
 } catch {
  return undefined;
 }
}

function parseCandidate(file:string,raw:unknown):CommonsCandidate|null {
 if(file!==file.trim()||!fileName.test(file)) return null;
 const checked=imageInfo.safeParse(raw);
 if(!checked.success) return null;
 const data=checked.data;
 const license=commonsLicense(data.extmetadata.LicenseUrl.value);
 const credit=text(data.extmetadata.Artist.value,180);
 if(!license||!credit||data.extmetadata.Restrictions?.value.trim()||
  data.size>reviewedImageByteLimit||data.width*data.height>reviewedImagePixelLimit||
  Math.min(data.width,data.height)<160) return null;
 const name=file.slice(5).replaceAll(' ','_');
 const directory=createHash('md5').update(name).digest('hex').slice(0,2);
 try {
  const asset=new URL(data.url);
  if(asset.origin!==uploads||asset.username||asset.password||asset.hash||
   decodeURIComponent(asset.pathname)!=='/wikipedia/commons/'+directory[0]+'/'+directory+'/'+name) return null;
  asset.search='';
  return {file,asset:asset.href,preview:previewAsset(data.thumburl,name,directory),
   sha1:data.sha1,bytes:data.size,width:data.width,height:data.height,
   description:text(data.extmetadata.ImageDescription?.value??'',320),
   source:{id:'wikimedia-thumbnail',publisher:'Wikimedia Commons',kind:'photo',
    url:commons+'/wiki/File:'+encodeURIComponent(name),credit,license}};
 } catch {
  return null;
 }
}

async function queryCommons(params:Record<string,string>,request:typeof fetch):Promise<CommonsCandidate[]> {
 const url=new URL(commons+'/w/api.php');
 url.search=new URLSearchParams({action:'query',format:'json',formatversion:'2',maxlag:'5',prop:'imageinfo',
  iiprop:'url|sha1|size|mime|extmetadata',iiurlwidth:'640',
  iiextmetadatafilter:'Artist|LicenseUrl|Restrictions|ImageDescription',...params}).toString();
 const response=await request(url,{headers:{accept:'application/json','user-agent':userAgent()},
  redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(4500)});
 if(!response.ok||response.redirected) {
  await response.body?.cancel();
  throw new Error('Wikimedia request failed ('+response.status+').');
 }
 const bytes=await readLimitedBody(response,512*1024);
 if(!bytes) throw new Error('Wikimedia response is missing or exceeds the size limit.');
 const payload=JSON.parse(bytes.toString('utf8'));
 if(payload?.error) throw new Error('Wikimedia could not complete the request.');
 const result=pages.parse(payload);
 return (result.query?.pages??[]).flatMap(page=>{
  const candidate=parseCandidate(page.title,page.imageinfo?.[0]);
  return candidate?[candidate]:[];
 });
}

export async function discoverCommonsPhotos(edition:CatalogEdition,request:typeof fetch=fetch) {
 const terms=[edition.brand,edition.name].map(term=>'"'+term.replace(/["\\]/g,'').trim().slice(0,90)+'"');
 return queryCommons({generator:'search',gsrnamespace:'6',gsrlimit:'8',gsrsearch:terms.join(' ')},request);
}

export async function readCommonsPhoto(file:string,request:typeof fetch=fetch):Promise<CommonsCandidate|null> {
 if(file!==file.trim()||!fileName.test(file)) return null;
 return (await queryCommons({titles:file},request)).find(candidate=>candidate.file===file)??null;
}

export async function downloadReviewedCommonsPhoto(review:ReviewedCommonsPhoto,request:typeof fetch=fetch):Promise<RemoteCatalogThumbnail|null> {
 const candidate=await readCommonsPhoto(review.file,request);
 if(!candidate||candidate.sha1!==review.sha1||candidate.source.license?.url!==review.licenseUrl) return null;
 const url=review.preview?candidate.preview:candidate.asset;
 if(!url) return null;
 const uri=await downloadCatalogPhoto(url,request,review.preview?
  {algorithm:'sha256',digest:review.preview.sha256,bytes:review.preview.bytes,userAgent:userAgent()}:
  {algorithm:'sha1',digest:candidate.sha1,bytes:candidate.bytes,userAgent:userAgent()});
 return uri?{uri,caption:review.caption,
  source:{...candidate.source,credit:candidate.source.credit+' · Resized for FragDex'}}:null;
}
