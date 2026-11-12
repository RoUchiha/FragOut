import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findCatalogProfile} from '../src/lib/catalog.ts';
import {createFragellaLookup,pickFragellaRatings} from '../src/lib/fragella.ts';

const target=findCatalogProfile({brand:'Dior',name:'Sauvage',concentration:'EDP'})!;
const fixture={_id:'Sauvage-Eau-De-Parfum',Name:'Dior Sauvage Eau de Parfum',Brand:'Christian Dior',
 OilType:'Eau de Parfum',Year:'2018',rating:'4.23',Confidence:'high',Popularity:'Very high'};

test('Fragella uses the source rating and URL only for a single exact voted edition',()=>{
 assert.equal(target.releaseYear,2018);
 const hit=pickFragellaRatings(target,[{...fixture,_id:'Sauvage',Name:'Sauvage',OilType:'Eau de Toilette'},fixture]);
 assert.equal(hit?.ratings[0].score,4.23);
 assert.equal(hit?.ratings[0].kind,'published');
 assert.equal(hit?.source.url,'https://app.fragella.com/fragrance/Sauvage-Eau-De-Parfum');
 assert.equal(pickFragellaRatings(target,[{...fixture,_id:'OtherYear',Year:'2015'},fixture])?.ratings[0].score,4.23);
 for(const response of [
  [{...fixture,OilType:'Eau de Toilette'}],[{...fixture,OilType:''}],[fixture,fixture],
  [fixture,{...fixture,Name:'Different product'}],[{...fixture,Popularity:'Not popular'}],
  [{...fixture,Confidence:'low'}],[{...fixture,rating:'6'}],[{...fixture,_id:'../other'}],
  [{...fixture,Year:'2015'}],
 ]) assert.equal(pickFragellaRatings(target,response),null);
 assert.equal(pickFragellaRatings({...target,releaseYear:undefined},[fixture]),null);
 const bands=pickFragellaRatings(target,[{...fixture,Longevity:'Long Lasting',Sillage:'Strong','Price Value':'unknown'}]);
 assert.deepEqual(bands?.ratings.slice(1).map(({facet,score,kind})=>[facet,score,kind]),[
  ['longevity',4,'estimate'],['projection',4,'estimate'],
 ]);
});

test('configured lookups use only public catalog identity and keep the key on a fixed API origin',async()=>{
 const requests:{url:URL;options?:RequestInit}[]=[];
 const lookup=createFragellaLookup(async (url,options)=>{
  requests.push({url:new URL(String(url)),options});
  return Response.json([fixture]);
 });
 assert.equal(await lookup(target,''),null);
 assert.equal(requests.length,0);
 let admissions=0;
 const admit=async()=>{admissions++;return true;};
 const results=await Promise.all(Array.from({length:20},()=>lookup(target,'fixture-key',admit)));
 assert.ok(results.every(result=>result?.ratings[0].score===4.23));
 assert.equal(requests.length,1);
 assert.equal(admissions,1);
 assert.equal(await lookup(target,'fixture-key',async()=>false),null);
 assert.equal(requests.length,1);
 assert.equal(requests[0].url.origin,'https://api.fragella.com');
 assert.equal(requests[0].url.searchParams.get('search'),'Dior Sauvage EDP');
 assert.equal(new Headers(requests[0].options?.headers).get('x-api-key'),'fixture-key');
 assert.equal(requests[0].options?.redirect,'error');
 assert.ok(!JSON.stringify(results).includes('fixture-key'));
});

test('a denied async admission does not block another requester for the same edition',async()=>{
 let requests=0;
 const lookup=createFragellaLookup(async()=>{
  requests++;
  return Response.json([fixture]);
 });
 const [denied,admitted]=await Promise.all([
  lookup(target,'fixture-key',async()=>false),
  lookup(target,'fixture-key',async()=>true),
 ]);
 assert.equal(denied,null);
 assert.equal(admitted?.ratings[0].score,4.23);
 assert.equal(requests,1);
});
