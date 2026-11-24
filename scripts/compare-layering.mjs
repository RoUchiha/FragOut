import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareLayering} from './layering-fixtures.mjs';
import {inputFingerprint} from './model-evaluation.ts';
import {eligiblePairs,evaluateLayering,compareLayering} from './layering-evaluation.ts';
import {qwenRuntime} from '../src/lib/qwen-runtime.ts';
import {localModelUrl} from '../src/lib/security.ts';
import {LOCAL_MODEL} from '../src/lib/providers.ts';

const [command,directoryArg]=process.argv.slice(2);
assert.ok(directoryArg&&['prepare','qwen','score'].includes(command),'Usage: node --experimental-strip-types scripts/compare-layering.mjs prepare|qwen|score NEW_OUTPUT_DIRECTORY');
const directory=resolve(directoryArg),load=async name=>JSON.parse(await readFile(join(directory,name),'utf8')),save=(name,value)=>writeFile(join(directory,name),JSON.stringify(value,null,2)+'\n');
if(command==='prepare'){console.log(JSON.stringify(await prepareLayering(directory)));process.exit(0);}
const manifest=await load('reference-input.json');assert.equal(manifest.version,1);
assert.equal(new Set(manifest.cases.map(c=>c.id)).size,manifest.cases.length);
for(const item of manifest.cases)assert.equal(inputFingerprint(item),item.inputSha256,'Input fingerprint mismatch: '+item.id);
if(command==='qwen'){
 assert.equal(qwenRuntime().mode,'local','Only local inference is authorized by this runner.');assert.equal(manifest.model,LOCAL_MODEL);
 try{await readFile(join(directory,'qwen-results.json'));throw new Error('Results already exist; choose a fresh run.');}catch(error){if(error.code!=='ENOENT')throw error;}
 const base=localModelUrl(),meta=await fetch(base+'/api/version',{redirect:'error',signal:AbortSignal.timeout(5000)}).then(r=>r.json()),tags=await fetch(base+'/api/tags',{redirect:'error',signal:AbortSignal.timeout(5000)}).then(r=>r.json());
 const modelDigest=tags.models?.find(m=>m.name===LOCAL_MODEL)?.digest;assert.ok(modelDigest,'Exact installed weights must be recorded.');
 const result={version:1,model:LOCAL_MODEL,modelDigest,ollamaVersion:meta.version,route:'local-ollama',parameters:manifest.parameters,startedAt:new Date().toISOString(),cases:[],repeats:[]};
 const queue=[...manifest.cases,...manifest.qwenRepeats.map(id=>({...manifest.cases.find(c=>c.id===id),repeatOf:id,id:'repeat-'+id}))];
 for(const item of queue){
  const row={id:item.id,inputSha256:item.inputSha256,...(item.repeatOf?{repeatOf:item.repeatOf}:{})},start=Date.now();
  try{
   const body={model:LOCAL_MODEL,stream:false,think:false,keep_alive:manifest.parameters.keep_alive,format:item.schema,options:{temperature:manifest.parameters.temperature,num_ctx:manifest.parameters.num_ctx,num_predict:manifest.parameters.num_predict},messages:[{role:'system',content:item.instructions},{role:'user',content:item.text}]};
   assert.equal(inputFingerprint({task:item.task,kind:item.kind,instructions:body.messages[0].content,text:body.messages[1].content,schema:body.format}),item.inputSha256,'Actual request fingerprint mismatch.');
   const response=await fetch(base+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(150000)});
   if(!response.ok)throw new Error('local_http_'+response.status);
   const data=await response.json();row.rawText=data.message?.content??'';row.output=JSON.parse(row.rawText);row.finishReason=data.done_reason;
   row.tokens={prompt:data.prompt_eval_count,output:data.eval_count};row.timing={totalMs:Date.now()-start,loadMs:Number(data.load_duration??0)/1e6,evalMs:Number(data.eval_duration??0)/1e6};
  }catch(error){row.error=error instanceof SyntaxError?'invalid_json':String(error.message).slice(0,160);}
  row.elapsedMs=Date.now()-start;(item.repeatOf?result.repeats:result.cases).push(row);await save('qwen-results.json',result);
  console.log(JSON.stringify({id:item.id,elapsedMs:row.elapsedMs,error:row.error??null,tokens:row.tokens}));
 }
 result.finishedAt=new Date().toISOString();await save('qwen-results.json',result);process.exit([...result.cases,...result.repeats].some(c=>c.error!==undefined)?1:0);
}
const qwen=await load('qwen-results.json'),reference=await load('sol61-reference.json'),oracle=await load('oracle.json');
assert.equal(qwen.model,LOCAL_MODEL);assert.equal(reference.model,'gpt-6.1-sol');assert.equal(reference.route,'session-reference');assert.equal(oracle.snapshotSha256,manifest.snapshotSha256);
assert.ok(qwen.finishedAt&&Number.isFinite(Date.parse(qwen.finishedAt)),'Qwen run must be complete with a finished timestamp.');
assert.equal(qwen.route,'local-ollama');assert.match(qwen.modelDigest,/^[a-f0-9]{64}$/);assert.deepEqual(qwen.parameters,manifest.parameters);
assert.equal(createHash('sha256').update(JSON.stringify(oracle.snapshots)).digest('hex'),manifest.snapshotSha256,'Catalog snapshot changed after preparation.');
assert.equal(qwen.repeats.length,manifest.qwenRepeats.length,'Planned repeat coverage is incomplete.');
assert.equal(new Set(qwen.repeats.map(c=>c.id)).size,qwen.repeats.length,'Duplicate repeat IDs.');
assert.equal(JSON.stringify(qwen.repeats.map(c=>c.repeatOf).sort()),JSON.stringify([...manifest.qwenRepeats].sort()),'Planned repeat identities changed.');
for(const rows of [qwen.cases,reference.cases,oracle.cases])assert.equal(new Set(rows.map(c=>c.id)).size,rows.length,'Duplicate case IDs.');
assert.equal(qwen.cases.length,manifest.cases.length);assert.equal(reference.cases.length,manifest.cases.length);
const cases=manifest.cases.map(item=>{
 const qa=qwen.cases.find(c=>c.id===item.id),ra=reference.cases.find(c=>c.id===item.id),gold=oracle.cases.find(c=>c.id===item.id);assert.ok(qa&&ra&&gold);
 assert.equal(qa.inputSha256,item.inputSha256);assert.equal(ra.inputSha256,item.inputSha256);
 assert.deepEqual(eligiblePairs(gold.collection,gold.context),gold.eligiblePairs,'Oracle drift.');
 const facts=JSON.parse(item.text);assert.deepEqual(facts.collection,gold.collection);assert.deepEqual(facts.constraints,gold.context);
 const a=evaluateLayering(qa.output,gold.collection,gold.context),b=evaluateLayering(ra.output,gold.collection,gold.context);
 return {id:item.id,request:facts.request,inputSha256:item.inputSha256,collection:gold.collection,constraints:gold.context,qwenOutput:qa.output,referenceOutput:ra.output,qwenError:qa.error,referenceError:ra.error,qwen:a,reference:b,comparison:compareLayering(a,b),qwenMs:qa.timing?.totalMs,qwenTokens:qa.tokens,qwenFinishReason:qa.finishReason,claimReviewFlags:{qwen:flags(qa.output),reference:flags(ra.output)}};
});
function flags(output){
 if(!Array.isArray(output?.combos))return [];
 return output.combos.flatMap(c=>typeof c?.why==='string'&&/\b(?:hours?|lasts?|longevity|guarantee\w*|proven|verified|fragrantica|clinically|cures?|treats?|compliments?|popular|community)\b/i.test(c.why)?[c.why]:[]);
}
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0,discretionary=cases.filter(c=>c.comparison.discretionary);
const similarity={discretionaryCases:discretionary.length,meanOverlapAt3:mean(discretionary.map(c=>c.comparison.overlapAt3)),meanReturnedSetJaccard:mean(discretionary.map(c=>c.comparison.returnedSetJaccard??0)),anySharedRate:mean(discretionary.map(c=>Number(c.comparison.anySame))),topOneRate:mean(discretionary.map(c=>Number(c.comparison.topOneSame)))};
function compliance(model){return {schema:cases.filter(c=>c[model].schemaValid).length,constraints:cases.filter(c=>c[model].constraintsValid).length,notes:cases.filter(c=>c[model].notesValid).length,commaListGrounded:cases.filter(c=>c[model].commaListGrounded).length,coverage:cases.filter(c=>c[model].coverageValid).length,controlAbstention:cases.filter(c=>c[model].expectedSlots===0&&c[model].abstentionValid).length,controlCount:cases.filter(c=>c[model].expectedSlots===0).length,executionErrors:cases.filter(c=>c[model+'Error']!==undefined).length};}
const qc=compliance('qwen'),rc=compliance('reference'),count=cases.length;
const checks={overlap:similarity.meanOverlapAt3>=2/3,anyShared:similarity.anySharedRate>=.75,qwenCompliance:qc.schema===count&&qc.constraints===count&&qc.notes===count&&qc.coverage===count&&qc.controlAbstention===qc.controlCount&&qc.executionErrors===0,referenceCompliance:rc.schema===count&&rc.constraints===count&&rc.notes===count&&rc.coverage===count&&rc.controlAbstention===rc.controlCount&&rc.executionErrors===0};
const repeats=qwen.repeats.map(row=>{
 const original=cases.find(c=>c.id===row.repeatOf);assert.ok(original);assert.equal(row.inputSha256,original.inputSha256);
 return {id:row.id,repeatOf:row.repeatOf,output:row.output,error:row.error,elapsedMs:row.elapsedMs,tokens:row.tokens,finishReason:row.finishReason,sameRawOutput:JSON.stringify(row.output)===JSON.stringify(original.qwenOutput),evaluation:evaluateLayering(row.output,original.collection,original.constraints),comparison:compareLayering(original.qwen,evaluateLayering(row.output,original.collection,original.constraints))};
});
const times=qwen.cases.map(c=>c.timing?.totalMs).filter(Number.isFinite).sort((a,b)=>a-b);
const middle=Math.floor(times.length/2),medianMs=times.length?(times.length%2?times[middle]:(times[middle-1]+times[middle])/2):undefined;
const report={version:1,at:new Date().toISOString(),protocol:{preparedAt:manifest.createdAt,instructions:manifest.cases[0].instructions,schema:manifest.cases[0].schema,snapshotSha256:manifest.snapshotSha256,parameters:manifest.parameters,criteria:{meanOverlapAt3:2/3,anySharedRate:.75,fullCompliance:true},scope:'Direct offline text proposals; production layering behavior unchanged.'},qwen:{model:qwen.model,modelDigest:qwen.modelDigest,ollamaVersion:qwen.ollamaVersion,startedAt:qwen.startedAt,finishedAt:qwen.finishedAt,compliance:qc,timing:{medianMs,p95Ms:times[Math.ceil(times.length*.95)-1]}},reference:{model:reference.model,route:reference.route,createdAt:reference.createdAt,compliance:rc},similarity,acceptance:{checks,passed:Object.values(checks).every(Boolean)},cases,repeats,caveats:['Small controlled closed-book catalog snapshot; not an olfactory trial.','Reference is a session model, not an OpenAI API or comparable sampling/latency test.','Forced/empty controls and repeats do not inflate primary similarity.','Returned-set Jaccard compares eligible returned pairs; invalid selections are excluded from its union but fail constraint compliance.','The prompt allows fewer than three; slot completeness is a conservative comparison target, not a safety/schema violation.','Single-note contract failures are distinct from the diagnostic for comma-separated supplied notes.','Unsupported note means absent from supplied snapshot, not necessarily false in the real fragrance.','Hosted 27B and real user data were not used.']};
await save('comparison-report.json',report);console.log(JSON.stringify({...report,cases:undefined,repeats:undefined},null,2));
if(!report.acceptance.passed)process.exitCode=1;
