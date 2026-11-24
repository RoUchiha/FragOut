import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankSolo,rankCombos} from '../src/lib/engine.ts';
import {rankForOutfit,parseOutfitText} from '../src/lib/outfit.ts';
import {demoBottles,defaultContext,defaultPreferences} from '../src/lib/seed.ts';
import type {Bottle,PairRecord,Vibe} from '../src/lib/types.ts';

const bottle=(id:string,notes:string[],extra:Partial<Bottle>={}):Bottle=>({...demoBottles[0],id,variantId:id,name:id,notes,family:'Personal',favorite:false,rating:3,strength:1,climate:'BALANCED',...extra});
for(const [vibe,note] of [['CLEAN','Cetalox'],['CLEAN','Ambrette'],['FRESH','Salt'],['COZY','Honey'],['COZY','Chestnut'],['COZY','Cashmeran'],['BOLD','Tobacco'],['BOLD','Clove']] as [Vibe,string][]){
 test(vibe+' recognizes the supplied '+note+' cue',()=>{
  const result=rankSolo([bottle('a-neutral',['stone']),bottle('z-match',[note])],{...defaultContext,vibe},defaultPreferences);
  assert.equal(result[0].bottle.id,'z-match');assert.ok(result[0].reasons.some(r=>r.ruleId==='v1.vibe'&&r.text.toLowerCase().includes(note.toLowerCase())));
 });
}

test('sourced catalog cues count even when personal tags omit the relevant note',()=>{
 const result=rankSolo([bottle('a-neutral',['stone']),bottle('z-match',['stone'],{catalogNotes:['Cetalox']})],{...defaultContext,vibe:'CLEAN'},defaultPreferences);
 assert.equal(result[0].bottle.id,'z-match');assert.ok(result[0].reasons.some(r=>r.ruleId==='v1.vibe'&&/cetalox/i.test(r.text)));
});

test('an explicit dark note outranks a favorite with only a generic woody family',()=>{
 const generic=bottle('a-favorite',['stone'],{family:'Woody',favorite:true,rating:5}),dark=bottle('z-dark',['Oud'],{strength:3,rating:1,climate:'WARM'});
 assert.equal(rankSolo([generic,dark],{...defaultContext,vibe:'MYSTERIOUS'},defaultPreferences)[0].bottle.id,'z-dark');
});

test('a fresh ambrette/salt profile does not acquire a romantic bonus from its clean character',()=>{
 const results=rankSolo([bottle('a-fresh',['Ambrette','Salt','Sage']),bottle('z-soft',['Cetalox'])],{...defaultContext,vibe:'ROMANTIC'},defaultPreferences);
 assert.equal(results[0].bottle.id,'z-soft');assert.ok(results.find(r=>r.bottle.id==='a-fresh')!.reasons.every(r=>r.ruleId!=='v1.vibe'));
});

test('without explicit vibe, outfit score ties retain the prior preference order',()=>{
 const a=bottle('a-style',['cedar'],{family:'Woody'}),z=bottle('z-favorite',['bergamot'],{family:'Citrus',favorite:true});
 const results=rankForOutfit([a,z],defaultContext,defaultPreferences,parseOutfitText('Black suit'),'solo','experimental',[]).solo;
 assert.equal(results[0].score,results[1].score);assert.equal(results[0].bottle.id,'z-favorite');
});

test('mood-only requests preserve established scoring and explanation precedence',()=>{
 const profiles=[bottle('a-neutral',['stone']),bottle('z-chestnut',['Chestnut']),bottle('y-catalog',['stone'],{catalogNotes:['Vanilla']})];
 assert.deepEqual(rankSolo(profiles,{...defaultContext,mood:'SAD'},defaultPreferences),rankSolo(profiles,defaultContext,defaultPreferences));
 const family=bottle('family',['sandalwood'],{family:'Woody'});
 assert.match(rankSolo([family],{...defaultContext,mood:'CALM'},defaultPreferences)[0].reasons.find(r=>r.ruleId==='v1.mood')!.text,/Calm mood: woody for/);
});

test('pair explanations label only the direction supported by their listed cues',()=>{
 const result=rankCombos([bottle('a-bright',['Neroli']),bottle('b-warm',['Amber'])],{...defaultContext,mood:'HAPPY',vibe:'WARM'},defaultPreferences,'experimental',[]);
 assert.match(result[0].reason,/^Warm cues: Amber\./);assert.doesNotMatch(result[0].reason,/Happy/);
});

const fresh=[bottle('a-fresh',['Bergamot'],{favorite:true,rating:5,family:'Woody',climate:'FRESH'}),bottle('b-fresh',['Neroli'],{favorite:true,rating:5,family:'Woody',climate:'FRESH'})];
const cozy=[bottle('c-cozy',['Chestnut'],{rating:1,strength:2,climate:'WARM'}),bottle('d-cozy',['Honey'],{rating:1,strength:2,climate:'WARM'})];
const wardrobe=[...fresh,...cozy],context={...defaultContext,mood:'TIRED' as const,vibe:'COZY' as const};
const ids=(pair:{a:Bottle;b:Bottle})=>[pair.a.id,pair.b.id].sort();

test('whole-pair vibe outranks conflicting mood, favorites and generic fresh anchors',()=>{
 const result=rankCombos(wardrobe,context,defaultPreferences,'experimental',[]);
 assert.deepEqual(ids(result[0]),['c-cozy','d-cozy']);
 assert.match(result[0].reason,/chestnut/i);assert.match(result[0].reason,/honey/i);assert.doesNotMatch(result[0].reason,/bergamot|neroli/i);
 assert.equal(result[0].tier,'model_hypothesis');assert.deepEqual(result[0].sources,[]);
 assert.deepEqual(result.map(ids),rankCombos([...wardrobe].reverse(),context,defaultPreferences,'experimental',[]).map(ids));
});

test('outfit style cannot undo the explicitly requested scent direction',()=>{
 const result=rankForOutfit(wardrobe,context,defaultPreferences,parseOutfitText('White shirt, jeans and trainers'),'both','experimental',[]);
 assert.ok(['c-cozy','d-cozy'].includes(result.solo[0].bottle.id));assert.deepEqual(ids(result.combos[0]),['c-cozy','d-cozy']);
});

test('vibe changes ranking without promoting experimental pairings to sourced evidence',()=>{
 const records:PairRecord[]=[{a:'a-fresh',b:'b-fresh',kind:'brand',status:'approved',reviewedAt:'2026-11-24',note:'Recorded source pairing.',reports:[{author:'Synthetic source',firsthand:true,rights:'approved',url:'https://example.com/pair'}]}];
 const experimental=rankCombos(wardrobe,context,defaultPreferences,'experimental',records);
 assert.deepEqual(ids(experimental[0]),['c-cozy','d-cozy']);assert.equal(experimental[0].tier,'model_hypothesis');
 const evidence=rankCombos(wardrobe,context,defaultPreferences,'evidence',records);
 assert.equal(evidence.length,1);assert.deepEqual(ids(evidence[0]),['a-fresh','b-fresh']);assert.equal(evidence[0].tier,'brand_guidance');assert.deepEqual(evidence[0].sources,['https://example.com/pair']);
 assert.doesNotMatch(evidence[0].reason,/cozy|chestnut|honey/i);
});

test('branding and memos cannot manufacture vibe cues, and unmatched profiles fall back honestly',()=>{
 const bottles=[bottle('a',['stone'],{name:'Mysterious Oud',brand:'Dark House',memo:'incense and smoke'}),bottle('b',['steel'])];
 assert.deepEqual(rankSolo(bottles,{...defaultContext,vibe:'MYSTERIOUS'},defaultPreferences),rankSolo(bottles,defaultContext,defaultPreferences));
 assert.deepEqual(rankCombos(bottles,{...defaultContext,vibe:'MYSTERIOUS'},defaultPreferences,'experimental',[]),rankCombos(bottles,defaultContext,defaultPreferences,'experimental',[]));
});

test('vibe priority still respects search anchors and all eligibility/evidence boundaries',()=>{
 const selected=rankCombos(wardrobe,context,defaultPreferences,'experimental',[],[],3,new Set(['a-fresh']));
 assert.ok(selected.length>0);assert.ok(selected.every(p=>[p.a.id,p.b.id].includes('a-fresh')));
 assert.deepEqual(rankCombos(wardrobe,{...context,policy:'NO_FRAGRANCE'},defaultPreferences,'experimental',[]),[]);
 assert.deepEqual(rankCombos(wardrobe,context,defaultPreferences,'evidence',[]),[]);
 const limited=rankCombos(wardrobe,{...context,occasion:'GYM'},defaultPreferences,'experimental',[]);
 assert.ok(limited.every(p=>p.a.strength+p.b.strength<=2));
 const excluded=rankCombos(wardrobe,context,{...defaultPreferences,dislikedNotes:['Chestnut']},'experimental',[],[['c-cozy','d-cozy']]);
 assert.ok(excluded.every(p=>![p.a.id,p.b.id].includes('c-cozy')));
});

test('large collections retain legal pair fallbacks before vibe ranking or result limits',()=>{
 const a=bottle('approved-a',['Stone'],{favorite:true,rating:5}),b=bottle('approved-b',['Steel'],{favorite:true,rating:5});
 const bottles=[a,b,...Array.from({length:100},(_,i)=>bottle('clean-'+i,['Cetalox'],{strength:2,rating:0}))];
 const records:PairRecord[]=[{a:a.variantId,b:b.variantId,kind:'brand',status:'approved',reviewedAt:'2026-11-24',reports:[{author:'Synthetic source',firsthand:true,rights:'approved',url:'https://example.com/pair'}]}];
 for(const mode of ['evidence','experimental'] as const){
  const result=rankCombos(bottles,{...defaultContext,occasion:'WORK',vibe:'CLEAN'},defaultPreferences,mode,records);
  assert.equal(result.length,1);assert.deepEqual(ids(result[0]),['approved-a','approved-b']);assert.equal(result[0].tier,'brand_guidance');
 }
});
