import assert from 'node:assert/strict';

const base=new URL(process.env.FRAGOUT_TEST_URL??'http://127.0.0.1:3210');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(base.hostname),'Run this with a disposable local FragOut server.');
let token,checks=0;
async function call(path,method='GET',data){
 const res=await fetch(new URL('/api/'+path,base),{method,headers:{Origin:base.origin,...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
 return {status:res.status,body:await res.json()};
}
function check(name,fn){fn();checks++;console.log('PASS '+name);}
try{
 const auth=await call('auth','POST',{action:'demo',client:'mobile'});
 assert.equal(auth.status,200);token=auth.body.sessionToken;
 const owned=new Set(auth.body.bottles.filter(b=>b.ownership==='OWNED').map(b=>b.id));
 const recommend=(intent={})=>call('recommend','POST',{occasion:'GENERAL',mode:'solo',...intent});
 const ordinary=await recommend(),happy=await recommend({mood:'HAPPY'}),warm=await recommend({vibe:'WARM'});
 check('optional choices make different owned picks on the production API',()=>{
  assert.equal(ordinary.status,200);assert.equal(happy.status,200);assert.equal(warm.status,200);
  assert.equal(ordinary.body.solo[0].bottle.name,'Soft Suede');assert.equal(happy.body.solo[0].bottle.name,'Citrus Current');assert.equal(warm.body.solo[0].bottle.name,'Golden Hour');
  assert.ok([ordinary,happy,warm].every(r=>r.body.solo.every(s=>owned.has(s.bottle.id))));
 });
 const mixed=await recommend({mood:'TIRED',vibe:'WARM'});
 const logged=await call('feedback','POST',{bottleIds:[mixed.body.solo[0].bottle.id],reaction:'wore',occasion:'GYM',requestId:mixed.body.requestId});
 check('wear log gets the server-owned mood, vibe and occasion snapshot',()=>{
  assert.equal(logged.status,201);assert.equal(logged.body.context.mood,'TIRED');assert.equal(logged.body.context.vibe,'WARM');assert.equal(logged.body.occasion,'GENERAL');
 });
 const state=await call('state');
 check('selection does not alter account conditions',()=>{assert.equal(state.body.context.mood,undefined);assert.equal(state.body.context.vibe,undefined);});
 const gym=await recommend({occasion:'GYM',mood:'CONFIDENT',vibe:'BOLD'}),bad=await recommend({vibe:'arbitrary input'});
 check('venue limits and strict intent validation still apply',()=>{
  assert.ok(gym.body.solo.length>0);assert.ok(gym.body.solo.every(s=>s.bottle.strength===1));assert.equal(bad.status,400);
 });
 const pairs=mode=>call('recommend','POST',{occasion:'WORK',mode:'combo',evidenceMode:mode,mood:'CALM',vibe:'CLEAN'});
 const evidence=await pairs('evidence'),experiments=await pairs('experimental');
 check('intent changes pair order without manufacturing evidence',()=>{
  assert.deepEqual(evidence.body.combos,[]);assert.ok(experiments.body.combos.length>0);
  assert.ok(experiments.body.combos.every(r=>r.tier==='model_hypothesis'&&!r.sources.length&&owned.has(r.a.id)&&owned.has(r.b.id)&&r.a.strength+r.b.strength<=2));
  assert.ok(experiments.body.combos.some(r=>/scent direction: .*clean/i.test(r.reason)));
 });
 assert.equal((await call('settings','PUT',{preferences:{...state.body.preferences,archiveOutfits:true}})).status,200);
 const analysis=await call('outfit/analyze','POST',{provider:'qwen',text:'White shirt and navy trousers'});assert.equal(analysis.status,200);
 const outfitInput={analysisId:analysis.body.id,profile:analysis.body.profile,occasion:'GENERAL',mode:'both',mood:'SAD',vibe:'MYSTERIOUS'};
 const outfit=await call('outfit/recommend','POST',outfitInput),invalidOutfit=await call('outfit/recommend','POST',{...outfitInput,mood:17});
 check('reviewed outfit recommendations use the same mood/vibe contract',()=>{
  assert.equal(outfit.status,200);assert.equal(invalidOutfit.status,400);assert.equal(outfit.body.context.vibe,'MYSTERIOUS');
  assert.ok(outfit.body.solo[0].reasons.some(r=>r.ruleId==='v1.vibe'));assert.ok(outfit.body.solo[0].reasons.some(r=>r.ruleId==='v1.outfit'));
 });
 const look=await call('looks','POST',{requestId:outfit.body.requestId,bottleIds:[outfit.body.solo[0].bottle.id],confirmedAccurate:true});
 check('an explicitly archived outfit preserves intent without retaining a photo',()=>{
  assert.equal(look.status,201);assert.equal(look.body.context.mood,'SAD');assert.equal(look.body.context.vibe,'MYSTERIOUS');assert.equal(look.body.photoAvailable,false);
 });
 console.log(`${checks}/${checks} mood/vibe HTTP checks passed.`);
}finally{if(token)await call('account','DELETE');}
