import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankSolo,rankCombos} from '../src/lib/engine.ts';
import {rankForOutfit,parseOutfitText} from '../src/lib/outfit.ts';
import {defaultContext,defaultPreferences,demoBottles} from '../src/lib/seed.ts';
import type {Bottle,WearContext,Mood,Vibe} from '../src/lib/types.ts';
const bottle=(id:string,notes:string[]):Bottle=>({...demoBottles[0],id,variantId:id,name:id,family:'Personal',notes,favorite:false,rating:3,strength:1,climate:'BALANCED'});
const neutral=bottle('a-neutral',['stone']);
for(const [mood,note] of [['HAPPY','bergamot'],['TIRED','peppermint'],['SAD','vanilla'],['CALM','tea'],['STRESSED','musk'],['CONFIDENT','vetiver']] as const){
 test(mood+' mood changes the pick using a known matching profile',()=>{
  const match=bottle('z-match',[note]),results=rankSolo([neutral,match],{...defaultContext,mood},defaultPreferences);
  assert.equal(results[0].bottle.id,'z-match');assert.ok(results[0].reasons.some(r=>r.ruleId==='v1.mood'));
 });
}
for(const [vibe,note] of [['CLEAN','white musk'],['MYSTERIOUS','incense'],['WARM','amber'],['FRESH','grapefruit'],['COZY','tonka'],['BOLD','oud'],['ROMANTIC','rose']] as const){
 test(vibe+' vibe changes the pick using a known matching profile',()=>{
  const match=bottle('z-match',[note]),results=rankSolo([neutral,match],{...defaultContext,vibe},defaultPreferences);
  assert.equal(results[0].bottle.id,'z-match');assert.ok(results[0].reasons.some(r=>r.ruleId==='v1.vibe'));
 });
}
test('Any mood and vibe preserve the previous ranking, scores and reasons',()=>{
 assert.deepEqual(rankSolo(demoBottles,{...defaultContext,mood:'ANY',vibe:'ANY'},defaultPreferences),rankSolo(demoBottles,defaultContext,defaultPreferences));
});
test('an explicit scent vibe has more influence than a conflicting mood',()=>{
 const result=rankSolo([bottle('a-soft',['vanilla']),bottle('z-fresh',['grapefruit'])],{...defaultContext,mood:'SAD',vibe:'FRESH'},defaultPreferences);
 assert.equal(result[0].bottle.id,'z-fresh');
});
test('Warm brings a warm, owned profile to the top in the supplied demo wardrobe',()=>{
 assert.equal(rankSolo(demoBottles,{...defaultContext,vibe:'WARM'},defaultPreferences)[0].bottle.name,'Golden Hour');
});
test('Happy favors bright notes over a generic soft floral family in the demo wardrobe',()=>{
 assert.equal(rankSolo(demoBottles,{...defaultContext,mood:'HAPPY'},defaultPreferences)[0].bottle.name,'Citrus Current');
});
test('mood and vibe never restore unowned, unknown, empty, excluded or overpowering bottles',()=>{
 const a=bottle('owned',['oud','amber']),others=[{...a,id:'wishlist',variantId:'wishlist',ownership:'WISHLIST' as const},{...a,id:'unknown',variantId:'unknown',profileKnown:false},{...a,id:'empty',variantId:'empty',fillPct:0},{...a,id:'strong',variantId:'strong',strength:3}];
 for(const mood of ['HAPPY','TIRED','SAD','CALM','STRESSED','CONFIDENT'] as Mood[])for(const vibe of ['CLEAN','MYSTERIOUS','WARM','FRESH','COZY','BOLD','ROMANTIC'] as Vibe[]){
  const context:WearContext={...defaultContext,mood,vibe,occasion:'GYM'};
  assert.deepEqual(rankSolo([a,...others],{...context,policy:'NO_FRAGRANCE'},defaultPreferences),[]);
  assert.deepEqual(rankSolo([a,...others],context,{...defaultPreferences,dislikedNotes:['oud']}),[]);
  assert.deepEqual(rankSolo([a,...others],context,{...defaultPreferences,excludedIds:['owned']}),[]);
 }
});
test('vibe ranks the whole eligible pair pool without inventing compatibility evidence',()=>{
 const bottles=[neutral,bottle('y-clean',['white musk']),bottle('z-clean',['neroli'])],context:WearContext={...defaultContext,mood:'TIRED',vibe:'CLEAN'};
 assert.deepEqual(rankCombos(bottles,context,defaultPreferences,'evidence',[]),[]);
 const pairs=rankCombos(bottles,context,defaultPreferences,'experimental',[]);
 assert.deepEqual([pairs[0].a.id,pairs[0].b.id].sort(),['y-clean','z-clean']);assert.equal(pairs[0].tier,'model_hypothesis');assert.deepEqual(pairs[0].sources,[]);
 assert.match(pairs[0].reason,/clean/i);
});
test('outfit matching combines the explicit vibe with reviewed clothing',()=>{
 const result=rankForOutfit([neutral,bottle('z-wood',['cedar'])],{...defaultContext,vibe:'MYSTERIOUS'},defaultPreferences,parseOutfitText('White shirt and jeans'),'solo','evidence',[]);
 assert.equal(result.solo[0].bottle.id,'z-wood');assert.ok(result.solo[0].reasons.some(r=>r.ruleId==='v1.vibe'));assert.ok(result.solo[0].reasons.some(r=>r.ruleId==='v1.outfit'));
});
test('unmatched profiles get no invented mood or vibe explanation',()=>{
 const result=rankSolo([neutral],{...defaultContext,mood:'HAPPY',vibe:'ROMANTIC'},defaultPreferences)[0];
 assert.ok(result.reasons.every(r=>r.ruleId!=='v1.mood'&&r.ruleId!=='v1.vibe'));
});
