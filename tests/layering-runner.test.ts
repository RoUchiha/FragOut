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
 const row={id:'c',inputSha256:input.inputSha256,output:{combos:[{a:'a',b:'b',noteA:'Sage',noteB:'Sage',why:'An experimental direction.'}],message:'Experimental'}};
 return {'reference-input.json':{version:1,snapshotSha256,cases:[input],qwenRepeats:['c'],parameters:{temperature:0}},'qwen-results.json':{model:LOCAL_MODEL,modelDigest:'0'.repeat(64),route:'local-ollama',parameters:{temperature:0},finishedAt:'2026-11-21T00:00:00Z',cases:[row],repeats:[{...row,id:'repeat-c',repeatOf:'c'}]},'sol61-reference.json':{model:'gpt-6.1-sol',route:'session-reference',cases:[row]},'oracle.json':{snapshotSha256,snapshots,cases:[{id:'c',collection,context,eligiblePairs:eligiblePairs(collection,context)}]}};
}
async function run(files:ReturnType<typeof fixtures>){
 await vm.runInNewContext('(async()=>{'+source+'})()',{
  assert,resolve,join,createHash,inputFingerprint,eligiblePairs,evaluateLayering,compareLayering,LOCAL_MODEL,JSON,
  process:{argv:['node','compare-layering.mjs','score','memory-only']},console:{log:()=>{}},
  readFile:async(path:string)=>{for(const [name,value] of Object.entries(files))if(path.endsWith(name))return JSON.stringify(value);throw new Error('Unexpected read');},writeFile:async()=>{},
 });
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
