import {test,type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {qwenRuntime} from '../src/lib/qwen-runtime.ts';
import {buildProviderRequest,runVision} from '../src/lib/providers.ts';
import {parseOutfitText} from '../src/lib/outfit.ts';
import {handleAiApi} from '../src/lib/ai-api.ts';
import {Store} from '../src/lib/store.ts';
import {NextRequest} from 'next/server.js';
import sharp from 'sharp';
const model='qwen/qwen3.8-27b';
function free(t:TestContext,extra:Record<string,string|undefined>={}){
 const values={FRAGOUT_ENVIRONMENT:'production',FRAGOUT_QWEN_BACKEND:'auto',FRAGOUT_PAID_AI_ENABLED:undefined,GROQ_API_KEY:'synthetic-groq-key',FRAGOUT_GROQ_FREE_CONFIRMED:'true',FRAGOUT_GROQ_ZDR_CONFIRMED:'true',...extra};
 const previous=Object.fromEntries(Object.keys(values).map(key=>[key,process.env[key]]));
 for(const [key,value] of Object.entries(values)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 t.after(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
}
test('free Qwen is the hosted default and a stale gateway preference cannot bypass the paid off switch',t=>{
 free(t,{FRAGOUT_QWEN_BACKEND:'gateway'});
 const runtime=qwenRuntime();assert.equal(runtime.model,model);assert.equal(runtime.destination,'Groq');assert.equal(runtime.configured,true);
 const request=buildProviderRequest('qwen',model,'synthetic-groq-key','outfit',{text:'white shirt'});
 assert.equal(request.url,'https://api.groq.com/openai/v1/chat/completions');assert.equal(request.headers.Authorization,'Bearer synthetic-groq-key');
 assert.ok(!JSON.stringify(request.body).includes('synthetic-groq-key'));assert.equal(request.body.model,model);
});
test('free photo processing requires confirmed free account and zero-retention controls',async t=>{
 free(t,{FRAGOUT_GROQ_ZDR_CONFIRMED:undefined});let calls=0;
 const fake:typeof fetch=async()=>{calls++;return new Response('{}');};
 await assert.rejects(()=>runVision('qwen',model,undefined,'outfit',{},fake));assert.equal(calls,0);
 process.env.FRAGOUT_GROQ_ZDR_CONFIRMED='true';delete process.env.FRAGOUT_GROQ_FREE_CONFIRMED;
 await assert.rejects(()=>runVision('qwen',model,undefined,'outfit',{},fake));assert.equal(calls,0);
});
test('free quota failure never tries a paid provider even when a deployment credential exists',async t=>{
 free(t,{VERCEL_OIDC_TOKEN:'must-not-use-this-token'});const urls:string[]=[];
 const fake:typeof fetch=async(url)=>{urls.push(String(url));return new Response('synthetic-private-data',{status:429});};
 await assert.rejects(()=>runVision('qwen',model,undefined,'outfit',{},fake),error=>error instanceof Error&&!error.message.includes('synthetic-private-data'));
 assert.deepEqual(urls,['https://api.groq.com/openai/v1/chat/completions']);
});
test('free Qwen clothing output is validated without requesting fragrance facts',async t=>{
 free(t);const profile=parseOutfitText('White shirt and navy trousers');
 const fake:typeof fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(profile)}}]}));
 const result=await runVision('qwen',model,undefined,'outfit',{},fake);assert.ok('garments' in result);assert.deepEqual(result.garments,profile.garments);
});
test('only the exact paid-on flag selects paid Qwen; off returns to free without removing credentials',t=>{
 free(t,{FRAGOUT_PAID_AI_ENABLED:'TRUE'});assert.equal(qwenRuntime().model,model);
 process.env.FRAGOUT_PAID_AI_ENABLED='true';assert.equal(qwenRuntime().model,'alibaba/qwen3.8-27b');
 process.env.FRAGOUT_PAID_AI_ENABLED='false';assert.equal(qwenRuntime().model,model);assert.equal(process.env.GROQ_API_KEY,'synthetic-groq-key');
});
test('app users cannot turn on paid mode and the free installation quota stops further uploads',async t=>{
 free(t,{FRAGOUT_VAULT_KEY:Buffer.alloc(32,19).toString('base64')});
 const db=new Store(':memory:'),user=await db.register('Synthetic free member','free@example.test','synthetic-password');
 const image={mime:'image/png',data:(await sharp({create:{width:8,height:8,channels:3,background:'white'}}).png().toBuffer()).toString('base64')};
 let calls=0;const previous=globalThis.fetch;globalThis.fetch=async url=>{assert.equal(String(url),'https://api.groq.com/openai/v1/chat/completions');calls++;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(parseOutfitText('White shirt'))}}]}));};
 t.after(()=>{globalThis.fetch=previous;});
 const input={provider:'qwen',cloudConsent:{destination:'Groq',model,policyVersion:'qwen-groq-free-v1'}};
 const call=(extra:object={})=>handleAiApi(new NextRequest('https://fragout.example/api/outfit/analyze',{method:'POST'}),['outfit','analyze'],{...input,image:{...image},...extra},user,db);
 try{
  assert.equal((await call({paidEnabled:true}))?.status,400);assert.equal(calls,0);
  assert.equal((await call())?.status,200);assert.equal((await call())?.status,200);assert.equal(calls,2);
  assert.equal((await call())?.status,429);assert.equal(calls,2);assert.equal(qwenRuntime().model,model);
  assert.equal((await db.db.get<{n:number}>('SELECT count(*) AS n FROM private_photos'))?.n,0);
 }finally{await db.close();}
});

test('malformed photos are rejected before hosted availability and consent checks without a provider request',async t=>{
 free(t,{GROQ_API_KEY:undefined,FRAGOUT_VAULT_KEY:Buffer.alloc(32,21).toString('base64')});
 const db=new Store(':memory:'),user=await db.register('Synthetic validation member','validation@example.test','synthetic-password');
 let calls=0;const previous=globalThis.fetch;globalThis.fetch=async()=>{calls++;throw new Error('No provider request allowed.');};
 t.after(()=>{globalThis.fetch=previous;});
 try{
  const response=await handleAiApi(new NextRequest('https://fragout.example/api/outfit/analyze',{method:'POST'}),['outfit','analyze'],{provider:'qwen',image:{mime:'image/png',data:Buffer.from('bad photo').toString('base64')}},user,db);
  assert.equal(response?.status,400);assert.equal(calls,0);
 }finally{await db.close();}
});
