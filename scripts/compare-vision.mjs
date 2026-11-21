import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareFixtures} from './model-fixtures.mjs';
import {evaluateOutfit,acceptance,inputFingerprint} from './model-evaluation.ts';
import {buildProviderRequest,localModelStatus,LOCAL_MODEL} from '../src/lib/providers.ts';
import {parseOutfitText,rankForOutfit} from '../src/lib/outfit.ts';
import {qwenRuntime} from '../src/lib/qwen-runtime.ts';
import {modelBottleSchema,groundedBottleCandidates} from '../src/lib/bottle-label.ts';
import {readBottleLabel} from '../src/lib/bottle-label-ocr.ts';
import {demoBottles,defaultContext,defaultPreferences} from '../src/lib/seed.ts';
import {localModelUrl} from '../src/lib/security.ts';

const [command,directoryArg]=process.argv.slice(2);
if(!directoryArg||!['prepare','qwen','score'].includes(command))throw new Error('Usage: node --experimental-strip-types scripts/compare-vision.mjs prepare|qwen|score OUTPUT_DIRECTORY');
const directory=resolve(directoryArg),load=async name=>JSON.parse(await readFile(join(directory,name),'utf8'));
const save=(name,value)=>writeFile(join(directory,name),JSON.stringify(value,null,2)+'\n');
if(command==='prepare'){console.log(JSON.stringify(await prepareFixtures(directory)));process.exit(0);}
const manifest=await load('reference-input.json');
assert.equal(manifest.version,1);assert.equal(new Set(manifest.cases.map(c=>c.id)).size,manifest.cases.length);
for(const item of manifest.cases)assert.equal(item.inputSha256,inputFingerprint(item),'Input fingerprint mismatch: '+item.id);
if(command==='qwen'){
 assert.equal(qwenRuntime().mode,'local','This runner only authorizes local Qwen, never hosted/paid inference.');
 const status=await localModelStatus();assert.ok(status.installed);assert.equal(manifest.qwenModel,LOCAL_MODEL);
 const server=await fetch(localModelUrl()+'/api/version',{signal:AbortSignal.timeout(5000)}).then(r=>r.json());
 const tags=await fetch(localModelUrl()+'/api/tags',{signal:AbortSignal.timeout(5000)}).then(r=>r.json());
 const digest=tags.models?.find(model=>model.name===LOCAL_MODEL)?.digest;assert.ok(digest,'The exact local model digest must be available.');
 const previous=await load('qwen-results.json').catch(error=>{if(error.code==='ENOENT')return null;throw error;});
 if(previous)assert.equal(previous.model,LOCAL_MODEL);
 if(previous){assert.ok(process.argv.includes('--resume'),'Results already exist. Choose a fresh directory or explicitly --resume.');assert.equal(previous.modelDigest,digest,'Cannot resume across changed or unrecorded model weights.');}
 const retained=previous?.cases.filter(row=>!row.error&&manifest.cases.some(item=>item.id===row.id&&item.inputSha256===row.inputSha256))??[];
 const result={version:1,model:LOCAL_MODEL,modelDigest:digest,route:'local-ollama',ollamaVersion:server.version,startedAt:previous?.startedAt??new Date().toISOString(),resumedAt:previous?new Date().toISOString():undefined,cases:retained};
 for(const item of manifest.cases){
  if(retained.some(row=>row.id===item.id))continue;
  const row={id:item.id,task:item.task,kind:item.kind,imageSha256:item.imageSha256,inputSha256:item.inputSha256},start=Date.now();
  try{
   if(item.kind==='typed'){row.method='offline_rules';row.output=parseOutfitText(item.text);}
   else{
    const bytes=await readFile(item.imagePath);assert.equal(createHash('sha256').update(bytes).digest('hex'),item.imageSha256);
    const image={mime:'image/jpeg',data:bytes.toString('base64')},request=buildProviderRequest('qwen',LOCAL_MODEL,undefined,item.task,{image,text:item.text});
    const response=await fetch(request.url,{method:'POST',headers:request.headers,body:JSON.stringify(request.body),redirect:'error',signal:AbortSignal.timeout(150000)});
    if(!response.ok)throw new Error('local_http_'+response.status);
    const data=await response.json();row.output=JSON.parse(data.message?.content??'');row.method='model';
    row.timing={totalMs:Date.now()-start,loadMs:Number(data.load_duration??0)/1e6,evalMs:Number(data.eval_duration??0)/1e6};
    if(item.task==='bottle'){
     const ocrStart=Date.now();row.readings=await readBottleLabel(image);row.ocrMs=Date.now()-ocrStart;
    }
    image.data='';bytes.fill(0);
   }
  }catch(error){row.error=error instanceof SyntaxError?'invalid_json':String(error.message).slice(0,180);}
  row.elapsedMs=Date.now()-start;result.cases.push(row);await save('qwen-results.json',result);
  console.log(JSON.stringify({id:item.id,method:row.method,elapsedMs:row.elapsedMs,error:row.error??null}));
 }
 result.finishedAt=new Date().toISOString();await save('qwen-results.json',result);process.exit(0);
}
const qwen=await load('qwen-results.json'),reference=await load('sol61-reference.json'),expected=await load('expected.json');
assert.equal(reference.model,'gpt-6.1-sol');assert.equal(reference.route,'session-reference');
const unique=rows=>new Set(rows.map(c=>c.id)).size===rows.length;
assert.ok(unique(qwen.cases)&&unique(reference.cases)&&unique(expected.cases),'Duplicate case IDs invalidate the comparison.');
const lookup=(rows,id)=>rows.find(row=>row.id===id),normalize=s=>s.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'').replace(/[^a-z0-9]+/g,' ').trim();
const identity=c=>normalize(c.brand)+'|'+normalize(c.name).replace(new RegExp('^'+normalize(c.brand)+' '),'');
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
const own=new Set(demoBottles.filter(b=>b.ownership==='OWNED').map(b=>b.id));
const neutralWardrobe=demoBottles.filter(b=>b.ownership==='OWNED').map(b=>({...b,rating:3,favorite:false,climate:'BALANCED',strength:2}));
function recommendations(profile,wardrobe=demoBottles){
 if(!profile)return {top:null,solo:[],combos:[]};
 const result=rankForOutfit(wardrobe,defaultContext,defaultPreferences,profile,'both','experimental',[]);
 return {top:result.solo[0]?.bottle.id??null,solo:result.solo.map(r=>r.bottle.id),combos:result.combos.map(r=>[r.a.id,r.b.id])};
}
function safeBoundaries(profile){
 if(!profile)return false;
 for(const [context,prefs] of [
  [defaultContext,defaultPreferences],[{...defaultContext,policy:'NO_FRAGRANCE'},defaultPreferences],
  [{...defaultContext,occasion:'GYM'},{...defaultPreferences,dislikedNotes:['bergamot']}],
 ]){
  const r=rankForOutfit(demoBottles,context,prefs,profile,'both','experimental',[]);
  if(context.policy==='NO_FRAGRANCE'&&(r.solo.length||r.combos.length))return false;
  const bottles=[...r.solo.map(s=>s.bottle),...r.combos.flatMap(c=>[c.a,c.b])];
  if(bottles.some(b=>!own.has(b.id)||context.occasion==='GYM'&&(b.strength!==1||b.notes.includes('bergamot'))))return false;
  if(r.combos.some(c=>c.a.variantId===c.b.variantId||c.sources.length||c.tier!=='model_hypothesis'))return false;
 }
 return true;
}
const cases=manifest.cases.map(item=>{
 const a=lookup(qwen.cases,item.id),b=lookup(reference.cases,item.id),gold=lookup(expected.cases,item.id);
 if(a)assert.equal(a.inputSha256,item.inputSha256,'Qwen prompt identity mismatch: '+item.id);
 if(b)assert.equal(b.inputSha256,item.inputSha256,'Reference prompt identity mismatch: '+item.id);
 assert.ok(gold);if(item.kind==='image'&&b)assert.equal(b.imageSha256,item.imageSha256,'Reference image identity mismatch: '+item.id);
 const record={id:item.id,task:item.task,kind:item.kind,expected:gold.expected,imageSha256:item.imageSha256,inputSha256:item.inputSha256,text:item.text,qwenOutput:a?.output,referenceOutput:b?.output,qwenError:a?.error,qwenMs:a?.timing?.totalMs};
 if(item.task==='outfit'){
  const qa=evaluateOutfit(a?.output,gold.expected),ra=evaluateOutfit(b?.output,gold.expected);
  return {...record,qwen:qa,reference:ra,qwenRecommendations:recommendations(qa.profile),referenceRecommendations:recommendations(ra.profile),qwenNeutralRecommendations:recommendations(qa.profile,neutralWardrobe),referenceNeutralRecommendations:recommendations(ra.profile,neutralWardrobe),boundariesSafe:safeBoundaries(qa.profile)&&safeBoundaries(ra.profile)};
 }
 const score=raw=>{
  const parsed=modelBottleSchema.safeParse(raw),wanted=new Set(gold.expected.candidates.map(identity));
  const grounded=parsed.success?groundedBottleCandidates(a?.readings??[],parsed.data.candidates):{candidates:[]};
  const rawIds=parsed.success?[...new Set(parsed.data.candidates.map(identity))]:[];
  return {schemaValid:parsed.success,rawExact:parsed.success&&JSON.stringify(rawIds.sort())===JSON.stringify([...wanted].sort()),
   rawRecalled:rawIds.filter(id=>wanted.has(id)).length,rawUnsupported:rawIds.filter(id=>!wanted.has(id)).length,
   grounded:grounded.candidates,unsupported:grounded.candidates.some(c=>!wanted.has(identity(c))),
   recalled:[...wanted].filter(id=>grounded.candidates.some(c=>identity(c)===id)).length,
   wanted:wanted.size};
 };
 return {...record,readings:a?.readings??[],qwen:score(a?.output),reference:score(b?.output)};
});
const imageOutfits=cases.filter(c=>c.task==='outfit'&&c.kind==='image'),positive=imageOutfits.filter(c=>c.expected.hasOutfit),negative=imageOutfits.filter(c=>!c.expected.hasOutfit),bottles=cases.filter(c=>c.task==='bottle');
const coverageComplete=qwen.cases.length===manifest.cases.length&&reference.cases.length===manifest.cases.length&&manifest.cases.every(c=>lookup(qwen.cases,c.id)&&lookup(reference.cases,c.id));
const topSoloAgreement=mean(positive.map(c=>Number(c.qwenRecommendations.top!==null&&c.qwenRecommendations.top===c.referenceRecommendations.top)));
const neutralAgreement=mean(positive.map(c=>Number(c.qwenNeutralRecommendations.top!==null&&c.qwenNeutralRecommendations.top===c.referenceNeutralRecommendations.top)));
function metrics(model){
 return {coverageComplete,schemaRate:mean(cases.map(c=>Number(c[model].schemaValid))),
  abstentionRate:mean(negative.map(c=>Number(c[model].appAbstained))),
  bottleGroundingSafe:bottles.every(c=>!c[model].unsupported),bottleRecall:bottles.reduce((n,c)=>n+c[model].recalled,0)/bottles.reduce((n,c)=>n+c[model].wanted,0),
  garmentF1:mean(positive.map(c=>c[model].garments.f1)),colorF1:mean(positive.map(c=>c[model].colors.f1)),
  topSoloAgreement:Math.min(topSoloAgreement,neutralAgreement),boundariesSafe:cases.filter(c=>c.task==='outfit').every(c=>c.boundariesSafe)};
}
function rawMetrics(model){return {outfitNegativeAbstention:mean(negative.map(c=>Number(c[model].rawAbstained))),bottleIdentityRecall:bottles.reduce((n,c)=>n+c[model].rawRecalled,0)/bottles.reduce((n,c)=>n+c[model].wanted,0),unsupportedBottleProposals:bottles.reduce((n,c)=>n+c[model].rawUnsupported,0)};}
const timings=qwen.cases.map(c=>c.timing?.totalMs).filter(Number.isFinite).sort((a,b)=>a-b);
const report={version:1,at:new Date().toISOString(),protocol:{revision:manifest.revision??1,instructions:Object.fromEntries(['outfit','bottle'].map(task=>[task,manifest.cases.find(c=>c.task===task).instructions]))},qwen:{model:qwen.model,route:qwen.route,ollamaVersion:qwen.ollamaVersion,rawMetrics:rawMetrics('qwen'),acceptance:acceptance(metrics('qwen'))},
 reference:{model:reference.model,route:reference.route,rawMetrics:rawMetrics('reference'),acceptance:acceptance(metrics('reference'))},
 counts:{total:cases.length,images:manifest.cases.filter(c=>c.kind==='image').length,typed:cases.filter(c=>c.kind==='typed').length},
 qwenTiming:{medianMs:timings[Math.floor(timings.length/2)],p95Ms:timings[Math.ceil(timings.length*.95)-1]},
 recommendationAgreement:{defaultWardrobe:topSoloAgreement,neutralWardrobe:neutralAgreement,positiveComparisons:positive.length*2},
 caveats:['Small synthetic illustration/packshot corpus; not real-selfie accuracy certification.','Reference is an agent session, not an OpenAI API sampling/latency benchmark.','Hosted Qwen3.8 27B is not tested.','Typed Qwen app cases use offline rules, not Qwen inference.','Both bottle proposals share the same real OCR grounding boundary.'],cases};
await save('comparison-report.json',report);
console.log(JSON.stringify({...report,cases:undefined},null,2));
if(!report.qwen.acceptance.passed||!report.reference.acceptance.passed)process.exitCode=1;
