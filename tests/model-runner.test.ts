import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {evaluateOutfit,acceptance,inputFingerprint} from '../scripts/model-evaluation.ts';
import {buildProviderRequest,bottleVisionText,LOCAL_MODEL} from '../src/lib/providers.ts';
import {parseOutfitText,rankForOutfit} from '../src/lib/outfit.ts';
import {modelBottleSchema,groundedBottleCandidates} from '../src/lib/bottle-label.ts';
import {demoBottles,defaultContext,defaultPreferences} from '../src/lib/seed.ts';

// Exercise the actual CLI without model/network/file mutations. Only its I/O is
// replaced; request construction, scoring, guards and recommendations stay real.
const source=readFileSync(new URL('../scripts/compare-vision.mjs',import.meta.url),'utf8').split('\n').filter(line=>!line.startsWith('import ')).join('\n');
const bytes=Buffer.from('synthetic image bytes; transport is mocked');
function fixture(task:'outfit'|'bottle'='outfit',changes:Record<string,unknown>={}){
 const readings=task==='bottle'?['TEST ATELIER\nBODY MIST']:undefined;
 const request=buildProviderRequest('qwen',LOCAL_MODEL,undefined,task,{text:task==='bottle'?bottleVisionText(undefined,readings!):undefined});
 const messages=request.body.messages as {content:string}[];
 const item={id:'c01',task,kind:'image',imagePath:'c01.jpg',imageSha256:createHash('sha256').update(bytes).digest('hex'),instructions:messages[0].content,text:messages[1].content,schema:request.body.format,ocrReadings:readings,...changes};
 return {...item,inputSha256:inputFingerprint(item)};
}
async function run(command:string,files:Record<string,unknown>,extraArgs:string[]=[]){
 const writes:Record<string,any>={},state={modelCalls:0,ocrCalls:0,exitCode:0};
 const mockProcess={argv:['node','compare-vision.mjs',command,'memory-only',...extraArgs],exitCode:0,exit:(code:number)=>{throw {completed:true,code};}};
 try{
  await vm.runInNewContext('(async()=>{'+source+'})()',{
   assert,resolve,join,createHash,inputFingerprint,LOCAL_MODEL,buildProviderRequest,bottleVisionText,evaluateOutfit,acceptance,modelBottleSchema,groundedBottleCandidates,parseOutfitText,rankForOutfit,demoBottles,defaultContext,defaultPreferences,Buffer,Response,AbortSignal,
   console:{log:()=>{}},process:mockProcess,qwenRuntime:()=>({mode:'local'}),localModelStatus:async()=>({installed:true}),localModelUrl:()=> 'http://127.0.0.1:11434',
   readBottleLabel:async()=>{state.ocrCalls++;throw new Error('OCR must not run a second time.');},
   fetch:async(url:string)=>{
    if(url.endsWith('/api/version'))return new Response(JSON.stringify({version:'mock'}));
    if(url.endsWith('/api/tags'))return new Response(JSON.stringify({models:[{name:LOCAL_MODEL,digest:'same-weights'}]}));
    state.modelCalls++;return new Response(JSON.stringify({message:{content:'{"candidates":[]}'}}));
   },
   readFile:async(path:string)=>{
    if(path.endsWith('c01.jpg'))return Buffer.from(bytes);
    for(const [name,value] of Object.entries(files))if(path.endsWith(name))return JSON.stringify(value);
    throw Object.assign(new Error('Missing fixture'),{code:'ENOENT'});
   },writeFile:async(path:string,data:string)=>{writes[path]=JSON.parse(data);},
  });
 }catch(error){if(!(error&&typeof error==='object'&&'completed' in error))throw error;}
 state.exitCode=mockProcess.exitCode;return {state,writes};
}
const manifest=(item:ReturnType<typeof fixture>)=>({version:1,qwenModel:LOCAL_MODEL,cases:[item]});

test('runner rejects changed live instructions or schema before inference',async()=>{
 for(const change of [{instructions:'stale system instruction'},{schema:{type:'stale-schema'}}]){
  const item=fixture('outfit',change);
  await assert.rejects(()=>run('qwen',{'reference-input.json':manifest(item)}),/contract|fingerprint/i);
 }
});

test('runner checks the active request contract before resuming stored rows',async()=>{
 const item=fixture('outfit',{instructions:'old system instruction'});
 const previous={model:LOCAL_MODEL,modelDigest:'same-weights',cases:[{...item,output:{}}]};
 await assert.rejects(()=>run('qwen',{'reference-input.json':manifest(item),'qwen-results.json':previous},['--resume']),/contract|fingerprint/i);
});

test('runner uses the prepared OCR evidence without a second OCR pass',async()=>{
 const item=fixture('bottle'),result=await run('qwen',{'reference-input.json':manifest(item)});
 const output=Object.values(result.writes).find(value=>value.model===LOCAL_MODEL).cases[0];
 assert.equal(result.state.modelCalls,1);assert.equal(result.state.ocrCalls,0);
 assert.deepEqual(output.readings,item.ocrReadings);assert.equal(output.error,undefined);
});

test('runner cannot pass coverage with an errored row even when its output looks valid',async()=>{
 const report=JSON.parse(readFileSync(new URL('../docs/evaluations/2026-11-21-vision.json',import.meta.url),'utf8'));
 const cases=report.cases.map((c:any)=>{
  const request=buildProviderRequest('qwen',LOCAL_MODEL,undefined,c.task,{text:c.text});
  const messages=request.body.messages as {content:string}[];
  const item={id:c.id,task:c.task,kind:c.kind,text:c.text,imageSha256:c.imageSha256,instructions:messages[0].content,schema:request.body.format,ocrReadings:c.readings};
  return {...item,inputSha256:inputFingerprint(item)};
 });
 const qwen={model:LOCAL_MODEL,route:'local-ollama',cases:report.cases.map((c:any)=>({...cases.find((x:any)=>x.id===c.id),output:c.qwenOutput,readings:c.readings,...(c.id==='c15'?{error:'Bottle label reading timed out.'}:{}),timing:{totalMs:c.qwenMs}}))};
 const reference={model:'gpt-6.1-sol',route:'session-reference',cases:report.cases.map((c:any)=>({...cases.find((x:any)=>x.id===c.id),output:c.referenceOutput}))};
 const result=await run('score',{'reference-input.json':{version:1,qwenModel:LOCAL_MODEL,cases},'qwen-results.json':qwen,'sol61-reference.json':reference,'expected.json':{cases:report.cases.map((c:any)=>({id:c.id,expected:c.expected}))}});
 const output=Object.values(result.writes)[0];
 assert.equal(output.qwen.acceptance.passed,false);assert.equal(output.qwen.acceptance.metrics.coverageComplete,false);
 assert.equal(output.cases.find((c:any)=>c.id==='c15').qwenError,'Bottle label reading timed out.');assert.equal(result.state.exitCode,1);
});
