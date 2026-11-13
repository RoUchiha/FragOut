import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {Store} from '../src/lib/store.ts';
import {handleAiApi} from '../src/lib/ai-api.ts';
import * as database from '../src/lib/database.ts';
import * as validation from '../src/lib/validation.ts';
import * as engine from '../src/lib/engine.ts';
import * as recommendationEvidence from '../src/lib/recommendation-evidence.ts';
import {demoBottles} from '../src/lib/seed.ts';
import * as security from '../src/lib/security.ts';
import * as search from '../src/lib/scent-search.ts';
import * as catalog from '../src/lib/catalog.ts';
import * as editions from '../src/lib/catalog-editions.ts';
import * as outfit from '../src/lib/outfit.ts';
import type {AutomaticCatalogPhoto} from '../src/lib/catalog-photo-store.ts';
import type {lookupFragellaRatings} from '../src/lib/fragella.ts';
import type {CatalogEdition} from '../src/lib/types.ts';
const require=createRequire(import.meta.url),next=require('next/server');
function harness({key='',lookup=async()=>null,select=async()=>null}:{
 key?:string;lookup?:typeof lookupFragellaRatings;select?:(edition:CatalogEdition)=>Promise<AutomaticCatalogPhoto|null>;
}={}){
 const db=new Store(':memory:'),module={exports:{} as any};
 const scheduled:(()=>Promise<void>)[]=[];
 const source=readFileSync(new URL('../src/app/api/[...path]/route.ts',import.meta.url),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,process:{env:{FRAGOUT_FRAGELLA_API_KEY:key}},Buffer,console,Error,Uint8Array,require:(name:string)=>{
  if(name==='next/server')return {...next,after:(task:()=>Promise<void>)=>scheduled.push(task)};if(name==='zod')return require('zod');
  if(name==='@/lib/catalog')return catalog;
  if(name==='@/lib/recommendation-evidence')return recommendationEvidence;
  if(name==='@/lib/catalog-editions')return editions;
  if(name==='@/lib/outfit')return outfit;
  if(name==='@/lib/database')return database;
  if(name==='sharp')return {default:require('sharp')};
  if(name==='@/lib/catalog-photo-selector')return {findAutomaticCatalogPhoto:select};
  if(name==='@/lib/fragella')return {lookupFragellaRatings:lookup};
  if(name==='@/lib/store')return {getStore:()=>db};if(name==='@/lib/validation')return validation;if(name==='@/lib/engine')return engine;if(name==='@/lib/security')return security;if(name==='@/lib/scent-search')return search;if(name==='@/lib/ai-api')return {handleAiApi};throw new Error('Unexpected dependency '+name);
 }});
 async function call(path:string,{method='GET',body,raw,token,cookie,origin='http://localhost:3237',url='http://localhost:3237',headers={}}:{method?:string;body?:unknown;raw?:string|ReadableStream<Uint8Array>;token?:string;cookie?:string;origin?:string|null;url?:string;headers?:Record<string,string>}={}){
  const req=new next.NextRequest(url+'/api/'+path,{method,headers:{...((body===undefined&&raw===undefined)?{}:{'content-type':'application/json'}),...(origin?{origin}:{}),...(token?{authorization:'Bearer '+token}:{}),...(cookie?{cookie}:{}),...headers},...((body===undefined&&raw===undefined)?{}:{body:raw??JSON.stringify(body)})});
  const response=await module.exports[method](req);
  const type=response.headers.get('content-type');
  return {status:response.status,body:type==='image/jpeg'?Buffer.from(await response.arrayBuffer()):await response.json(),type,cookie:response.headers.get('set-cookie') as string|null};
 }
 return {db,call,finishBackground:()=>Promise.all(scheduled.splice(0).map(task=>task()))};
}

function useFixtureVaultKey(t:TestContext){
 const previous=process.env.FRAGOUT_VAULT_KEY;
 process.env.FRAGOUT_VAULT_KEY=Buffer.alloc(32,7).toString('base64');
 t.after(()=>{
  if(previous===undefined)delete process.env.FRAGOUT_VAULT_KEY;
  else process.env.FRAGOUT_VAULT_KEY=previous;
 });
}

test('malformed anonymous login requests cannot exhaust another account login bucket',async()=>{
 const h=harness();try{const user=await h.db.register('Synthetic','synthetic@example.test','synthetic-password');
  for(let i=0;i<80;i++)assert.equal((await h.call('auth',{method:'POST',body:{action:'login'}})).status,400);
  assert.equal((await h.call('auth',{method:'POST',body:{action:'login',email:user.email,password:'synthetic-password'}})).status,200);
 }finally{await h.db.close();}
});

test('recommendations validate mood/vibe and preserve selected context in an owner snapshot',async()=>{
 const h=harness();try{const a=await h.db.createDemo(),b=await h.db.createDemo(),token=await h.db.createSession(a.id);
  const response=await h.call('recommend',{method:'POST',token,body:{occasion:'GENERAL',mode:'solo',mood:'TIRED',vibe:'CLEAN'}});
  assert.equal(response.status,200);assert.equal(response.body.context.mood,'TIRED');assert.equal(response.body.context.vibe,'CLEAN');
  const run=await h.db.getRecommendation(a.id,response.body.requestId);assert.equal(run?.context.mood,'TIRED');assert.equal(await h.db.getRecommendation(b.id,response.body.requestId),null);
  const worn=await h.db.feedback(a.id,[response.body.solo[0].bottle.id],'wore','GENERAL',response.body.requestId);assert.equal(worn.context.vibe,'CLEAN');
  for(const patch of [{mood:'unsupported'},{vibe:'unsupported'},{mood:['HAPPY']},{vibe:{value:'CLEAN'}}])assert.equal((await h.call('recommend',{method:'POST',token,body:{occasion:'GENERAL',mode:'solo',...patch}})).status,400);
  assert.equal((await h.db.state(a.id)).context.mood,undefined,'Request choices must not change persistent account conditions');
 }finally{await h.db.close();}
});

test('catalog recommendations use exact sourced editions and brand-reviewed pairs with no personal profile required',async()=>{
 const h=harness();
 try {
  const owner=await h.db.register('Catalog QA','catalog-qa@example.test','synthetic-password');
  const token=await h.db.createSession(owner.id);
  const {id,variantId,catalogPhoto,catalogPhotos,...base}=demoBottles[0];
  const add=(name:string,concentration:string)=>h.call('bottles',{method:'POST',token,body:{
   ...base,brand:'Jo Malone',name,concentration,profileKnown:false,notes:[],family:'',climate:'UNKNOWN',provenance:'unknown',
  }});
  const first=await add('Wood Sage & Sea Salt','EDC');
  const second=await add('Peony & Blush Suede','EDC');
  const wrongEdition=await add('Peony & Blush Suede','EDP');
  for(const item of [first,second,wrongEdition])assert.equal(item.status,201);
  const single=await h.call('recommend',{method:'POST',token,body:{mode:'solo',occasion:'GENERAL',search:'ambrette'}});
  assert.equal(single.status,200);
  assert.deepEqual(single.body.solo.map((result:{bottle:{id:string}})=>result.bottle.id),[first.body.id]);
  assert.equal(single.body.solo[0].bottle.provenance,'catalog');
  assert.equal(single.body.solo[0].bottle.strengthUnknown,true);
  assert.match(single.body.solo[0].bottle.catalogSource.url,/^https:\/\/www\.jomalone\.com\//);
  const gym=await h.call('recommend',{method:'POST',token,body:{mode:'solo',occasion:'GYM'}});
  assert.deepEqual(gym.body.solo,[]);
  const pair=await h.call('recommend',{method:'POST',token,body:{mode:'combo',occasion:'GENERAL',evidenceMode:'evidence'}});
  assert.equal(pair.status,200);
  assert.equal(pair.body.combos.length,1);
  assert.deepEqual(new Set([pair.body.combos[0].a.id,pair.body.combos[0].b.id]),new Set([first.body.id,second.body.id]));
  assert.equal(pair.body.combos[0].tier,'brand_guidance');
  assert.deepEqual(pair.body.combos[0].sources,['https://www.jomalone.com/scent-layering']);
  const state=await h.db.state(owner.id);
  await h.db.saveSettings(owner.id,{preferences:{...state.preferences,dislikedNotes:['sage']}});
  const filtered=await h.call('recommend',{method:'POST',token,body:{mode:'combo',occasion:'GENERAL'}});
  assert.deepEqual(filtered.body.combos,[]);
  assert.equal((await h.db.getBottle(owner.id,first.body.id))?.profileKnown,false);
 }finally{await h.db.close();}
});

test('recommendation search remains owned-only and can anchor a pair with one matching bottle',async()=>{
 const h=harness();try{
  const a=await h.db.createDemo(),token=await h.db.createSession(a.id);
  const call=(search:string,mode='solo')=>h.call('recommend',{method:'POST',token,body:{occasion:'GENERAL',mode,evidenceMode:'experimental',search}});
  const solo=await call('golden-hour');
  assert.equal(solo.status,200);
  assert.deepEqual(Array.from(solo.body.solo,(r:{bottle:{name:string}})=>r.bottle.name),['Golden Hour']);
  const pairs=await call('salt air','combo');
  assert.ok(pairs.body.combos.length>0);
  assert.ok(pairs.body.combos.every((r:{a:{name:string};b:{name:string}})=>[r.a.name,r.b.name].includes('Salt Air')));
  for (const query of ['Midnight Ink','fictional scent']) assert.equal((await call(query)).body.solo.length,0);
  assert.equal((await call('s'.repeat(121))).status,400);
 }finally{await h.db.close();}
});

test('outfit recommendations only retain the outfit under the same archive consent',async t=>{
 const h=harness();
 useFixtureVaultKey(t);
 try{
  const owner=await h.db.createDemo(),token=await h.db.createSession(owner.id);
  const {preferences}=await h.db.state(owner.id);
  const enableArchive=()=>h.db.saveSettings(owner.id,{preferences:{...preferences,archiveOutfits:true}});
  await enableArchive();
  const profile=outfit.parseOutfitText('white cotton t-shirt, blue jeans and white sneakers');
  const analysisId=randomUUID();
  await h.db.saveOutfit(owner.id,{id:analysisId,profile,provider:'qwen',model:'fixture',method:'offline_rules',createdAt:new Date().toISOString()});
  const recommend=()=>h.call('outfit/recommend',{method:'POST',token,body:{analysisId,profile,mode:'solo',occasion:'GENERAL'}});
  const initial=await recommend();
  assert.equal(initial.status,200);
  assert.equal((await h.db.getRecommendation(owner.id,initial.body.requestId))?.outfit?.analysisId,analysisId);

  const readState=h.db.state.bind(h.db);
  h.db.state=async(...args)=>{
   const result=await readState(...args);
   await h.db.saveSettings(owner.id,{preferences:{...preferences,archiveOutfits:false}});
   await enableArchive();
   return result;
  };
  const inFlight=await recommend();
  assert.equal(inFlight.status,200);
  const recommendation=await h.db.getRecommendation(owner.id,inFlight.body.requestId);
  assert.ok(recommendation);
  assert.equal(recommendation.outfit,undefined);
  assert.equal((await h.db.getRecommendation(owner.id,initial.body.requestId))?.outfit,undefined);
 }finally{await h.db.close();}
});

test('logout before the owner transaction prevents storing an outfit analysis',async t=>{
 const h=harness();
 useFixtureVaultKey(t);
 t.mock.method(globalThis,'fetch',async()=>{throw new Error('Offline provider fixture');});
 try{
  const owner=await h.db.createDemo(),token=await h.db.createSession(owner.id);
  const begin=h.db.withOwnerTransaction.bind(h.db);
  h.db.withOwnerTransaction=async(userId,work)=>{
   await h.db.revokeSession(token);
   return begin(userId,work);
  };
  const analysis=await h.call('outfit/analyze',{method:'POST',token,body:{
   provider:'qwen',text:'white cotton t-shirt, blue jeans and white sneakers',
  }});
  assert.equal(analysis.status,401);
  assert.equal((await h.db.exportState(owner.id)).outfitAnalyses.length,0);
 }finally{await h.db.close();}
});

test('combo likes are private, order independent and separate from wear history',async()=>{
 const h=harness();
 try {
  const owner=await h.db.createDemo(),other=await h.db.createDemo();
  const ownerToken=await h.db.createSession(owner.id),otherToken=await h.db.createSession(other.id);
  const ids=(await h.db.state(owner.id)).bottles.slice(0,2).map(bottle=>bottle.id);
  const setLike=(token:string,bottleIds:string[],liked:boolean)=>
   h.call('liked-combos',{method:'PUT',token,body:{bottleIds,liked}});
  assert.equal((await setLike(ownerToken,ids,true)).status,200);
  assert.equal((await setLike(ownerToken,[...ids].reverse(),true)).status,200);
  assert.equal((await setLike(ownerToken,[ids[0],ids[0]],true)).status,400);
  assert.equal((await setLike(otherToken,ids,true)).status,400);
  assert.equal((await setLike(otherToken,ids,false)).status,200);
  assert.equal((await h.call('state',{token:otherToken})).body.likedCombos.length,0);
  const ownerState=(await h.call('state',{token:ownerToken})).body;
  assert.equal(ownerState.likedCombos.length,1);
  assert.equal(ownerState.history.filter((event:{reaction:string})=>event.reaction==='saved').length,1);
  await h.db.feedback(owner.id,ids,'wore','WORK');
  await h.db.feedback(owner.id,[...ids].reverse(),'saved','GENERAL');
  assert.equal((await setLike(ownerToken,[...ids].reverse(),false)).status,200);
  const after=(await h.call('state',{token:ownerToken})).body;
  assert.equal(after.likedCombos.length,0);
  assert.deepEqual(Array.from(after.history,(event:{reaction:string})=>event.reaction),['wore']);
 } finally { await h.db.close(); }
});

test('fragrance profiles require bottle ownership and resolve the current edition',async()=>{
 const h=harness();
 try {
  const a=await h.db.createDemo(),b=await h.db.createDemo();
  const token=await h.db.createSession(a.id),other=await h.db.createSession(b.id);
  const owned=await h.db.addBottle(a.id,{...(await h.db.state(a.id)).bottles[0],
   brand:'Dior',name:'Sauvage',concentration:'EDP',memo:'private-catalog-canary'});
  const path='bottles/'+owned.id+'/profile';
  assert.equal((await h.call(path)).status,401);
  assert.equal((await h.call(path,{token:other})).status,404);
  const edp=await h.call(path,{token});
  assert.equal(edp.status,200);
  assert.equal(edp.body.variantId,owned.variantId);
  assert.equal(edp.body.profile.concentration,'EDP');
  assert.match(edp.body.profile.photo.path,/^\/catalog\/bottles\/dior-sauvage-edp-[a-f0-9]+\.jpg$/);
  const product=(profile:{links:{kind?:string;url:string}[]})=>
   profile.links.find(link=>link.kind==='jomashop-listing')?.url;
  assert.match(product(edp.body.profile)??'',/^https:\/\/www\.jomashop\.com\/[a-z0-9-]+\.html$/);
  assert.equal((await h.call('state',{token})).body.bottles.find((bottle:{id:string})=>bottle.id===owned.id).catalogPhoto,edp.body.profile.photo.path);
  assert.deepEqual((await h.call('state',{token})).body.bottles.find((bottle:{id:string})=>bottle.id===owned.id).catalogPhotos,
   [edp.body.profile.photo.path]);
  assert.equal((await h.call('bottles/'+owned.id,{method:'PATCH',token,body:{catalogPhotos:['/data/private.jpg']}})).status,400);
  assert.ok(!JSON.stringify(edp.body).includes('private-catalog-canary'));
  assert.equal((await h.call('bottles/'+owned.id,{method:'PATCH',token,body:{concentration:'EDT'}})).status,200);
  const edt=await h.call(path,{token});
  assert.equal(edt.body.profile.concentration,'EDT');
  assert.notEqual(edt.body.variantId,edp.body.variantId);
  assert.notEqual(edt.body.profile.id,edp.body.profile.id);
  assert.notEqual(product(edt.body.profile),product(edp.body.profile));
  assert.match(edt.body.profile.photo.path,/^\/catalog\/bottles\/dior-sauvage-edt-[a-f0-9]+\.jpg$/);
  assert.equal((await h.call('state',{token})).body.bottles.find((bottle:{id:string})=>bottle.id===owned.id).catalogPhoto,edt.body.profile.photo.path);
  assert.equal((await h.call('bottles/'+owned.id,{method:'PATCH',token,body:{concentration:'UNKNOWN'}})).status,200);
  assert.equal((await h.call(path,{token})).body.profile,null);
  assert.equal((await h.call('state',{token})).body.bottles.find((bottle:{id:string})=>bottle.id===owned.id).catalogPhotos,undefined);
 } finally { await h.db.close(); }
});

test('a newly saved fragrance gets the exact bundled photo without a provider key',async()=>{
 const h=harness();
 try {
  const owner=await h.db.createDemo(),other=await h.db.createDemo();
  const token=await h.db.createSession(owner.id),otherToken=await h.db.createSession(other.id);
  const {id,variantId,catalogPhoto,catalogPhotos,...fields}=(await h.db.state(owner.id)).bottles[0]!;
  const saved=await h.call('bottles',{method:'POST',token,body:{...fields,
   brand:'Bvlgari',name:'Aqva Pour Homme',concentration:'EDT',provenance:'unknown',memo:'private-thumb-canary'}});
  assert.equal(saved.status,201);
  const root='bottles/'+saved.body.id;
  assert.equal((await h.call(root+'/profile')).status,401);
  assert.equal((await h.call(root+'/profile',{token:otherToken})).status,404);
  const result=await h.call(root+'/profile',{token});
  assert.equal(result.body.variantId,saved.body.variantId);
  assert.match(result.body.profile.photo.path,/^\/catalog\/bottles\/bvlgari-aqva-pour-homme-edt-[a-f0-9]+\.jpg$/);
  assert.ok(!JSON.stringify(result.body).includes('private-thumb-canary'));
  assert.equal((await h.call(root+'/thumbnail',{token})).status,404);
  assert.equal((await h.call(root,{method:'PATCH',token,body:{concentration:'EDP'}})).status,200);
  assert.equal((await h.call(root+'/profile',{token})).body.profile,null);
 }finally{await h.db.close();}
});

test('new public releases select a thumbnail after save using only their canonical identity',async()=>{
 const received:CatalogEdition[]=[];
 const candidate={bytes:Buffer.from('fixture photo'),sourceUrl:'https://maker.example.com/fahrenheit',publisher:'Fixture maker'};
 const h=harness({select:async edition=>{received.push(edition);return candidate;}});
 try {
  const owner=await h.db.createDemo(),other=await h.db.createDemo(),token=await h.db.createSession(owner.id);
  const {id,variantId,catalogPhoto,catalogPhotos,...fields}=(await h.db.state(owner.id)).bottles[0]!;
  const input={...fields,brand:'Christian Dior',name:'Fahrenheit EDT',concentration:'EDT',provenance:'unknown',memo:'private-canary'};
  const saved=await h.call('bottles',{method:'POST',token,body:input});
  assert.equal(saved.status,201);
  assert.equal(received.length,0,'Saving must not wait for an external image lookup.');
  await h.finishBackground();
  assert.equal(received.length,1);
  assert.equal(received[0]?.brand,'Dior');
  assert.equal(received[0]?.name,'Fahrenheit');
  assert.ok(!JSON.stringify(received).includes('private-canary'));
  const path='bottles/'+saved.body.id+'/profile';
  assert.equal((await h.call(path,{token:await h.db.createSession(other.id)})).status,404);
  const profile=await h.call(path,{token});
  assert.match(profile.body.profile?.photo?.path??'',/^\/api\/catalog-image\/[a-f0-9]{64}$/);
  const image=await h.call(profile.body.profile.photo.path.slice(5));
  assert.equal(image.type,'image/jpeg');
  assert.deepEqual(image.body,candidate.bytes);
  const custom=await h.call('bottles',{method:'POST',token,body:{...input,name:'Unpublished personal recipe'}});
  await h.finishBackground();
  assert.equal((await h.call('bottles/'+custom.body.id+'/profile',{token})).body.profile,null);
  assert.equal(received.length,1);
 }finally{await h.db.close();}
});

test('photo administration is role gated and validates uploads before publishing a local asset',async()=>{
 const h=harness();
 try {
  const admin=await h.db.register('Editor','editor@example.test','synthetic-password'),demo=await h.db.createDemo();
  const token=await h.db.createSession(admin.id),otherToken=await h.db.createSession(demo.id);
  const list='catalog-admin/search',edit='catalog-admin/photo',id='dior-sauvage-edp';
  assert.equal((await h.call(list,{method:'POST',body:{q:'sauvage'}})).status,401);
  assert.equal((await h.call(edit,{method:'PUT',token:otherToken,raw:'{broken'})).status,403);
  assert.equal(await h.db.catalogPhotos.setAdmin(admin.email!,true),true);
  const search=await h.call(list,{method:'POST',token,body:{q:'dior sauvage edp'}});
  assert.equal(search.body.entries.find((entry:{id:string})=>entry.id===id)?.status,'bundled');
  assert.equal((await h.call(edit,{method:'PUT',token,body:{id,action:'replace',
   image:{mime:'image/jpeg',data:Buffer.from('<svg>fake</svg>').toString('base64')}}})).status,400);
  const jpg:Buffer=await require('sharp')({create:{width:220,height:280,channels:3,background:'#80532e'}}).jpeg().toBuffer();
  const replaced=await h.call(edit,{method:'PUT',token,body:{id,action:'replace',image:{mime:'image/jpeg',data:jpg.toString('base64')}}});
  assert.equal(replaced.status,200);
  assert.equal(replaced.body.entry.status,'override');
  const imagePath=replaced.body.entry.photoPath.slice(5);
  const response=await h.call(imagePath);
  assert.equal(response.type,'image/jpeg');
  assert.equal((await require('sharp')(response.body).metadata()).exif,undefined);
  const hidden=await h.call(edit,{method:'PUT',token,body:{id,action:'hide'}});
  assert.equal(hidden.body.entry.status,'hidden');
  assert.equal((await h.call(imagePath)).status,404);
  assert.equal((await h.call(edit,{method:'PUT',token,body:{id,action:'reset'}})).body.entry.status,'bundled');
  await h.db.catalogPhotos.setAdmin(admin.email!,false);
  assert.equal((await h.call(edit,{method:'PUT',token,body:{id,action:'hide'}})).status,403);
 }finally{await h.db.close();}
});

test('manual saves accept cologne, extrait and mist without conflating editions',async()=>{
 const h=harness();
 try {
  const user=await h.db.createDemo(),token=await h.db.createSession(user.id);
  const {id,variantId,catalogPhoto,...fields}=(await h.db.state(user.id)).bottles[0]!;
  for(const [brand,name,concentration] of [
   ['Jo Malone','Wood Sage & Sea Salt Cologne','EDC'],
   ['Nishane','Hacivat','EXTRAIT'],
   ['Sol de Janeiro','Cheirosa 62','MIST'],
  ]) {
   const saved=await h.call('bottles',{method:'POST',token,body:{...fields,brand,name,concentration,provenance:'unknown'}});
   assert.equal(saved.status,201);
   const dex=await h.call('bottles/'+saved.body.id+'/profile',{token});
   assert.equal(dex.body.profile.concentration,concentration);
   assert.ok(dex.body.profile.notes.length>=2);
  }
 } finally {await h.db.close();}
});

test('owner FragDex shows the original for a saved dupe without a full catalog profile',async()=>{
 const h=harness();
 try {
  const owner=await h.db.createDemo(),other=await h.db.createDemo();
  const token=await h.db.createSession(owner.id),otherToken=await h.db.createSession(other.id);
  const saved=await h.db.addBottle(owner.id,{...(await h.db.state(owner.id)).bottles[0],
   brand:'Oil Perfumery',name:'Baccarat Rouge 540 Extrait de Parfum',concentration:'OIL',memo:'dupe-note-canary'});
  const path='bottles/'+saved.id+'/profile';
  assert.equal((await h.call(path,{token:otherToken})).status,404);
  const result=await h.call(path,{token});
  assert.equal(result.status,200);
  assert.equal(result.body.profile,null);
  assert.equal(result.body.dupes.originals[0].name,'Baccarat Rouge 540');
  assert.equal(result.body.dupes.originals[0].concentration,'EXTRAIT');
  assert.equal(result.body.dupes.originals[0].evidence,'brand');
  assert.ok(!JSON.stringify(result.body).includes('dupe-note-canary'));
 } finally {await h.db.close();}
});

test('live FragDex ratings are owner-scoped and discarded after edition or session changes',async()=>{
 let lookups=0,change:()=>Promise<void>=async()=>{};
 const h=harness({key:'server-only-test-key',lookup:async(profile,key,admit)=>{
  assert.equal(key,'server-only-test-key');
  assert.equal(profile.id,'dior-sauvage-edp');
  assert.equal(await admit?.(),true);
  lookups++;
  await change();
  return {
   ratings:[{facet:'overall',sourceId:'fragella',score:4.23,kind:'published',basis:'Weighted community rating'}],
   source:{id:'fragella',publisher:'Fragella',kind:'community',url:'https://app.fragella.com/fragrance/Sauvage-Eau-De-Parfum'},
  };
 }});
 try {
  const owner=await h.db.register('Catalog QA','catalog-test@example.test','synthetic-password');
  const other=await h.db.createDemo();
  const token=await h.db.createSession(owner.id),otherToken=await h.db.createSession(other.id);
  const owned=await h.db.addBottle(owner.id,{...(await h.db.state(other.id)).bottles[0],
   brand:'Dior',name:'Sauvage',concentration:'EDP',memo:'private-entry-note'});
  const demoBottle=await h.db.addBottle(other.id,owned);
  const path='bottles/'+owned.id+'/profile';
  assert.equal((await h.call(path,{token:otherToken})).status,404);
  assert.equal((await h.call('bottles/'+demoBottle.id+'/profile',{token:otherToken})).status,200);
  assert.equal(lookups,0);
  const result=await h.call(path,{token});
  assert.equal(result.body.profile.ratings[0].score,4.23);
  assert.ok(!JSON.stringify(result.body).includes('server-only-test-key'));
  assert.ok(!JSON.stringify(result.body).includes('private-entry-note'));
  change=async()=>{await h.db.updateBottle(owner.id,owned.id,{concentration:'EDT'});};
  const edited=await h.call(path,{token});
  assert.equal(edited.body.profile.concentration,'EDT');
  assert.ok(!edited.body.profile.ratings.some((rating:{sourceId:string})=>rating.sourceId==='fragella'));
  await h.db.updateBottle(owner.id,owned.id,{concentration:'EDP'});
  change=async()=>{await h.db.revokeSession(token);};
  assert.equal((await h.call(path,{token})).status,401);
 } finally {await h.db.close();}
});

test('HTTPS login issues Secure, HttpOnly and SameSite cookies without an opt-in flag',async()=>{
 const h=harness();try{const r=await h.call('auth',{method:'POST',body:{action:'demo'},url:'https://localhost:3237',origin:'https://localhost:3237'});
  assert.equal(r.status,200);assert.match(r.cookie!,/^__Host-fragout_session=/);assert.match(r.cookie!,/; Secure/i);assert.match(r.cookie!,/HttpOnly/i);assert.match(r.cookie!,/SameSite=Lax/i);
 }finally{await h.db.close();}
});

test('mobile demo sessions use bearer tokens and are revoked on logout',async()=>{
 const h=harness();
 try{
  const login=await h.call('auth',{method:'POST',body:{action:'demo',client:'mobile'}});
  assert.equal(login.status,200);
  assert.equal(login.cookie,null);
  const token=login.body.sessionToken;
  assert.match(token,/^[a-f0-9]{64}$/);
  const state=await h.call('state',{token});
  assert.equal(state.status,200);
  assert.equal(state.body.user.id,login.body.user.id);
  const logout=await h.call('auth',{method:'POST',token,body:{action:'logout',client:'mobile'}});
  assert.equal(logout.status,200);
  assert.equal(logout.cookie,null);
  assert.equal((await h.call('state',{token})).status,401);
 }finally{await h.db.close();}
});

test('HTTPS rejects legacy cookie names that a sibling domain could inject',async()=>{
 const h=harness();try{const user=await h.db.createDemo(),token=await h.db.createSession(user.id);
  assert.equal((await h.call('state',{url:'https://localhost:3237',origin:'https://localhost:3237',cookie:'fragout_session='+token})).status,401);
  assert.equal((await h.call('state',{url:'https://localhost:3237',origin:'https://localhost:3237',cookie:'__Host-fragout_session='+token})).status,200);
 }finally{await h.db.close();}
});

test('invalid bearer header never falls back to a valid unrelated cookie',async()=>{
 const h=harness();try{const user=await h.db.createDemo(),cookie='fragout_session='+await h.db.createSession(user.id);
  assert.equal((await h.call('state',{cookie,headers:{authorization:'Bearer invalid'}})).status,401);
  assert.equal((await h.call('state',{cookie,headers:{authorization:'Basic invalid'}})).status,401);
 }finally{await h.db.close();}
});

test('cookie mutations require Origin and cross-site private reads are rejected',async()=>{
 const h=harness();try{const user=await h.db.createDemo(),cookie='fragout_session='+await h.db.createSession(user.id);
  assert.equal((await h.call('settings',{method:'PUT',cookie,origin:null,body:{}})).status,403);
  assert.equal((await h.call('export',{cookie,origin:null,headers:{'sec-fetch-site':'cross-site'}})).status,403);
 }finally{await h.db.close();}
});

test('unauthorized protected uploads are rejected before JSON processing',async()=>{
 const h=harness();try{
  assert.equal((await h.call('outfit/analyze',{method:'POST',raw:'{'})).status,401);
 }finally{await h.db.close();}
});

test('a session revoked while reading a request body cannot add a bottle',async()=>{
 const h=harness();
 try{
  const user=await h.db.createDemo(),token=await h.db.createSession(user.id);
  const {bottles}=await h.db.state(user.id);
  const {id,variantId,catalogPhoto,catalogPhotos,...fields}=bottles[0]!;
  const raw=new ReadableStream<Uint8Array>({
   async pull(controller){
    await h.db.revokeSession(token);
    controller.enqueue(new TextEncoder().encode(JSON.stringify({...fields,name:'Revoked session bottle',provenance:'unknown'})));
    controller.close();
   },
  },{highWaterMark:0});
  const result=await h.call('bottles',{method:'POST',token,raw});
  assert.equal(result.status,401,JSON.stringify(result.body));
  assert.equal((await h.db.state(user.id)).bottles.length,bottles.length);
 }finally{await h.db.close();}
});

test('unavailable storage returns 503 without exposing database details',async()=>{
 const h=harness();
 try{
  h.db.sessionUser=async()=>{throw new database.DatabaseUnavailable(new Error('private account query details'));};
  const result=await h.call('state',{token:'a'.repeat(64)});
  assert.equal(result.status,503);
  assert.equal(result.body.error,'Storage is temporarily unavailable. Try again shortly.');
 }finally{await h.db.close();}
});

test('strict media types, hosts and exact routes are enforced inside the API as well as proxy',async()=>{
 const h=harness();try{const user=await h.db.createDemo(),token=await h.db.createSession(user.id);
  assert.equal((await h.call('settings',{method:'PUT',token,body:{},headers:{'content-type':'text/plain; application/json'}})).status,415);
  assert.equal((await h.call('auth',{method:'POST',body:{action:'demo'},url:'http://evil.example',origin:'http://evil.example'})).status,421);
  assert.equal((await h.call('auth/unexpected',{method:'POST',token,body:{action:'demo'}})).status,404);
 }finally{await h.db.close();}
});
