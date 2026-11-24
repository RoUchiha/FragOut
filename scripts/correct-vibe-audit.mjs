import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';

// A disclosed annotation correction, never a rerun or reranking of old outputs.
export function correctVibeAudit(snapshot,cases){
 assert.equal(snapshot.engineVersion,'1.3.0');assert.ok(!snapshot.rubricCorrection);
 const result=structuredClone(snapshot),row=result.rows.find(r=>r.id==='l03');assert.ok(row);
 assert.deepEqual(row.expectations,{primary:['f03','f05','f06','f08'],supporting:['f02']});
 assert.equal(row.bestAvailableDirection,6); // The two-primary ceiling was already available.
 const recorded=cases.find(c=>c.id==='l03');assert.ok(recorded);
 assert.ok(recorded.collection.find(b=>b.id==='f07').notes.includes('Vanilla'));
 assert.ok(recorded.collection.find(b=>b.id==='f01').notes.includes('Ambrette'));
 row.expectations={primary:['f03','f05','f06','f07','f08'],supporting:['f01','f02']};
 const variants=ids=>new Set(recorded.collection.filter(b=>ids.includes(b.id)).map(b=>b.variantId));
 const primary=variants(row.expectations.primary),supporting=variants(row.expectations.supporting);
 const direction=ids=>{const editions=ids.map(id=>{const bottle=recorded.collection.find(b=>b.id===id);assert.ok(bottle);return bottle.variantId;});return {primary:editions.filter(id=>primary.has(id)).length,supporting:editions.filter(id=>supporting.has(id)).length};};
 for(const key of ['backend','outfit','rawQwen','rawSol'])for(const pair of row[key])pair.direction=direction(pair.ids);
 const priority=pair=>pair.direction.primary*3+pair.direction.supporting;
 row.topQuality=row.backend.length?priority(row.backend[0]):0;
 row.outfitQuality=row.outfit.length?priority(row.outfit[0]):0;
 result.summary.backendBestFirst=result.rows.filter(r=>r.topQuality===r.bestAvailableDirection).length;
 result.summary.outfitBestFirst=result.rows.filter(r=>r.outfitQuality===r.bestAvailableDirection).length;
 result.rubricCorrection={case:'l03',addedPrimary:['f07'],addedSupporting:['f01'],reason:'Supplied Vanilla and Ambrette were omitted from the cozy note rubric. Original choices, scores, explanations and raw model outputs are unchanged; original snapshots remain retained.'};
 return result;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [inputArg,outputArg]=process.argv.slice(2);assert.ok(inputArg&&outputArg,'Usage: node scripts/correct-vibe-audit.mjs BEFORE.json CORRECTED-BEFORE.json');
 const input=await readFile(resolve(inputArg),'utf8');
 const source=JSON.parse(await readFile(new URL('../docs/evaluations/2026-11-21-layering.json',import.meta.url),'utf8'));
 const result=correctVibeAudit(JSON.parse(input),source.cases);
 result.rubricCorrection.sourceArtifact=basename(inputArg);
 result.rubricCorrection.sourceSha256=createHash('sha256').update(input).digest('hex');
 result.rubricCorrection.reclassifiedAt=new Date().toISOString();
 await writeFile(resolve(outputArg),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({engineVersion:result.engineVersion,summary:result.summary,correction:result.rubricCorrection}));
}
