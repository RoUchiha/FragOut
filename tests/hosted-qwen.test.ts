import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {buildProviderRequest,runVision} from '../src/lib/providers.ts';
import {parseOutfitText} from '../src/lib/outfit.ts';
import {Store} from '../src/lib/store.ts';
import {handleAiApi} from '../src/lib/ai-api.ts';
import {NextRequest} from 'next/server.js';
import sharp from 'sharp';
import vm from 'node:vm';
import ts from 'typescript';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const model='alibaba/qwen3.8-27b';
const invocationToken=(tag:string)=>[Buffer.from('{"alg":"none"}').toString('base64url'),Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:tag})).toString('base64url'),'synthetic-signature'].join('.');
const syntheticToken=invocationToken('synthetic-deployment-token');
function hosted(t:TestContext,extra:Record<string,string|undefined>={}){
 const values={FRAGOUT_QWEN_BACKEND:'gateway',FRAGOUT_PAID_AI_ENABLED:'true',FRAGOUT_ENVIRONMENT:'production',VERCEL_OIDC_TOKEN:syntheticToken,...extra};
 const previous=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));
 for(const [key,value] of Object.entries(values)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 t.after(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
}
test('hosted Qwen uses fixed HTTPS, deployment credentials and enforced private provider routing',t=>{
 hosted(t);
 const request=buildProviderRequest('qwen',model,syntheticToken,'outfit',{image:{mime:'image/jpeg',data:'synthetic-image'}});
 assert.equal(request.url,'https://ai-gateway.vercel.sh/v1/chat/completions');
 assert.equal(request.headers.Authorization,'Bearer '+syntheticToken);
 assert.ok(!request.url.includes(syntheticToken));
 assert.equal(request.body.store,false);assert.equal(request.body.model,model);
 assert.deepEqual(request.body.providerOptions,{gateway:{only:['wafer','parasail'],zeroDataRetention:true,disallowPromptTraining:true}});
 assert.equal((request.body.response_format as {type:string}).type,'json_schema');
 assert.ok(!JSON.stringify(request.body).includes(syntheticToken));
});
test('hosted Qwen refuses missing credentials and non-production runtime before any outbound request',async t=>{
 hosted(t,{VERCEL_OIDC_TOKEN:undefined});let calls=0;
 const fake:typeof fetch=async()=>{calls++;return new Response('{}');};
 await assert.rejects(()=>runVision('qwen',model,undefined,'outfit',{},fake));
 process.env.VERCEL_OIDC_TOKEN='synthetic-deployment-token';process.env.FRAGOUT_ENVIRONMENT='staging';
 await assert.rejects(()=>runVision('qwen',model,undefined,'outfit',{},fake));assert.equal(calls,0);
});
test('hosted Qwen reads validated clothing output and rejects invented fields',async t=>{
 hosted(t);const profile=parseOutfitText('White shirt and black trousers');
 const response=(output:unknown):typeof fetch=>async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(output)}}]}));
 const result=await runVision('qwen',model,undefined,'outfit',{},response(profile));
 assert.ok('garments' in result);
 assert.deepEqual(result.garments,profile.garments);assert.deepEqual(result.colors,profile.colors);
 await assert.rejects(()=>runVision('qwen',model,undefined,'outfit',{},response({...profile,fragranceIds:['unowned-bottle']})),/unclear/i);
});
test('hosted quota and provider errors disclose no response data and never trigger another destination',async t=>{
 hosted(t);let calls=0;
 const fake:typeof fetch=async()=>{calls++;return new Response('synthetic-secret-private-photo',{status:402});};
 await assert.rejects(()=>runVision('qwen',model,undefined,'outfit',{},fake),error=>error instanceof Error&&!error.message.includes('synthetic-secret'));
 assert.equal(calls,1);
});

test('hosted requests use each invocation token without a build-time token or stale cached credential',async t=>{
 hosted(t,{VERCEL_OIDC_TOKEN:undefined});
 const symbol=Symbol.for('@vercel/request-context'),target=globalThis as unknown as Record<symbol,unknown>,previous=target[symbol];
 let current=invocationToken('first');const sent:string[]=[];
 target[symbol]={get:()=>({headers:{'x-vercel-oidc-token':current}})};t.after(()=>{if(previous===undefined)delete target[symbol];else target[symbol]=previous;});
 const fake:typeof fetch=async(_url,options)=>{sent.push((options!.headers as Record<string,string>).Authorization);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(parseOutfitText('White shirt'))}}]}));};
 await runVision('qwen',model,undefined,'outfit',{},fake);const first=current;current=invocationToken('second');await runVision('qwen',model,undefined,'outfit',{},fake);
 assert.deepEqual(sent,['Bearer '+first,'Bearer '+current]);
});

test('hosted photos require current cloud consent and leave no image record by default',async t=>{
 hosted(t,{FRAGOUT_VAULT_KEY:Buffer.alloc(32,17).toString('base64')});
 const db=new Store(':memory:'),user=await db.register('Synthetic member','hosted@example.test','synthetic-password');
 const image={mime:'image/png',data:(await sharp({create:{width:8,height:8,channels:3,background:'white'}}).png().toBuffer()).toString('base64')};
 const profile=parseOutfitText('White shirt and black trousers');let calls=0;
 const previous=globalThis.fetch;globalThis.fetch=async(_url,options)=>{calls++;assert.ok(!String(options?.body).includes(user.email!));return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(profile)}}]}));};
 t.after(()=>{globalThis.fetch=previous;});
 const call=(body:unknown)=>handleAiApi(new NextRequest('https://fragout.example/api/outfit/analyze',{method:'POST'}),['outfit','analyze'],body,user,db);
 const cloudConsent={destination:'Vercel AI Gateway',model,policyVersion:'qwen-cloud-v1'};
 try{
  assert.equal((await call({provider:'qwen',image:{...image}}))?.status,409);assert.equal(calls,0);
  assert.equal((await call({provider:'qwen',image:{...image},cloudConsent:{...cloudConsent,model:'stale-model'}}))?.status,409);assert.equal(calls,0);
  const accepted=await call({provider:'qwen',image:{...image},cloudConsent});assert.equal(accepted?.status,200);assert.equal(calls,1);
  const receipt=await accepted!.json();assert.equal(receipt.model,model);assert.equal(receipt.photoRetained,false);
  assert.equal((await db.db.get<{n:number}>('SELECT count(*) AS n FROM private_photos'))?.n,0);
  assert.equal((await call({provider:'qwen',text:'White shirt and black trousers'}))?.status,200);assert.equal(calls,1);
 }finally{await db.close();}
});

test('hosted status exposes destination metadata without deployment credentials and quota stops calls',async t=>{
 hosted(t,{FRAGOUT_VAULT_KEY:Buffer.alloc(32,17).toString('base64')});
 const db=new Store(':memory:'),user=await db.register('Synthetic member','quota@example.test','synthetic-password');
 try{
  const status=await handleAiApi(new NextRequest('https://fragout.example/api/ai/status'),['ai','status'],undefined,user,db);
  const metadata=await status!.json();assert.equal(metadata.qwen.mode,'hosted');assert.equal(metadata.qwen.model,model);
  assert.ok(!JSON.stringify(metadata).includes(syntheticToken));
  for(let i=0;i<10;i++)assert.ok(await db.limit('hosted-vision-user:'+user.id,10,86400000));
  const image={mime:'image/png',data:(await sharp({create:{width:8,height:8,channels:3,background:'white'}}).png().toBuffer()).toString('base64')};
  let calls=0;const previous=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw new Error('Quota must prevent transport.');};t.after(()=>{globalThis.fetch=previous;});
  const denied=await handleAiApi(new NextRequest('https://fragout.example/api/outfit/analyze',{method:'POST'}),['outfit','analyze'],{provider:'qwen',image,cloudConsent:{destination:'Vercel AI Gateway',model,policyVersion:'qwen-cloud-v1'}},user,db);
  assert.equal(denied?.status,429);assert.equal(calls,0);assert.equal((await db.db.get<{n:number}>('SELECT count(*) AS n FROM private_photos'))?.n,0);
 }finally{await db.close();}
});

test('revoking the session or changing provider during OCR prevents every later cloud upload',async t=>{
 hosted(t);
 for(const status of [401,409]){
  let release!:(value:string[])=>void,started!:()=>void;const entered=new Promise<void>(resolve=>{started=resolve;});
  const readings=new Promise<string[]>(resolve=>{release=resolve;});
  const require=createRequire(new URL('../src/lib/providers.ts',import.meta.url)),module={exports:{} as Record<string,any>};
  const source=readFileSync(new URL('../src/lib/providers.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{module,exports:module.exports,process,Buffer,AbortSignal,Response,fetch,require:(name:string)=>name==='./bottle-label-ocr.ts'?{readBottleLabel:()=>{started();return readings;}}:require(name)});
  let allowed=true,calls=0;
  const fake:typeof fetch=async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:'{"candidates":[]}'}}]}));};
  const pending=module.exports.runVision('qwen',model,undefined,'bottle',{image:{mime:'image/jpeg',data:'synthetic'}},fake,async()=>{if(!allowed)throw new module.exports.ProviderError('Authorization changed.',status);});
  await entered;allowed=false;release(['Ambiguous synthetic label']);
  await assert.rejects(()=>pending,error=>(error as {status?:number}).status===status);assert.equal(calls,0);
 }
});
