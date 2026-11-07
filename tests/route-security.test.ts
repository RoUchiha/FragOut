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
const require=createRequire(import.meta.url),next=require('next/server');
function harness(){
 const db=new Store(':memory:'),module={exports:{} as any};
 const source=readFileSync(new URL('../src/app/api/[...path]/route.ts',import.meta.url),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,process:{env:{}},Buffer,console,Error,Uint8Array,require:(name:string)=>{
  if(name==='next/server')return next;if(name==='zod')return require('zod');
  if(name==='@/lib/store')return {getStore:()=>db};if(name==='@/lib/validation')return validation;if(name==='@/lib/engine')return engine;if(name==='@/lib/security')return security;if(name==='@/lib/ai-api')return {handleAiApi:async()=>null};throw new Error('Unexpected dependency '+name);
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
