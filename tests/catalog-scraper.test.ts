import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {findThumbnailEdition} from '../src/lib/catalog.ts';
import {discoverCommonsPhotos,readCommonsPhoto,downloadReviewedCommonsPhoto} from '../src/lib/catalog-commons.ts';
import {createWebThumbnailLookup,hasWebThumbnail} from '../src/lib/catalog-web-thumbnails.ts';
import {retryAfterDelay} from '../src/lib/catalog-http.ts';

const edition=findThumbnailEdition({brand:'Bvlgari',name:'Aqva Pour Homme',concentration:'EDT'})!;
const file='File:Bvlgari AQVA.jpg';
const asset='https://upload.wikimedia.org/wikipedia/commons/4/48/Bvlgari_AQVA.jpg';
const licenseUrl='https://creativecommons.org/licenses/by-sa/4.0/';
const picture=await sharp({create:{width:320,height:320,channels:3,background:'#eaeaea'}})
 .composite([{input:{create:{width:140,height:230,channels:3,background:'#245155'}},gravity:'centre'}]).jpeg().toBuffer();
const revision=createHash('sha1').update(picture).digest('hex');
const imageinfo={sha1:revision,url:asset+'?utm_source=commons.wikimedia.org',size:picture.length,width:320,height:320,mime:'image/jpeg',
 extmetadata:{Artist:{value:'<a href="https://example.test/artist">Example Artist</a>'},
  LicenseUrl:{value:licenseUrl.slice(0,-1)},LicenseShortName:{value:'CC BY-SA 4.0'},
  ImageDescription:{value:'Bvlgari AQVA pour Homme Eau de Toilette bottle.'},Restrictions:{value:''}}};
const apiResult=(value:unknown=imageinfo,title=file)=>Response.json({query:{pages:[{title,imageinfo:[value]}]}});

test('Wikimedia discovery returns credited review candidates using the public edition only',async()=>{
 const request:typeof fetch=async input=>{
  const url=new URL(String(input));
  assert.equal(url.origin,'https://commons.wikimedia.org');
  assert.equal(url.searchParams.get('gsrnamespace'),'6');
  assert.match(url.searchParams.get('gsrsearch')??'',/Bvlgari.*Aqva Pour Homme/);
  return apiResult();
 };
 const [candidate]=await discoverCommonsPhotos(edition,request);
 assert.equal(candidate.file,file);
 assert.equal(candidate.sha1,revision);
 assert.equal(candidate.source.credit,'Example Artist');
 assert.equal(candidate.source.license?.url,licenseUrl);
 assert.equal(candidate.asset,asset);
 assert.ok(hasWebThumbnail(edition));
});

test('the scraper checks the approved file revision and serves a sanitized image without credentials',async()=>{
 const seen:URL[]=[];
 const request:typeof fetch=async (input,init)=>{
  const url=new URL(String(input));seen.push(url);
  assert.equal(init?.redirect,'error');
  assert.equal(init?.credentials,'omit');
  assert.equal(new Headers(init?.headers).has('authorization'),false);
  if(url.hostname==='commons.wikimedia.org')return apiResult();
  assert.equal(url.href,asset);
  return new Response(new Uint8Array(picture),{headers:{'content-type':'image/jpeg'}});
 };
 const photo=await downloadReviewedCommonsPhoto({file,sha1:revision,view:'front',caption:'AQVA Pour Homme',licenseUrl},request);
 assert.equal(seen.length,2);
 assert.match(photo?.uri??'',/^data:image\/jpeg;base64,/);
 assert.equal(photo?.source.publisher,'Wikimedia Commons');
 assert.equal(photo?.source.license?.url,licenseUrl);
 assert.match(photo?.source.credit??'',/Example Artist.*resized/i);
});

test('legacy Creative Commons links are shown with the same license on HTTPS',async()=>{
 const older={...imageinfo,extmetadata:{...imageinfo.extmetadata,
  LicenseUrl:{value:'http://creativecommons.org/licenses/by-sa/3.0/'}}};
 const candidate=await readCommonsPhoto(file,async()=>apiResult(older));
 assert.equal(candidate?.source.license?.url,'https://creativecommons.org/licenses/by-sa/3.0/');
});

test('smaller previews are bound to the reviewed file and their own fingerprint',async()=>{
 const preview='https://thumb.wikimedia.org/wikipedia/commons/thumb/4/48/Bvlgari_AQVA.jpg/960px-Bvlgari_AQVA.jpg';
 const review={file,sha1:revision,view:'front' as const,caption:'AQVA',licenseUrl,
  preview:{sha256:createHash('sha256').update(picture).digest('hex'),bytes:picture.length}};
 let downloaded=0;
 const fetchPreview:typeof fetch=async input=>{
  const url=new URL(String(input));
  if(url.hostname==='commons.wikimedia.org') {
   assert.equal(url.searchParams.get('iiurlwidth'),'640');
   return apiResult({...imageinfo,thumburl:preview});
  }
  assert.equal(url.href,preview);
  downloaded++;
  return new Response(new Uint8Array(picture),{headers:{'content-type':'image/jpeg'}});
 };
 assert.ok(await downloadReviewedCommonsPhoto(review,fetchPreview));
 assert.equal(downloaded,1);
 assert.equal(await downloadReviewedCommonsPhoto({...review,preview:{...review.preview,sha256:'a'.repeat(64)}},fetchPreview),null);
 const malicious:typeof fetch=async input=>{
  assert.equal(new URL(String(input)).hostname,'commons.wikimedia.org');
  return apiResult({...imageinfo,thumburl:preview.replace('960px-Bvlgari_AQVA.jpg','960px-Different.jpg')});
 };
 assert.equal(await downloadReviewedCommonsPhoto(review,malicious),null);
});

test('a Wikimedia throttle pauses other web lookups before another network request',async()=>{
 let requests=0;
 const lookup=createWebThumbnailLookup(async()=>{
  requests++;
  return new Response(null,{status:429,headers:{'retry-after':'120'}});
 });
 const other=findThumbnailEdition({brand:'Prada',name:'Paradoxe',concentration:'EDP'})!;
 assert.equal(await lookup(edition,()=>true),null);
 assert.equal(await lookup(other,()=>true),null);
 assert.equal(requests,1);
});

test('the scraper honors both forms of Retry-After and uses a pause if the header is absent',()=>{
 assert.equal(retryAfterDelay('120'),120_000);
 const now=Date.parse('2026-11-09T12:00:00Z');
 assert.equal(retryAfterDelay('Mon, 09 Nov 2026 12:03:00 GMT',now),180_000);
 assert.equal(retryAfterDelay(null,now),60_000);
});

test('Wikimedia metadata cannot swap the approved image, redirect it or substitute an unlicensed file',async()=>{
 for(const value of [
  {...imageinfo,url:'http://127.0.0.1/private.jpg'},
  {...imageinfo,url:asset.replace('Bvlgari_AQVA.jpg','different.jpg')},
  {...imageinfo,url:'https://upload.wikimedia.org.evil.test/wikipedia/commons/4/48/Bvlgari_AQVA.jpg'},
  {...imageinfo,extmetadata:{...imageinfo.extmetadata,LicenseUrl:{value:'https://creativecommons.org/licenses/by-nc/4.0/'}}},
  {...imageinfo,extmetadata:{...imageinfo.extmetadata,Restrictions:{value:'third-party copyright'}}},
 ]) assert.equal(await readCommonsPhoto(file,async()=>apiResult(value)),null);
 let calls=0;
 const badRevision:typeof fetch=async()=>{calls++;return apiResult({...imageinfo,sha1:'a'.repeat(40)});};
 assert.equal(await downloadReviewedCommonsPhoto({file,sha1:revision,view:'front',caption:'AQVA',licenseUrl},badRevision),null);
 assert.equal(calls,1);
 const changedBytes:typeof fetch=async input=>String(input).startsWith('https://commons.wikimedia.org')?
  apiResult():new Response(new Uint8Array(Buffer.concat([picture,Buffer.from('!')])),{headers:{'content-type':'image/jpeg'}});
 assert.equal(await downloadReviewedCommonsPhoto({file,sha1:revision,view:'front',caption:'AQVA',licenseUrl},changedBytes),null);
});
