import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bottleImageSearchUrl,discoverProductPhotos} from '../scripts/catalog-photo-discovery.ts';

test('photo search includes the exact concentration and edition year',()=>{
 const edition={id:'ysl-la-nuit-2026',brand:'Yves Saint Laurent',name:"La Nuit de L’Homme (2026)",concentration:'EDP'};
 const search=new URL(bottleImageSearchUrl(edition));
 assert.equal(search.origin,'https://www.google.com');
 assert.equal(search.searchParams.get('udm'),'2');
 assert.match(search.searchParams.get('q')??'',/2026\) Eau de Parfum perfume bottle front/);
 const other=bottleImageSearchUrl({...edition,concentration:'EDT'});
 assert.notEqual(other,search.href);
});

test('discovery stages original HTTPS product metadata without downloading any image',async()=>{
 const page='https://maker.example.com/products/bottle';
 let calls=0;
 const request:typeof fetch=async (url,options)=>{
  calls++;
  assert.equal(url,page);
  assert.equal(options?.credentials,'omit');
  assert.equal(options?.redirect,'error');
  return new Response(`
   <meta content="/images/bottle.jpg?width=800&amp;v=2" property="og:image">
   <meta name="twitter:image" content='/images/bottle.jpg?width=800&amp;v=2'>
   <meta property="og:image" content="http://maker.example.com/insecure.jpg">
   <meta property="og:image" content="https://127.0.0.1/private">
   <meta property="og:image" content="https://username:password@maker.example.com/bottle.jpg">
   <meta property="og:image:secure_url" content="//cdn.example.com/bottle.png">
  `,{headers:{'content-type':'text/html; charset=utf-8'}});
 };
 assert.deepEqual(await discoverProductPhotos(page,request),[
  {source:page,imageUrl:'https://maker.example.com/images/bottle.jpg?width=800&v=2'},
  {source:page,imageUrl:'https://cdn.example.com/bottle.png'},
 ]);
 assert.deepEqual(await discoverProductPhotos('http://127.0.0.1/',request),[]);
 assert.equal(calls,1);
});

test('blocked or oversized product pages fall back to the search link',async()=>{
 const page='https://maker.example.com/products/bottle';
 assert.deepEqual(await discoverProductPhotos(page,async()=>new Response(null,{status:403})),[]);
 assert.deepEqual(await discoverProductPhotos(page,async()=>new Response('<meta>',{
  headers:{'content-type':'text/html','content-length':'9000000'},
 })),[]);
});
