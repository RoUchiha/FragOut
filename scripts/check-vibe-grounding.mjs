import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {rankCombos,rankSolo,ENGINE_VERSION} from '../src/lib/engine.ts';
import {rankForOutfit,parseOutfitText} from '../src/lib/outfit.ts';
import {demoBottles,defaultContext,defaultPreferences} from '../src/lib/seed.ts';

// Fixed direction expectations describe note support, not measured mixture smell.
// They are independent of the production matcher and were frozen before tuning.
const scenarios=[
 ['l01','HAPPY','CLEAN',23,['f01','f02'],[]],
 ['l02','TIRED','FRESH',29,['f01','f07'],['f02','f03']],
 ['l03','SAD','COZY',17,['f03','f05','f06','f08'],['f02']],
 ['l04','CALM','CLEAN',22,['f01','f02'],[]],
 ['l05','CONFIDENT','MYSTERIOUS',12,['f05','f06','f08'],['f04']],
 ['l06','ANY','ROMANTIC',22,['f03','f04','f07','f08'],['f02']],
 ['l07','ANY','WARM',18,['f05','f06','f07','f08'],['f03','f04']],
 ['l08','ANY','BOLD',8,['f04','f05','f06','f08'],[]],
 ['l09','ANY','FRESH',22,['f01','f07'],['f02','f03']],
 ['l10','ANY','MYSTERIOUS',22,['f05','f06','f08'],['f04']],
];
const [command,outputArg]=process.argv.slice(2);
assert.ok(['snapshot','verify'].includes(command)&&outputArg,'Usage: node --experimental-strip-types scripts/check-vibe-grounding.mjs snapshot|verify OUTPUT.json [BASELINE.json]');
const source=JSON.parse(await readFile(new URL('../docs/evaluations/2026-11-21-layering.json',import.meta.url),'utf8'));
const rows=scenarios.map(([id,mood,vibe,tempC,primary,supporting])=>{
 const recorded=source.cases.find(c=>c.id===id);assert.ok(recorded);
 const {constraints}=recorded;
 const bottles=recorded.collection.map(b=>({...demoBottles[0],...b,fillPct:b.available?75:0,notes:b.notes,family:'Supplied profile',rating:3,favorite:false,climate:'BALANCED',provenance:'personal'}));
 const context={...defaultContext,occasion:constraints.occasion,policy:constraints.policy,tempC,indoorTempC:tempC,mood,vibe};
 const prefs={...defaultPreferences,maxStrength:constraints.maxStrength,dislikedNotes:constraints.excludedNotes,excludedIds:constraints.excludedIds};
 const all=rankCombos(bottles,context,prefs,'experimental',[],constraints.rejectedPairs,100);
 const result=all.slice(0,3),outfit=rankForOutfit(bottles,context,prefs,parseOutfitText('White shirt, navy trousers and brown shoes'),'combo','experimental',[],constraints.rejectedPairs).combos;
 const variants=ids=>new Set(bottles.filter(b=>ids.includes(b.id)).map(b=>b.variantId));
 const primaryVariants=variants(primary),supportingVariants=variants(supporting);
 const direction=pair=>{const ids=[pair.a??pair[0],pair.b??pair[1]].map(id=>typeof id==='string'?bottles.find(b=>b.id===id)?.variantId:id.variantId);return {primary:ids.filter(id=>primaryVariants.has(id)).length,supporting:ids.filter(id=>supportingVariants.has(id)).length};};
 const rank=pair=>direction(pair).primary*3+direction(pair).supporting;
 const best=Math.max(0,...all.map(rank));
 const topQuality=result.length?rank(result[0]):0,outfitQuality=outfit.length?rank(outfit[0]):0;
 const snapshot=items=>items.map(pair=>({ids:[pair.a.id,pair.b.id],direction:direction(pair),reason:pair.reason,tier:pair.tier,sources:pair.sources,score:pair.score}));
 const raw=key=>recorded[key].combos.map(pair=>({ids:[pair.a,pair.b],direction:direction(pair)}));
 const reversed=rankCombos([...bottles].reverse(),context,prefs,'experimental',[],constraints.rejectedPairs,3);
 if(command==='verify'){
  assert.equal(topQuality,best,id+' best available explicit direction must lead');
  assert.equal(outfitQuality,best,id+' outfit styling must preserve explicit direction');
  const editions=pairs=>pairs.map(p=>JSON.stringify([p.a.variantId,p.b.variantId].sort())).sort();
  assert.deepEqual(editions(result),editions(reversed),id+' edition choices must not depend on input position');
 }
 return {id,mood,vibe,expectations:{primary,supporting},bestAvailableDirection:best,topQuality,outfitQuality,solo:rankSolo(bottles,context,prefs).map(s=>s.bottle.id),backend:snapshot(result),outfit:snapshot(outfit),rawQwen:raw('qwenOutput'),rawSol:raw('referenceOutput')};
});
const report={at:new Date().toISOString(),engineVersion:ENGINE_VERSION,scope:'Fixed-profile heuristic direction audit; not an olfactory trial or new model inference.',rows,summary:{cases:rows.length,backendBestFirst:rows.filter(r=>r.topQuality===r.bestAvailableDirection).length,outfitBestFirst:rows.filter(r=>r.outfitQuality===r.bestAvailableDirection).length}};
if(process.argv[4]){
 const previous=JSON.parse(await readFile(resolve(process.argv[4]),'utf8'));
 assert.deepEqual(previous.rows.map(r=>[r.id,r.expectations]),rows.map(r=>[r.id,r.expectations]),'Direction expectations changed after baseline.');
 assert.deepEqual(rows.map(r=>[r.id,r.bestAvailableDirection]),previous.rows.map(r=>[r.id,r.bestAvailableDirection]),'Available direction support changed; empty or dropped candidates cannot pass as best-first.');
 report.baseline=previous.summary;
}
const output=resolve(outputArg);await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...report,rows:undefined},null,2));
