import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,join} from 'node:path';
import vm from 'node:vm';
import {inputFingerprint} from '../scripts/model-evaluation.ts';
import {eligiblePairs,evaluateLayering,compareLayering} from '../scripts/layering-evaluation.ts';
import {LOCAL_MODEL} from '../src/lib/providers.ts';

const source=readFileSync(new URL('../scripts/compare-layering.mjs',import.meta.url),'utf8').split('\n').filter(line=>!line.startsWith('import ')).join('\n');
function fixtures(){
 const collection=['a','b'].map(id=>({id,variantId:id,brand:'Synthetic',name:id,concentration:'EDP',notes:['Sage'],strength:1,ownership:'OWNED',profileKnown:true,available:true}));
 const context={occasion:'GENERAL',policy:'FREE',maxStrength:3,excludedNotes:[],excludedIds:[],rejectedPairs:[],evidenceOnly:false};
 const item={id:'c',task:'layering',kind:'text',instructions:'Test task.',text:JSON.stringify({collection,constraints:context,request:'Test request'}),schema:{type:'object'}};
 const input={...item,inputSha256:inputFingerprint(item)},snapshots=[{catalog:'synthetic fixture'}],snapshotSha256=createHash('sha256').update(JSON.stringify(snapshots)).digest('hex');
 const row={id:'c',inputSha256:input.inputSha256,output:{combos:[{a:'a',b:'b',noteA:'Sage',noteB:'Sage',why:'An experimental direction.'}],message:'Experimental'},timing:{totalMs:10}};
 return {'reference-input.json':{version:1,model:LOCAL_MODEL,snapshotSha256,cases:[input],qwenRepeats:['c'],parameters:{temperature:0}},'qwen-results.json':{model:LOCAL_MODEL,modelDigest:'0'.repeat(64),route:'local-ollama',parameters:{temperature:0},finishedAt:'2026-11-21T00:00:00Z',cases:[row],repeats:[{...row,id:'repeat-c',repeatOf:'c'}]},'sol61-reference.json':{model:'gpt-6.1-sol',route:'session-reference',cases:[row]},'oracle.json':{snapshotSha256,snapshots,cases:[{id:'c',collection,context,eligiblePairs:eligiblePairs(collection,context)}]}};
}
async function run(files:Partial<ReturnType<typeof fixtures>>,command='score',transport?:typeof fetch){
 let report:any;
 const mockProcess={argv:['node','compare-layering.mjs',command,'memory-only'],exitCode:0,exit:(code:number)=>{throw {runnerExit:true,code};}};
 try{await vm.runInNewContext('(async()=>{'+source+'})()',{
  assert,resolve,join,createHash,inputFingerprint,eligiblePairs,evaluateLayering,compareLayering,LOCAL_MODEL,JSON,Response,AbortSignal,
  process:mockProcess,console:{log:()=>{}},fetch:transport,qwenRuntime:()=>({mode:'local'}),localModelUrl:()=> 'http://127.0.0.1:11434',
  readFile:async(path:string)=>{for(const [name,value] of Object.entries(files))if(path.endsWith(name))return JSON.stringify(value);throw Object.assign(new Error('Missing fixture'),{code:'ENOENT'});},writeFile:async(_path:string,data:string)=>{report=JSON.parse(data);},
 });}catch(error){if(!error||typeof error!=='object'||!('runnerExit' in error)||error.runnerExit!==true||!('code' in error)||typeof error.code!=='number')throw error;mockProcess.exitCode=error.code;}
 return {report,exitCode:mockProcess.exitCode};
}

test('layering scorer refuses an unfinished run or missing planned repeat',async()=>{
 const unfinished=fixtures();delete (unfinished['qwen-results.json'] as any).finishedAt;
 await assert.rejects(()=>run(unfinished),/complete|finished/i);
 const partial=fixtures();partial['qwen-results.json'].repeats=[];
 await assert.rejects(()=>run(partial),/repeat|complete/i);
});

test('layering scorer rejects a catalog snapshot changed after preparation',async()=>{
 const changed=fixtures();changed['oracle.json'].snapshots[0].catalog='changed';
 await assert.rejects(()=>run(changed),/snapshot/i);
});

test('schema-invalid model output is reported as failure rather than crashing claim scanning',async()=>{
 for(const output of [{combos:{},message:'invalid'},{combos:[null],message:'invalid'}]){
  const files=fixtures();files['qwen-results.json'].cases[0].output=output as any;
  const result=await run(files);
  assert.equal(result.report.qwen.compliance.schema,0);assert.equal(result.report.acceptance.passed,false);
  assert.deepEqual(result.report.cases[0].claimReviewFlags.qwen,[]);assert.equal(result.exitCode,1);
 }
});

test('elapsed median averages both middle observations for even-sized samples',async()=>{
 const files=fixtures();
 files['reference-input.json'].cases.push({...files['reference-input.json'].cases[0],id:'c2'});
 files['qwen-results.json'].cases.push({...files['qwen-results.json'].cases[0],id:'c2',timing:{totalMs:30}});
 files['sol61-reference.json'].cases.push({...files['sol61-reference.json'].cases[0],id:'c2'});
 files['oracle.json'].cases.push({...files['oracle.json'].cases[0],id:'c2'});
 assert.equal((await run(files)).report.qwen.timing.medianMs,20);
});

test('all local model requests reject redirects, including metadata GETs',async()=>{
 const files=fixtures(),output=files['sol61-reference.json'].cases[0].output,paths:string[]=[];
 delete (files as Partial<typeof files>)['qwen-results.json'];
 const transport:typeof fetch=async(input,options)=>{
  const path=new URL(String(input)).pathname;paths.push(path);assert.equal(options?.redirect,'error');
  const body=path==='/api/version'?{version:'test'}:path==='/api/tags'?{models:[{name:LOCAL_MODEL,digest:'0'.repeat(64)}]}:{message:{content:JSON.stringify(output)},done_reason:'stop'};
  return new Response(JSON.stringify(body));
 };
 assert.equal((await run(files,'qwen',transport)).exitCode,0);
 assert.deepEqual(paths,['/api/version','/api/tags','/api/chat','/api/chat']);
});
