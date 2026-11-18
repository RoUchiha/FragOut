import assert from 'node:assert/strict';
import {test} from 'node:test';
import sharp from 'sharp';
import {createManufacturerPhotoFinder,manufacturerImageCandidates} from '../src/lib/manufacturer-photo.ts';
import {findAutomaticCatalogPhoto} from '../src/lib/catalog-photo-selector.ts';
import type {CatalogEdition} from '../src/lib/types.ts';

const edition:CatalogEdition={id:'tauer-perfumes-lonestar-memories-edt',brand:'Tauer Perfumes',name:'Lonestar Memories',concentration:'EDT',releaseYear:2006};
const source='https://tauerperfumes.com/products/lonestar-memories',front='https://tauerperfumes.com/cdn/shop/files/lonestar-front.png';
const frontSized=front+'?width=1200';
const bottle='<rect x="350" y="230" width="300" height="580" rx="40" fill="#263e67"/><rect x="435" y="110" width="130" height="140" fill="#141414"/>';
const box='<rect x="350" y="110" width="300" height="700" fill="#263e67"/>';
const image=(shape=bottle)=>sharp(Buffer.from('<svg width="1000" height="1000">'+shape+'</svg>')).withMetadata({exif:{IFD0:{Artist:'Synthetic photographer'}}}).png().toBuffer();
const product=(patch:Record<string,unknown>={})=>({handle:'lonestar-memories',title:'Lonestar Memories',vendor:'Tauer Perfumes',type:'Eau de Toilette',description:'A smoky leather eau de toilette.',variants:[{title:'50ml'}],featured_image:front,
 media:[{media_type:'image',src:front,alt:'Lonestar Memories front bottle'}],...patch});
function fixture(row:ReturnType<typeof product>,assets:Record<string,Buffer>,responses:Record<string,Response>={}){
 const calls:URL[]=[];
 const request:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));calls.push(url);assert.equal(init?.credentials,'omit');
  if(responses[url.href])return responses[url.href];
  if(url.href===source+'.js')return new Response(JSON.stringify(row),{headers:{'content-type':'text/javascript'}});
  if(assets[url.pathname.split('/').at(-1)!])return new Response(new Uint8Array(assets[url.pathname.split('/').at(-1)!]),{headers:{'content-type':'image/png'}});
  return new Response(null,{status:404});
 };
 return {request,calls};
}

test('official manufacturer is selected after Parfumo and before any retailer',async()=>{
 const h=fixture(product(),{'lonestar-front.png':await image()});
 const result=await findAutomaticCatalogPhoto(edition,h.request);
 assert.equal(result?.publisher,'Tauer Perfumes (official)');assert.equal(result?.sourceUrl,source);
 assert.ok(h.calls.some(url=>url.hostname==='www.parfumo.com'));
 assert.ok(h.calls.findIndex(url=>url.hostname==='www.parfumo.com')<h.calls.findIndex(url=>url.hostname==='tauerperfumes.com'));
 assert.ok(!h.calls.some(url=>/myperfumeshop|bluemercury|perfumeonline/.test(url.hostname)));
});
test('the official provider rejects other releases, concentrations, samples and box-only images',async()=>{
 for(const patch of [{title:'Lonestar Memories Intense'},{type:'Eau de Parfum'},{title:'Lonestar Memories 2ml Sample'},{title:'Lonestar Memories Gift Set'}]){
  const h=fixture(product(patch),{'lonestar-front.png':await image()});assert.equal(await createManufacturerPhotoFinder(h.request)(edition),null,JSON.stringify(patch));
 }
 const h=fixture(product(),{'lonestar-front.png':await image(box)});assert.equal(await createManufacturerPhotoFinder(h.request)(edition),null);
});
test('front photos outrank and replace overhead, box, back and lifestyle gallery candidates',async()=>{
 const rows=['overhead','box','back','lifestyle','front'].map(view=>({media_type:'image',src:'https://tauerperfumes.com/cdn/shop/files/lonestar-'+view+'.png',alt:'Lonestar Memories '+view}));
 const h=fixture(product({featured_image:rows[0].src,media:rows}),{'lonestar-front.png':await image()});
 const result=await createManufacturerPhotoFinder(h.request)(edition);assert.equal(result?.imageUrl,frontSized);
 assert.ok(!h.calls.some(url=>/overhead|back|box|lifestyle/.test(url.pathname)));
 const metadata=await sharp(result!.bytes).metadata();assert.equal(metadata.exif,undefined);assert.equal(metadata.format,'jpeg');
});
test('structured official product data ignores recommendation products and unsafe image URLs',()=>{
 const html=`<link rel="canonical" href="${source}"><script type="application/ld+json">${JSON.stringify([{'@type':'Product',name:'Another Perfume Eau de Toilette',image:'https://evil.example/product.jpg'},
  {'@type':'Product',url:source,name:'Lonestar Memories Eau de Toilette',brand:{name:'Tauer Perfumes'},image:[front,'http://127.0.0.1/private.jpg','https://evil.example/product.jpg']}])}</script>`;
 const result=manufacturerImageCandidates(edition,html,source);
 assert.equal(result?.candidates.length,1);assert.equal(result?.candidates[0].imageUrl,frontSized);
 assert.equal(manufacturerImageCandidates(edition,html,'https://evil.example/products/lonestar-memories'),null);
});
test('manufacturer redirects cannot leave the approved origin and image bodies remain bounded',async()=>{
 const h=fixture(product(),{}, {[source+'.js']:new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}})});
 assert.equal(await createManufacturerPhotoFinder(h.request)(edition),null);assert.ok(h.calls.every(url=>url.hostname==='tauerperfumes.com'));
 for(const response of [new Response('not an image',{headers:{'content-type':'text/html'}}),new Response('x',{headers:{'content-type':'image/png','content-length':'9000000'}})]){
  const h=fixture(product(),{}, {[frontSized]:response});assert.equal(await createManufacturerPhotoFinder(h.request)(edition),null);
  assert.ok(h.calls.some(url=>url.href===frontSized));
 }
});
test('a named edition cannot borrow an official page for a different release year',()=>{
 const named={...edition,name:'Lonestar Memories (2026)',releaseYear:2026};
 const html=`<script type="application/ld+json">${JSON.stringify({'@type':'Product',name:'Lonestar Memories Eau de Toilette',releaseDate:'2006-01-01',image:front})}</script>`;
 assert.equal(manufacturerImageCandidates(named,html,source),null);
});

test('a corrupt first gallery image does not hide the next valid front shot',async()=>{
 const broken=front.replace('front','front-corrupt');
 const h=fixture(product({featured_image:broken,media:[{media_type:'image',src:broken,alt:'Front bottle'},{media_type:'image',src:front,alt:'Front bottle'}]}),{'lonestar-front.png':await image(),'lonestar-front-corrupt.png':Buffer.from('invalid PNG')});
 assert.equal((await createManufacturerPhotoFinder(h.request)(edition))?.imageUrl,frontSized);
});

test('gallery fallback considers all images and excludes marketing graphics and rear shots',()=>{
 const labels=['back','routine','olfactorymap','front'];
 const row=product({media:[],featured_image:front.replace('front','back'),images:labels.map(view=>front.replace('front',view))});
 const result=manufacturerImageCandidates(edition,JSON.stringify(row),source);
 assert.deepEqual(result?.candidates.map(row=>row.imageUrl),[frontSized]);
});

test('new unbundled editions discover exact products only on the reviewed official storefront',async()=>{
 const fresh={...edition,id:'tauer-new-fragrance-edt',name:'New Fragrance'},calls:string[]=[];
 const request:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));calls.push(url.href);assert.equal(init?.credentials,'omit');
  if(url.pathname==='/search/suggest.json')return Response.json({resources:{results:{products:[{handle:'new-fragrance'},{handle:'../../private'}]}}});
  if(url.pathname==='/products/new-fragrance.js')return Response.json(product({handle:'new-fragrance',title:'New Fragrance',media:[{media_type:'image',src:front,alt:'Front bottle'}]}));
  if(url.pathname===new URL(front).pathname)return new Response(new Uint8Array(await image()),{headers:{'content-type':'image/png'}});
  return new Response(null,{status:404});
 };
 assert.equal((await createManufacturerPhotoFinder(request)(fresh))?.publisher,'Tauer Perfumes (official)');
 assert.ok(calls.some(url=>url.includes('q=New+Fragrance')));assert.ok(calls.every(url=>new URL(url).hostname==='tauerperfumes.com'));
});

test('two different editions cannot claim identical official image bytes in one finder',async()=>{
 const bytes=await image(),h=fixture(product(),{'lonestar-front.png':bytes});
 const request:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));
  if(url.pathname==='/search/suggest.json')return Response.json({resources:{results:{products:[{handle:'new-fragrance'}]}}});
  if(url.pathname==='/products/new-fragrance.js')return Response.json(product({handle:'new-fragrance',title:'New Fragrance'}));
  return h.request(input,init);
 };
 const find=createManufacturerPhotoFinder(request);
 assert.ok(await find(edition));assert.ok(await find(edition));
 assert.ok(!await find({...edition,id:'tauer-new-fragrance-edt',name:'New Fragrance'}));
});

test('official house labels and reviewed manufacturer CDN paths retain exact identity',()=>{
 const al={...edition,id:'al-haramain-amber-oud-gold-edition-edp',brand:'Al Haramain',name:'Amber Oud Gold Edition',concentration:'EDP' as const};
 const alUrl='https://shop.alharamainperfumes.com/default/haramain-amber-oud-gold-edition-75ml-eau-de-parfum.html';
 const html=`<script type="application/ld+json">${JSON.stringify({'@type':'Product',name:'Haramain Amber Oud Gold Edition, 75ml, Eau de Parfum',brand:{name:'Al Haramain Perfumes'},image:'https://shop.alharamainperfumes.com/media/catalog/product/amber-oud-gold-solo.jpg'})}</script>`;
 assert.equal(manufacturerImageCandidates(al,html,alUrl)?.candidates.length,1);
 const ch={...edition,id:'carolina-herrera-212-vip-edp',brand:'Carolina Herrera',name:'212 VIP',concentration:'EDP' as const};
 const chUrl='https://www.carolinaherrera.com/ww/en/p-fragrance/212-vip',cdn='https://medias.carolinaherrera.com/medias/sys_master/images/h48/h5d/10969404702750/10969404637214/10969404637214.jpg';
 const data=JSON.stringify({'@type':'Product',name:'212 VIP 30ml Eau de Parfum',brand:{name:'Carolina Herrera'},image:[cdn,'https://medias.carolinaherrera.com/private/bottle.jpg','https://res.cloudinary.com/someone-else/image/upload/bottle.jpg']});
 assert.deepEqual(manufacturerImageCandidates(ch,data,chUrl)?.candidates.map(row=>row.imageUrl),[cdn]);
});

test('a manufacturer without JSON-LD needs exact page identity and product image alt text',()=>{
 const nr={...edition,id:'narciso-rodriguez-for-her-edp',brand:'Narciso Rodriguez',name:'For Her Eau de Parfum',concentration:'EDP' as const},url='https://www.narcisorodriguezparfums.com/en/narciso-rodriguez-for-her/for-her-edp.html';
 const html=`<link rel="canonical" href="${url}"><title>Narciso Rodriguez for Her Eau de Parfum</title><h1>for her</h1><img src="/bottle.png" alt="for her eau de parfum"><img src="/other.png" alt="for her pure musc"><img src="/unlabeled.png">`;
 assert.deepEqual(manufacturerImageCandidates(nr,html,url)?.candidates.map(row=>row.imageUrl),['https://www.narcisorodriguezparfums.com/bottle.png']);
 assert.equal(manufacturerImageCandidates({...nr,concentration:'EDT'},html,url),null);
 assert.equal(manufacturerImageCandidates(nr,html.replace('<h1>for her</h1>','<h1>for her musc noir</h1>'),url),null);
});

test('a locale label is recognized only on the verified Jo Malone brand object',()=>{
 const jm={...edition,id:'jo-malone-london-earl-grey-and-cucumber-edc',brand:'Jo Malone London',name:'Earl Grey & Cucumber',concentration:'EDC' as const},url='https://www.jomalone.co.uk/product/25946/15968/colognes/earl-grey-cucumber-cologne';
 const row={'@type':'Product',name:'Earl Grey & Cucumber Cologne',brand:{name:'United Kingdom  - English',url:'https://www.jomalone.co.uk/'},image:'https://www.jomalone.co.uk/bottle.png'};
 assert.equal(manufacturerImageCandidates(jm,JSON.stringify(row),url)?.candidates.length,1);
 assert.equal(manufacturerImageCandidates(jm,JSON.stringify({...row,brand:{...row.brand,url:'https://evil.example/'}}),url),null);
});
