import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {catalogProfiles,findCatalogProfile,findThumbnailEdition} from '../src/lib/catalog.ts';
import {createFragellaThumbnailLookup} from '../src/lib/catalog-thumbnail.ts';
import {isCatalogThumbnailDataUri} from '../src/lib/catalog-photos.ts';

const fixture={_id:'sauvage-edp',Name:'Sauvage Eau de Parfum',Brand:'Christian Dior',
 OilType:'Eau de Parfum',Year:'2018','Image URL':'https://cdn.fragella.com/images/sauvage-edp.jpg',
 'Image URL Transparent':'https://cdn.fragella.com/images/sauvage-edp.webp'};
const edition=findCatalogProfile({brand:'Dior',name:'Sauvage',concentration:'EDP'})!;
const photo=()=>sharp({
 create:{width:256,height:320,channels:3,background:'#eaeaea'},
}).composite([{input:{create:{width:112,height:216,channels:3,background:'#29384a'}},gravity:'centre'}])
 .jpeg().toBuffer();

test('thumbnail lookups use public exact identities and reject unknown or ambiguous labels',()=>{
 assert.equal(findThumbnailEdition({brand:'chRistian Dior',name:'Sauvage EDP',concentration:'EDP'})?.id,edition.id);
 const outside=findThumbnailEdition({brand:'Christian Dior',name:'Fahrenheit EDT',concentration:'EDT'});
 assert.ok(outside);
 assert.equal(outside.brand,'Dior');
 assert.equal(outside.id,'scento:dior-fahrenheit-toilette');
 assert.equal(findThumbnailEdition({brand:'Dior',name:'Sauvage',concentration:'UNKNOWN'}),null);
 assert.equal(findThumbnailEdition({brand:'YSL',name:"La Nuit de L'Homme",concentration:'EDP'}),null);
 assert.equal(findThumbnailEdition({brand:'My private house',name:'My custom blend',concentration:'EDP'}),null);
});

test('the exact CDN image falls back from a failed cover and caches the decoded JPEG briefly',async()=>{
 const jpeg=await photo();
 const calls:{url:URL;options?:RequestInit}[]=[];
 const lookup=createFragellaThumbnailLookup(async (input,options)=>{
  const url=new URL(String(input));
  calls.push({url,options});
  if(url.hostname==='api.fragella.com')return Response.json([fixture]);
  if(url.pathname.endsWith('.jpg'))return new Response(null,{status:404});
  return new Response(new Uint8Array(jpeg),{headers:{'content-type':'image/jpeg'}});
 });
 const results=await Promise.all(Array.from({length:8},()=>lookup(edition,'server-fixture-key')));
 assert.ok(results.every(result=>result?.uri===results[0]?.uri));
 assert.equal(calls.length,3);
 const thumbnail=results[0]!;
 assert.match(thumbnail.uri,/^data:image\/jpeg;base64,/);
 assert.ok(isCatalogThumbnailDataUri(thumbnail.uri));
 assert.equal(thumbnail.source.kind,'photo');
 assert.equal(await lookup(edition,'server-fixture-key',()=>false),thumbnail);
 const metadata=await sharp(Buffer.from(thumbnail.uri.split(',')[1],'base64')).metadata();
 assert.equal(metadata.format,'jpeg');
 assert.equal(metadata.exif,undefined);
 assert.equal(calls[0].url.searchParams.get('search'),'Dior Sauvage EDP');
 assert.equal(new Headers(calls[0].options?.headers).get('x-api-key'),'server-fixture-key');
 assert.ok(calls.slice(1).every(call=>call.url.origin==='https://cdn.fragella.com'&&call.options?.redirect==='error'
  &&!new Headers(call.options?.headers).has('x-api-key')));
});

test('the thumbnail client accepts JPEG data and never requests external URLs',()=>{
 for(const uri of ['https://cdn.fragella.com/images/anything.jpg','data:image/svg+xml;base64,PHN2Zw==',
  'data:image/jpeg;base64,AAAA','data:image/jpeg;base64,/9j/+===','data:image/jpeg;base64,/9j/+/A=\n']) {
  assert.equal(isCatalogThumbnailDataUri(uri),false);
 }
});

test('wrong editions, duplicate matches, unsafe URLs and invalid bytes never supply a thumbnail',async()=>{
 for(const rows of [
  [{...fixture,OilType:'Eau de Toilette'}],[{...fixture,Year:'2015'}],
  [fixture,{...fixture,_id:'another-edition'}],
  [{...fixture,'Image URL':'https://cdn.fragella.com.evil.example/images/a.jpg',
   'Image URL Transparent':'https://cdn.fragella.com/images/placeholder.webp'}],
  [{...fixture,'Image URL':'https://cdn.fragella.com/images/%2e%2e/secret.jpg','Image URL Transparent':undefined}],
  [{...fixture,'Image URL':undefined,'Image URL Transparent':'https://cdn.fragella.com/images/sauvage-edt.webp'}],
 ]) {
  let downloads=0;
  const lookup=createFragellaThumbnailLookup(async input=>{
   if(new URL(String(input)).hostname==='api.fragella.com')return Response.json(rows);
   downloads++;
   return new Response('unexpected');
  });
  assert.equal(await lookup(edition,'fixture-key'),null);
  assert.equal(downloads,0);
 }
 const corrupt=createFragellaThumbnailLookup(async input=>new URL(String(input)).hostname==='api.fragella.com'?
  Response.json([fixture]):new Response('<svg onload="alert(1)"/>',{headers:{'content-type':'image/jpeg'}}));
 assert.equal(await corrupt(edition,'fixture-key'),null);
 const large=createFragellaThumbnailLookup(async input=>new URL(String(input)).hostname==='api.fragella.com'?
  Response.json([fixture]):new Response('truncated',{headers:{'content-type':'image/jpeg','content-length':'3000000'}}));
 assert.equal(await large(edition,'fixture-key'),null);
 const blank=await sharp({create:{width:256,height:320,channels:3,background:'white'}}).jpeg().toBuffer();
 const empty=createFragellaThumbnailLookup(async input=>new URL(String(input)).hostname==='api.fragella.com'?
  Response.json([fixture]):new Response(new Uint8Array(blank),{headers:{'content-type':'image/jpeg'}}));
 assert.equal(await empty(edition,'fixture-key'),null);
});

test('all bundled thumbnails are real decodable, metadata-free JPEGs',async()=>{
 const paths=catalogProfiles.flatMap(profile=>[profile.photo,...(profile.additionalPhotos??[])])
  .filter(photo=>photo!==undefined);
 assert.ok(paths.length>25);
 for(const {path} of paths) {
  const jpeg=sharp(fileURLToPath(new URL('../public'+path,import.meta.url)));
  const meta=await jpeg.metadata();
  assert.equal(meta.format,'jpeg',path);
  assert.ok(meta.width>=160&&meta.height>=160&&meta.width<=1000&&meta.height<=1000,path);
  assert.equal(meta.exif,undefined,path);
  await jpeg.raw().toBuffer();
 }
});
