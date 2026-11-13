import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildProviderRequest,runVision,prepareImage,ProviderError} from '../src/lib/providers.ts';
import {groundedBottleCandidates} from '../src/lib/bottle-label.ts';
import {readFile} from 'node:fs/promises';
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
 for(const p of ['qwen','openai','claude'] as const){const fake=(async()=>new Response(JSON.stringify(responses[p]),{status:200})) as typeof fetch;const result=await runVision(p,'test-model','test-secret','outfit',{text:'white shirt'},fake);assert.ok('garments' in result);assert.deepEqual(result.garments,profile.garments);assert.deepEqual(result.colors,profile.colors);assert.equal(result.hasOutfit,true);}
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

const replyFromQwen=(output:unknown):typeof fetch=>async()=>new Response(JSON.stringify({message:{content:JSON.stringify(output)}}));

test('outfit abstention removes unrelated photo objects and inferred style fields',async()=>{
 const result=await runVision('qwen','test',undefined,'outfit',{},replyFromQwen({
  ...profile,hasOutfit:false,garments:['bottle'],colors:['brown'],styleTags:['sporty'],summary:'A brown bottle.',
 }));
 assert.equal('hasOutfit' in result&&result.hasOutfit,false);
 assert.deepEqual('garments' in result&&result.garments,[]);
 assert.deepEqual('styleTags' in result&&result.styleTags,[]);
 assert.equal('summary' in result&&result.summary,'');
});

test('typed outfit details only use explicit garments, colors and style',async()=>{
 const input='White linen shirt and navy trousers. No hat or jacket.';
 const parsed=parseOutfitText(input);
 assert.deepEqual(parsed.garments,['shirt','trousers']);
 assert.deepEqual(parsed.colors,['white','navy']);
 assert.deepEqual(parsed.styleTags,[]);
 assert.equal(parsed.formality,'casual');
});

test('bottle results require independent label evidence and never guess concentration',async()=>{
 const guess={brand:'Dior',name:'Sauvage'};
 const fetcher=replyFromQwen({candidates:[guess,guess]});
 const photo=async(file:string)=>prepareImage({mime:'image/jpeg',data:(await readFile(new URL('../public/catalog/bottles/'+file,import.meta.url))).toString('base64')});
 const edp=await runVision('qwen','test',undefined,'bottle',{image:await photo('dior-sauvage-edp-7c860abb0e81.jpg')},replyFromQwen({candidates:[]}));
 assert.ok('candidates' in edp);
 assert.deepEqual(edp.candidates.map(c=>[c.brand,c.name,c.concentration,c.confidence]),[['Dior','Sauvage','EDP','uncertain']]);
 assert.doesNotMatch(JSON.stringify(edp),/guaranteed|perfect/i);

 const edt=await runVision('qwen','test',undefined,'bottle',{image:await photo('dior-sauvage-edt-73f6c1636540.jpg')},fetcher);
 assert.ok('candidates' in edt);
 assert.equal(edt.candidates.some(c=>c.concentration==='EDP'),false);

 const blank=await sharp({create:{width:320,height:420,channels:3,background:'#d6d6d6'}}).jpeg().toBuffer();
 const blankResult=await runVision('qwen','test',undefined,'bottle',{image:{mime:'image/jpeg',data:blank.toString('base64')}},fetcher);
 assert.ok('candidates' in blankResult);
 assert.deepEqual(blankResult.candidates,[]);
});

test('independent OCR passes can corroborate the same label without joining names across lines',()=>{
 const result=groundedBottleCandidates(['SAUVAG\nEAU DE PARFUM\nDior','SAUVAGE\nEAU DE PARFUM'],[]);
 assert.deepEqual(result.candidates.map(candidate=>[candidate.brand,candidate.name,candidate.concentration]),[['Dior','Sauvage','EDP']]);
 assert.deepEqual(groundedBottleCandidates(['SAUVAGE\nDior'],[]).candidates.map(candidate=>candidate.concentration),['UNKNOWN']);
});
