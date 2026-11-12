import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {findAutomaticCatalogPhoto} from '../src/lib/catalog-photo-selector.ts';
import type {CatalogEdition} from '../src/lib/types.ts';

const shop='https://www.myperfumeshop.com.au';
const cdn='https://cdn.shopify.com/s/files/1/0388/7287/5140/files/';
const handle='dior-fahrenheit-edt';
const fahrenheit:CatalogEdition={id:'scento:dior-fahrenheit-toilette',brand:'Dior',name:'Fahrenheit',concentration:'EDT'};
const bottle='<path fill="#862823" d="M365 260q0-70 65-95h140q65 25 65 95v455q0 40-40 40H405q-40 0-40-40Z"/><rect fill="#191919" x="445" y="96" width="110" height="88" rx="10"/>';
const carton='<rect fill="#862823" x="350" y="96" width="300" height="659" rx="3"/>';

function image(shape:string) {
 return sharp(Buffer.from('<svg width="1000" height="1000">'+shape+'</svg>'))
  .withMetadata({exif:{IFD0:{Artist:'Public product photographer'}}}).png().toBuffer();
}

function product(overrides:Record<string,unknown>={}) {
 return {
  id:12550115,handle,title:'Christian Dior Fahrenheit Eau de Toilette For Men',vendor:'Christian Dior',type:'Perfume & Cologne',
  featured_image:cdn+'fahrenheit.png',media:[{media_type:'image',src:cdn+'fahrenheit.png',alt:'Dior Fahrenheit EDT | My Perfume Shop',width:1000,height:1000}],
  variants:[{title:'50ml',featured_image:{src:cdn+'fahrenheit.png'}},{title:'100ml Tester'}],
  ...overrides,
 };
}

function fixture(row:ReturnType<typeof product>,assets:Record<string,Uint8Array>={},badResponses:Record<string,Response>={}) {
 const requested:URL[]=[];
 const request:typeof fetch=async (input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input));
  requested.push(url);
  assert.equal(init?.redirect,'error');
  assert.equal(init?.credentials,'omit');
  if(url.origin===shop&&url.pathname==='/search/suggest.json') {
   return Response.json({resources:{results:{products:[{title:row.title,vendor:row.vendor,handle:row.handle}]}}});
  }
  if(url.origin===shop&&url.pathname==='/products/'+row.handle+'.js') {
   return new Response(JSON.stringify(row),{headers:{'content-type':'text/javascript; charset=utf-8'}});
  }
  const file=url.pathname.split('/').at(-1)!;
  if(badResponses[file]) return badResponses[file];
  return assets[file]?new Response(Uint8Array.from(assets[file]),{headers:{'content-type':'image/png'}}):new Response(null,{status:404});
 };
 return {request,requested};
}

test('selects a credited full-size exact-release hero and encodes a metadata-free JPEG',async()=>{
 const {request}=fixture(product(),{'fahrenheit.png':await image(bottle)});
 const photo=await findAutomaticCatalogPhoto(fahrenheit,request);
 assert.equal(photo?.sourceUrl,shop+'/products/dior-fahrenheit-edt');
 assert.equal(photo?.publisher,'My Perfume Shop');
 assert.equal(photo?.imageUrl,cdn+'fahrenheit.png');
 const metadata=await sharp(photo!.bytes).metadata();
 assert.equal(metadata.format,'jpeg');
 assert.equal(metadata.width,900);
 assert.equal(metadata.exif,undefined);
 assert.equal(metadata.hasAlpha,false);
});

test('keeps the Dreamer alias specific to Versace and accepts the verified regular size',async()=>{
 const edition:CatalogEdition={id:'scento:versace-the-dreamer-toilette',brand:'Versace',name:'Dreamer',concentration:'EDT'};
 const row=product({
  handle:'versace-the-dreamer-edt-for-men',title:'Versace The Dreamer EDT For Men',vendor:'Versace',
  variants:[{title:'100ml'},{title:'100ml Tester'}],
 });
 const {request}=fixture(row,{'fahrenheit.png':await image(bottle)});
 assert.equal((await findAutomaticCatalogPhoto(edition,request))?.sourceUrl,shop+'/products/versace-the-dreamer-edt-for-men');
});

test('abstains on other houses, flankers, concentrations and non-retail listings',async()=>{
 const bytes=await image(bottle);
 for(const changes of [
  {vendor:'Another House'},
  {title:'Dior Fahrenheit Aqua EDT'},
  {title:'Dior Fahrenheit Parfum'},
  {title:'Dior Fahrenheit EDP For Men'},
  {title:'Dior Fahrenheit EDT Gift Set'},
  {variants:[{title:'100ml Tester'},{title:'10ml Travel Spray'},{title:'5ml Sample Vial'}]},
  {variants:[{title:'100ml EDT + 15ml mini'}]},
  {variants:[{title:'100ml EDT',featured_image:{src:cdn+'fahrenheit.png'}},{title:'100ml EDP',featured_image:{src:cdn+'fahrenheit.png'}}]},
  {variants:[{title:'100ml EDT'},{title:'100ml EDT Tester',featured_image:{src:shop+'/cdn/shop/files/fahrenheit.png'}}]},
  {media:[{media_type:'image',src:cdn+'fahrenheit.png',alt:'Front of the Dior Fahrenheit Eau de Parfum bottle with a gold label'}]},
 ]) {
  const {request,requested}=fixture(product(changes),{'fahrenheit.png':bytes});
  assert.equal((await findAutomaticCatalogPhoto(fahrenheit,request))?.imageUrl,undefined,JSON.stringify(changes));
  assert.ok(!requested.some(url=>url.hostname==='cdn.shopify.com'),JSON.stringify(changes));
 }
});

test('requires a matching explicitly distinguished release year',async()=>{
 const edition:CatalogEdition={id:'edition-2026',brand:'Yves Saint Laurent',name:"La Nuit de L’Homme (2026)",concentration:'EDP'};
 const bytes=await image(bottle);
 const fields={
  vendor:'Yves Saint Laurent',handle:'la-nuit-de-lhomme-edp',featured_image:cdn+'la-nuit.png',
  media:[{media_type:'image',src:cdn+'la-nuit.png',alt:"Yves Saint Laurent La Nuit de L'Homme Eau de Parfum"}],
  variants:[{title:'60ml',featured_image:{src:cdn+'la-nuit.png'}}],
 };
 for(const title of ["Yves Saint Laurent La Nuit de L'Homme EDP", "Yves Saint Laurent La Nuit de L'Homme (2019) EDP"]) {
  const {request}=fixture(product({...fields,title}),{'la-nuit.png':bytes});
  assert.equal(await findAutomaticCatalogPhoto(edition,request),null,title);
 }
 const {request}=fixture(product({...fields,title:"Yves Saint Laurent La Nuit de L'Homme Eau de Parfum (2026)"}),{'la-nuit.png':bytes});
 assert.ok(await findAutomaticCatalogPhoto(edition,request));
});

test('passes over a carton hero and explicit back view in favor of a labeled bottle-front image',async()=>{
 const row=product({
  media:[
   {media_type:'image',src:cdn+'fahrenheit.png',alt:'Dior Fahrenheit EDT | My Perfume Shop'},
   {media_type:'image',src:cdn+'back.png',alt:'Back view of the Dior Fahrenheit bottle with barcode label'},
   {media_type:'image',src:cdn+'front.png',alt:'Front of a Dior Fahrenheit bottle with the Fahrenheit label'},
  ],
 });
 const {request,requested}=fixture(row,{'fahrenheit.png':await image(carton),'back.png':await image(bottle),'front.png':await image(bottle)});
 const photo=await findAutomaticCatalogPhoto(fahrenheit,request);
 assert.equal(photo?.imageUrl,cdn+'front.png');
 assert.ok(requested.some(url=>url.pathname.endsWith('/front.png')));
 assert.ok(!requested.some(url=>url.pathname.endsWith('/back.png')));
 const onlyCarton=fixture(product(),{'fahrenheit.png':await image(carton)});
 assert.equal(await findAutomaticCatalogPhoto(fahrenheit,onlyCarton.request),null);
});

test('uses the transparent outline to distinguish a short cap from artwork printed on a carton',async()=>{
 const shortCap='<rect fill="#191919" x="450" y="200" width="100" height="47" rx="4"/>'+
  '<rect fill="#292323" x="350" y="247" width="300" height="510" rx="5"/>';
 const eligible=fixture(product(),{'fahrenheit.png':await image(shortCap)});
 assert.ok(await findAutomaticCatalogPhoto(fahrenheit,eligible.request));
 const printedCarton='<rect fill="white" x="350" y="85" width="300" height="680"/>'+bottle;
 const ineligible=fixture(product(),{'fahrenheit.png':await image(printedCarton)});
 assert.equal((await findAutomaticCatalogPhoto(fahrenheit,ineligible.request))?.imageUrl,undefined);
});

test('rejects disallowed CDN accounts, redirects, oversized and non-image bodies',async()=>{
 const foreign='https://cdn.shopify.com/s/files/1/1111/1111/1111/files/fahrenheit.png';
 const untrusted=fixture(product({featured_image:foreign,media:[{media_type:'image',src:foreign,alt:'Bottle front label'}]}),
  {'fahrenheit.png':await image(bottle)});
 assert.equal(await findAutomaticCatalogPhoto(fahrenheit,untrusted.request),null);
 assert.ok(!untrusted.requested.some(url=>url.hostname==='cdn.shopify.com'));
 for(const response of [
  Response.redirect('https://example.com/redirect.png'),
  new Response(await image(bottle),{headers:{'content-type':'image/png','content-length':String(10*1024*1024)}}),
  new Response('not a PNG',{headers:{'content-type':'image/png'}}),
 ]) {
  const {request}=fixture(product(),{}, {'fahrenheit.png':response});
  assert.equal(await findAutomaticCatalogPhoto(fahrenheit,request),null);
 }
});
