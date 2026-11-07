import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildProviderRequest,runVision,prepareImage,ProviderError} from '../src/lib/providers.ts';
import {parseOutfitText} from '../src/lib/outfit.ts';
import sharp from 'sharp';
const profile=parseOutfitText('White shirt and black trousers');

test('local vision unloads context and cloud requests do not enable response or prompt storage',()=>{
 const qwen=buildProviderRequest('qwen','synthetic',undefined,'outfit',{text:'white shirt'});
 assert.equal(qwen.body.keep_alive,0);
 assert.equal(buildProviderRequest('openai','synthetic','synthetic-key','outfit',{text:'shirt'}).body.store,false);
 assert.ok(!JSON.stringify(buildProviderRequest('claude','synthetic','synthetic-key','outfit',{text:'shirt'}).body).includes('cache_control'));
});

test('image preprocessing strips original EXIF and camera metadata',async()=>{
 const source=await sharp({create:{width:8,height:6,channels:3,background:'#829b62'}}).jpeg().withMetadata({exif:{IFD0:{Artist:'synthetic-private-photo-metadata'}}}).toBuffer();
 assert.ok((await sharp(source).metadata()).exif);
 const prepared=await prepareImage({mime:'image/jpeg',data:source.toString('base64')}),bytes=Buffer.from(prepared.data,'base64'),metadata=await sharp(bytes).metadata();
 assert.equal(metadata.exif,undefined);assert.equal(metadata.icc,undefined);assert.equal(metadata.xmp,undefined);assert.ok(!bytes.includes(Buffer.from('synthetic-private-photo-metadata')));
});

test('image validation errors produce a reviewable client error, not a server failure',async()=>{
 await assert.rejects(()=>prepareImage({mime:'image/png',data:Buffer.from('bad photo').toString('base64')}),e=>e instanceof ProviderError&&e.status===400);
});
test('each provider has a fixed destination and keys never appear in request URLs',()=>{
 for(const p of ['qwen','openai','claude'] as const){const r=buildProviderRequest(p,'test-model','test-secret','outfit',{text:'white shirt'});assert.ok(!r.url.includes('test-secret'));assert.equal(r.body.model,'test-model');if(p==='qwen'){assert.ok(r.url.startsWith('http://127.0.0.1:'));assert.ok(!JSON.stringify(r.headers).includes('test-secret'));}else assert.ok(r.url.startsWith(p==='openai'?'https://api.openai.com/':'https://api.anthropic.com/'));}
});
test('all adapters validate structured clothing output',async()=>{
 const responses={qwen:{message:{content:JSON.stringify(profile)}},openai:{output:[{content:[{type:'output_text',text:JSON.stringify(profile)}]}]},claude:{content:[{type:'tool_use',name:'describe_outfit',input:profile}]}};
 for(const p of ['qwen','openai','claude'] as const){const fake=(async()=>new Response(JSON.stringify(responses[p]),{status:200})) as typeof fetch;const result=await runVision(p,'test-model','test-secret','outfit',{text:'white shirt'},fake);assert.deepEqual(result,profile);}
});
test('malformed model output and injected product IDs are rejected',async()=>{
 const fake=(async()=>new Response(JSON.stringify({message:{content:JSON.stringify({...profile,fragranceIds:['unowned']})}}))) as typeof fetch;
 await assert.rejects(()=>runVision('qwen','test',undefined,'outfit',{text:'shirt'},fake),/unclear result/);
});
test('provider failure cannot spill provider response content or silently call a paid fallback',async()=>{
 let calls=0;const fake=(async()=>{calls++;return new Response('secret-key-and-private-data',{status:401});}) as typeof fetch;
 await assert.rejects(()=>runVision('qwen','test',undefined,'outfit',{text:'shirt'},fake),e=>e instanceof Error&&!e.message.includes('secret-key'));
 assert.equal(calls,1);
});
