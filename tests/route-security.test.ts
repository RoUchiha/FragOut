import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import {Store} from '../src/lib/store.ts';
import * as validation from '../src/lib/validation.ts';
import * as engine from '../src/lib/engine.ts';
import * as security from '../src/lib/security.ts';
import * as search from '../src/lib/scent-search.ts';
import * as catalog from '../src/lib/catalog.ts';
import type {lookupFragellaRatings} from '../src/lib/fragella.ts';
const require=createRequire(import.meta.url),next=require('next/server');
function harness({key='',lookup=async()=>null}:{key?:string;lookup?:typeof lookupFragellaRatings}={}){
 const db=new Store(':memory:'),module={exports:{} as any};
 const source=readFileSync(new URL('../src/app/api/[...path]/route.ts',import.meta.url),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,process:{env:{FRAGOUT_FRAGELLA_API_KEY:key}},Buffer,console,Error,Uint8Array,require:(name:string)=>{
  if(name==='next/server')return next;if(name==='zod')return require('zod');
  if(name==='@/lib/catalog')return catalog;
  if(name==='@/lib/fragella')return {lookupFragellaRatings:lookup};
  if(name==='@/lib/store')return {getStore:()=>db};if(name==='@/lib/validation')return validation;if(name==='@/lib/engine')return engine;if(name==='@/lib/security')return security;if(name==='@/lib/scent-search')return search;if(name==='@/lib/ai-api')return {handleAiApi:async()=>null};throw new Error('Unexpected dependency '+name);
 }});
 async function call(path:string,{method='GET',body,raw,token,cookie,origin='http://localhost:3237',url='http://localhost:3237',headers={}}:{method?:string;body?:unknown;raw?:string;token?:string;cookie?:string;origin?:string|null;url?:string;headers?:Record<string,string>}={}){
  const req=new next.NextRequest(url+'/api/'+path,{method,headers:{...((body===undefined&&raw===undefined)?{}:{'content-type':'application/json'}),...(origin?{origin}:{}),...(token?{authorization:'Bearer '+token}:{}),...(cookie?{cookie}:{}),...headers},...((body===undefined&&raw===undefined)?{}:{body:raw??JSON.stringify(body)})});
  const response=await module.exports[method](req);return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie') as string|null};
 }
 return {db,call};
}

test('malformed anonymous login requests cannot exhaust another account login bucket',async()=>{
 const h=harness();try{const user=h.db.register('Synthetic','synthetic@example.test','synthetic-password');
  for(let i=0;i<80;i++)assert.equal((await h.call('auth',{method:'POST',body:{action:'login'}})).status,400);
  assert.equal((await h.call('auth',{method:'POST',body:{action:'login',email:user.email,password:'synthetic-password'}})).status,200);
 }finally{h.db.close();}
});

test('recommendations validate mood/vibe and preserve selected context in an owner snapshot',async()=>{
 const h=harness();try{const a=h.db.createDemo(),b=h.db.createDemo(),token=h.db.createSession(a.id);
  const response=await h.call('recommend',{method:'POST',token,body:{occasion:'GENERAL',mode:'solo',mood:'TIRED',vibe:'CLEAN'}});
  assert.equal(response.status,200);assert.equal(response.body.context.mood,'TIRED');assert.equal(response.body.context.vibe,'CLEAN');
  const run=h.db.getRecommendation(a.id,response.body.requestId);assert.equal(run?.context.mood,'TIRED');assert.equal(h.db.getRecommendation(b.id,response.body.requestId),null);
  const worn=h.db.feedback(a.id,[response.body.solo[0].bottle.id],'wore','GENERAL',response.body.requestId);assert.equal(worn.context.vibe,'CLEAN');
  for(const patch of [{mood:'unsupported'},{vibe:'unsupported'},{mood:['HAPPY']},{vibe:{value:'CLEAN'}}])assert.equal((await h.call('recommend',{method:'POST',token,body:{occasion:'GENERAL',mode:'solo',...patch}})).status,400);
  assert.equal(h.db.state(a.id).context.mood,undefined,'Request choices must not change persistent account conditions');
 }finally{h.db.close();}
});

test('recommendation search remains owned-only and can anchor a pair with one matching bottle',async()=>{
 const h=harness();try{
  const a=h.db.createDemo(),token=h.db.createSession(a.id);
  const call=(search:string,mode='solo')=>h.call('recommend',{method:'POST',token,body:{occasion:'GENERAL',mode,evidenceMode:'experimental',search}});
  const solo=await call('golden-hour');
  assert.equal(solo.status,200);
  assert.deepEqual(Array.from(solo.body.solo,(r:{bottle:{name:string}})=>r.bottle.name),['Golden Hour']);
  const pairs=await call('salt air','combo');
  assert.ok(pairs.body.combos.length>0);
  assert.ok(pairs.body.combos.every((r:{a:{name:string};b:{name:string}})=>[r.a.name,r.b.name].includes('Salt Air')));
  for (const query of ['Midnight Ink','fictional scent']) assert.equal((await call(query)).body.solo.length,0);
  assert.equal((await call('s'.repeat(121))).status,400);
 }finally{h.db.close();}
});

test('combo likes are private, order independent and separate from wear history',async()=>{
 const h=harness();
 try {
  const owner=h.db.createDemo(),other=h.db.createDemo();
  const ownerToken=h.db.createSession(owner.id),otherToken=h.db.createSession(other.id);
  const ids=h.db.state(owner.id).bottles.slice(0,2).map(bottle=>bottle.id);
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
  h.db.feedback(owner.id,ids,'wore','WORK');
  h.db.feedback(owner.id,[...ids].reverse(),'saved','GENERAL');
  assert.equal((await setLike(ownerToken,[...ids].reverse(),false)).status,200);
  const after=(await h.call('state',{token:ownerToken})).body;
  assert.equal(after.likedCombos.length,0);
  assert.deepEqual(Array.from(after.history,(event:{reaction:string})=>event.reaction),['wore']);
 } finally { h.db.close(); }
});

test('fragrance profiles require bottle ownership and resolve the current edition',async()=>{
 const h=harness();
 try {
  const a=h.db.createDemo(),b=h.db.createDemo();
  const token=h.db.createSession(a.id),other=h.db.createSession(b.id);
  const owned=h.db.addBottle(a.id,{...h.db.state(a.id).bottles[0],
   brand:'Dior',name:'Sauvage',concentration:'EDP',memo:'private-catalog-canary'});
  const path='bottles/'+owned.id+'/profile';
  assert.equal((await h.call(path)).status,401);
  assert.equal((await h.call(path,{token:other})).status,404);
  const edp=await h.call(path,{token});
  assert.equal(edp.status,200);
  assert.equal(edp.body.variantId,owned.variantId);
  assert.equal(edp.body.profile.concentration,'EDP');
  assert.equal(edp.body.profile.additionalPhotos[0].path,'/catalog/bottles/dior-sauvage-edp-bailo.jpg');
  const product=(profile:{links:{kind?:string;url:string}[]})=>
   profile.links.find(link=>link.kind==='jomashop-listing')?.url;
  assert.match(product(edp.body.profile)??'',/^https:\/\/www\.jomashop\.com\/[a-z0-9-]+\.html$/);
  assert.equal((await h.call('state',{token})).body.bottles.find((bottle:{id:string})=>bottle.id===owned.id).catalogPhoto,edp.body.profile.photo.path);
  assert.deepEqual((await h.call('state',{token})).body.bottles.find((bottle:{id:string})=>bottle.id===owned.id).catalogPhotos,
   [edp.body.profile.photo.path,...edp.body.profile.additionalPhotos.map((photo:{path:string})=>photo.path)]);
  assert.equal((await h.call('bottles/'+owned.id,{method:'PATCH',token,body:{catalogPhotos:['/data/private.jpg']}})).status,400);
  assert.ok(!JSON.stringify(edp.body).includes('private-catalog-canary'));
  assert.equal((await h.call('bottles/'+owned.id,{method:'PATCH',token,body:{concentration:'EDT'}})).status,200);
  const edt=await h.call(path,{token});
  assert.equal(edt.body.profile.concentration,'EDT');
  assert.notEqual(edt.body.variantId,edp.body.variantId);
  assert.notEqual(edt.body.profile.id,edp.body.profile.id);
  assert.notEqual(product(edt.body.profile),product(edp.body.profile));
  assert.equal(edt.body.profile.photo.path,'/catalog/bottles/dior-sauvage-edt.jpg');
  assert.equal((await h.call('state',{token})).body.bottles.find((bottle:{id:string})=>bottle.id===owned.id).catalogPhoto,edt.body.profile.photo.path);
  assert.equal((await h.call('bottles/'+owned.id,{method:'PATCH',token,body:{concentration:'UNKNOWN'}})).status,200);
  assert.equal((await h.call(path,{token})).body.profile,null);
  assert.equal((await h.call('state',{token})).body.bottles.find((bottle:{id:string})=>bottle.id===owned.id).catalogPhotos,undefined);
 } finally { h.db.close(); }
});

test('manual saves accept cologne, extrait and mist without conflating editions',async()=>{
 const h=harness();
 try {
  const user=h.db.createDemo(),token=h.db.createSession(user.id);
  const {id,variantId,catalogPhoto,...fields}=h.db.state(user.id).bottles[0]!;
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
 } finally {h.db.close();}
});

test('owner FragDex shows the original for a saved dupe without a full catalog profile',async()=>{
 const h=harness();
 try {
  const owner=h.db.createDemo(),other=h.db.createDemo();
  const token=h.db.createSession(owner.id),otherToken=h.db.createSession(other.id);
  const saved=h.db.addBottle(owner.id,{...h.db.state(owner.id).bottles[0],
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
 } finally {h.db.close();}
});

test('live FragDex ratings are owner-scoped and discarded after edition or session changes',async()=>{
 let lookups=0,change=()=>{};
 const h=harness({key:'server-only-test-key',lookup:async(profile,key)=>{
  assert.equal(key,'server-only-test-key');
  assert.equal(profile.id,'dior-sauvage-edp');
  lookups++;
  change();
  return {
   ratings:[{facet:'overall',sourceId:'fragella',score:4.23,kind:'published',basis:'Weighted community rating'}],
   source:{id:'fragella',publisher:'Fragella',kind:'community',url:'https://app.fragella.com/fragrance/Sauvage-Eau-De-Parfum'},
  };
 }});
 try {
  const owner=h.db.register('Catalog QA','catalog-test@example.test','synthetic-password');
  const other=h.db.createDemo();
  const token=h.db.createSession(owner.id),otherToken=h.db.createSession(other.id);
  const owned=h.db.addBottle(owner.id,{...h.db.state(other.id).bottles[0],
   brand:'Dior',name:'Sauvage',concentration:'EDP',memo:'private-entry-note'});
  const demoBottle=h.db.addBottle(other.id,owned);
  const path='bottles/'+owned.id+'/profile';
  assert.equal((await h.call(path,{token:otherToken})).status,404);
  assert.equal((await h.call('bottles/'+demoBottle.id+'/profile',{token:otherToken})).status,200);
  assert.equal(lookups,0);
  const result=await h.call(path,{token});
  assert.equal(result.body.profile.ratings[0].score,4.23);
  assert.ok(!JSON.stringify(result.body).includes('server-only-test-key'));
  assert.ok(!JSON.stringify(result.body).includes('private-entry-note'));
  change=()=>{h.db.updateBottle(owner.id,owned.id,{concentration:'EDT'});};
  const edited=await h.call(path,{token});
  assert.equal(edited.body.profile.concentration,'EDT');
  assert.ok(!edited.body.profile.ratings.some((rating:{sourceId:string})=>rating.sourceId==='fragella'));
  h.db.updateBottle(owner.id,owned.id,{concentration:'EDP'});
  change=()=>{h.db.revokeSession(token);};
  assert.equal((await h.call(path,{token})).status,401);
 } finally {h.db.close();}
});

test('HTTPS login issues Secure, HttpOnly and SameSite cookies without an opt-in flag',async()=>{
 const h=harness();try{const r=await h.call('auth',{method:'POST',body:{action:'demo'},url:'https://localhost:3237',origin:'https://localhost:3237'});
  assert.equal(r.status,200);assert.match(r.cookie!,/^__Host-fragout_session=/);assert.match(r.cookie!,/; Secure/i);assert.match(r.cookie!,/HttpOnly/i);assert.match(r.cookie!,/SameSite=Lax/i);
 }finally{h.db.close();}
});

test('HTTPS rejects legacy cookie names that a sibling domain could inject',async()=>{
 const h=harness();try{const user=h.db.createDemo(),token=h.db.createSession(user.id);
  assert.equal((await h.call('state',{url:'https://localhost:3237',origin:'https://localhost:3237',cookie:'fragout_session='+token})).status,401);
  assert.equal((await h.call('state',{url:'https://localhost:3237',origin:'https://localhost:3237',cookie:'__Host-fragout_session='+token})).status,200);
 }finally{h.db.close();}
});

test('invalid bearer header never falls back to a valid unrelated cookie',async()=>{
 const h=harness();try{const user=h.db.createDemo(),cookie='fragout_session='+h.db.createSession(user.id);
  assert.equal((await h.call('state',{cookie,headers:{authorization:'Bearer invalid'}})).status,401);
  assert.equal((await h.call('state',{cookie,headers:{authorization:'Basic invalid'}})).status,401);
 }finally{h.db.close();}
});

test('cookie mutations require Origin and cross-site private reads are rejected',async()=>{
 const h=harness();try{const user=h.db.createDemo(),cookie='fragout_session='+h.db.createSession(user.id);
  assert.equal((await h.call('settings',{method:'PUT',cookie,origin:null,body:{}})).status,403);
  assert.equal((await h.call('export',{cookie,origin:null,headers:{'sec-fetch-site':'cross-site'}})).status,403);
 }finally{h.db.close();}
});

test('unauthorized protected uploads are rejected before JSON processing',async()=>{
 const h=harness();try{
  assert.equal((await h.call('outfit/analyze',{method:'POST',raw:'{'})).status,401);
 }finally{h.db.close();}
});

test('strict media types, hosts and exact routes are enforced inside the API as well as proxy',async()=>{
 const h=harness();try{const user=h.db.createDemo(),token=h.db.createSession(user.id);
  assert.equal((await h.call('settings',{method:'PUT',token,body:{},headers:{'content-type':'text/plain; application/json'}})).status,415);
  assert.equal((await h.call('auth',{method:'POST',body:{action:'demo'},url:'http://evil.example',origin:'http://evil.example'})).status,421);
  assert.equal((await h.call('auth/unexpected',{method:'POST',token,body:{action:'demo'}})).status,404);
 }finally{h.db.close();}
});
