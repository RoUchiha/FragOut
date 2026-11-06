import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankSolo, rankCombos, evidenceTier, seasonFor, effectiveTemperature } from '../src/lib/engine.ts';
import { demoBottles, defaultContext, defaultPreferences } from '../src/lib/seed.ts';

test('empty wardrobe has no phantom result', () => assert.equal(rankSolo([],defaultContext,defaultPreferences).length,0));
test('only owned distinct variants can rank', () => {
  const bottles = demoBottles.map((b,i)=>({...b,ownership:i%2?'WISHLIST' as const:'OWNED' as const}));
  const results=rankSolo(bottles,defaultContext,defaultPreferences);
  assert.ok(results.length>0);
  for(const r of results) assert.equal(bottles.find(b=>b.id===r.bottle.id)?.ownership,'OWNED');
});
test('fragrance-free venue never gives solo or combo',()=>{
  const context={...defaultContext,policy:'NO_FRAGRANCE' as const};
  assert.deepEqual(rankSolo(demoBottles,context,defaultPreferences),[]);
  assert.deepEqual(rankCombos(demoBottles,context,defaultPreferences,'experimental',[]),[]);
});
test('disliked notes and exclusions are hard constraints',()=>{
  const prefs={...defaultPreferences,dislikedNotes:['bergamot'],excludedIds:[demoBottles[1].id]};
  const result=rankSolo(demoBottles,defaultContext,prefs);
  assert.ok(result.every(r=>!r.bottle.notes.includes('bergamot') && !prefs.excludedIds.includes(r.bottle.id)));
});
test('unknown manual profiles are not assigned invented traits',()=>{
  const unknown={...demoBottles[0],profileKnown:false,provenance:'unknown' as const};
  assert.equal(rankSolo([unknown],defaultContext,defaultPreferences).length,0);
});
test('gym excludes strong scents even if favorite',()=>{
  const result=rankSolo(demoBottles,{...defaultContext,occasion:'GYM'},defaultPreferences);
  assert.ok(result.length>0); assert.ok(result.every(r=>r.bottle.strength===1));
});
test('heated indoor context does not inherit freezing outdoor temperature',()=>{
  assert.equal(effectiveTemperature({...defaultContext,tempC:-6,setting:'INDOOR',indoorTempC:22}),22);
});
test('sparse evidence is an honest gap by default',()=>assert.equal(rankCombos(demoBottles,defaultContext,defaultPreferences,'evidence',[]).length,0));
test('experimental pairs are owned, distinct, untested with no citations',()=>{
  const results=rankCombos(demoBottles,defaultContext,defaultPreferences,'experimental',[]);
  assert.ok(results.length>0);
  for(const result of results){assert.notEqual(result.a.variantId,result.b.variantId); assert.equal(result.tier,'model_hypothesis');assert.equal(result.sources.length,0);}
});
test('one report is not community corroboration; rights blocked sources fail',()=>{
  assert.equal(evidenceTier({kind:'community',reports:[{author:'a',firsthand:true,rights:'approved',url:'https://example.com/a'}]}),'single_anecdote');
  assert.equal(evidenceTier({kind:'brand',reports:[{author:'brand',firsthand:true,rights:'review_required',url:'https://example.com/a'}]}),null);
  assert.equal(evidenceTier({kind:'community',reports:[{author:'a',firsthand:true,rights:'approved',url:'https://example.com/a'},{author:'a',firsthand:true,rights:'approved',url:'https://example.com/a'}]}),'single_anecdote');
});
test('substitution never inherits brand or community status',()=>{
  assert.equal(evidenceTier({kind:'brand',adapted:true,reports:[{author:'brand',firsthand:true,rights:'approved',url:'https://example.com/a'}]}),'dupe_adapted_hypothesis');
});
test('season is hemisphere adjusted',()=>{assert.equal(seasonFor(1,40),'Winter');assert.equal(seasonFor(1,-33),'Summer');});
test('all 35 scenario fixtures preserve constraints and traceability',()=>{
  for(const occasion of ['GENERAL','GYM','DATE','WORK','PARTY','ERRANDS','CUSTOM']) for(const tempC of [-5,12,22,30,38]){
    const results=rankSolo(demoBottles,{...defaultContext,occasion,tempC,setting:'OUTDOOR'},defaultPreferences);
    assert.ok(results.length<=3); for(const r of results){assert.equal(r.bottle.ownership,'OWNED');assert.ok(r.reasons.every(reason=>reason.ruleId.startsWith('v1.'))); if(occasion==='GYM')assert.equal(r.bottle.strength,1);}
  }
});
