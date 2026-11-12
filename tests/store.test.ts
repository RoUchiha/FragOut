import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {Store} from '../src/lib/store.ts';
import {demoBottles} from '../src/lib/seed.ts';
import {parseOutfitText} from '../src/lib/outfit.ts';

test('expired outfit descriptions are purged during reads, exports and writes',async()=>{
  const db=new Store(':memory:');
  try{
    const a=await db.createDemo(),b=await db.createDemo();
    const receipt=()=>({id:randomUUID(),profile:parseOutfitText('White shirt and blue jeans'),provider:'qwen' as const,model:'test',method:'model' as const,createdAt:new Date().toISOString()});
    const expire=(id:string)=>db.db.run('UPDATE outfit_analyses SET created=? WHERE id=?',Date.now()-48*3600000,id);
    const analysisCount=async()=>(await db.db.get<{n:number}>('SELECT COUNT(*) AS n FROM outfit_analyses'))!.n;
    const old=receipt();
    await db.saveOutfit(a.id,old);
    await expire(old.id);
    assert.deepEqual((await db.exportState(a.id)).outfitAnalyses,[]);
    assert.equal(await analysisCount(),0);
    const fresh=receipt();
    await db.saveOutfit(a.id,fresh);
    assert.equal(await db.getOutfit(b.id,fresh.id),null);
    assert.equal((await db.getOutfit(a.id,fresh.id))?.id,fresh.id);
    await expire(fresh.id);
    assert.equal(await db.getOutfit(a.id,fresh.id),null);
    assert.equal(await analysisCount(),0);
    const aged=receipt();
    await db.saveOutfit(b.id,aged);
    await expire(aged.id);
    await db.saveOutfit(a.id,receipt());
    assert.equal(await analysisCount(),1);
  }finally{await db.close();}
});

test('unsaved outfit descriptions expire after fifteen minutes',async()=>{
  const db=new Store(':memory:');
  try{
    const user=await db.createDemo();
    const receipt={id:randomUUID(),profile:parseOutfitText('White shirt and jeans'),provider:'qwen' as const,model:'test',method:'model' as const,createdAt:new Date().toISOString()};
    await db.saveOutfit(user.id,receipt);
    await db.db.run('UPDATE outfit_analyses SET created=?',Date.now()-16*60000);
    assert.equal(await db.getOutfit(user.id,receipt.id),null);
  }finally{await db.close();}
});

test('real SQLite accounts isolate CRUD, preferences and feedback',async()=>{
  const db=new Store(':memory:');
  try{
    const a=await db.register('Alice','alice@example.test','very-secure-pass');
    const b=await db.register('Bob','bob@example.test','different-secure-pass');
    assert.equal((await db.state(a.id)).bottles.length,0);
    const bottle=await db.addBottle(a.id,{...demoBottles[0],id:'',provenance:'personal'});
    assert.equal((await db.state(a.id)).bottles.length,1);
    assert.equal((await db.state(b.id)).bottles.length,0);
    assert.equal(await db.updateBottle(b.id,bottle.id,{name:'stolen'}),null);
    assert.equal(await db.removeBottle(b.id,bottle.id),false);
    const changed=await db.updateBottle(a.id,bottle.id,{ownership:'WISHLIST'});
    assert.equal(changed?.ownership,'WISHLIST');
    assert.equal(await db.removeBottle(a.id,bottle.id),true);
    assert.equal((await db.state(a.id)).bottles.length,0);
  }finally{await db.close();}
});

test('passwords validate and sessions are revocable and never stored plaintext',async()=>{
  const db=new Store(':memory:');
  try{
    const a=await db.register('Alice','alice@example.test','very-secure-pass');
    assert.equal(await db.login('alice@example.test','wrong'),null);
    assert.equal((await db.login('alice@example.test','very-secure-pass'))?.id,a.id);
    const token=await db.createSession(a.id);
    assert.equal((await db.sessionUser(token))?.id,a.id);
    const session=await db.db.get<{token_hash:string}>('SELECT token_hash FROM sessions WHERE user_id=?',a.id);
    assert.ok(session?.token_hash&&session.token_hash!==token);
    await db.revokeSession(token);
    assert.equal(await db.sessionUser(token),null);
  }finally{await db.close();}
});

test('demo is private and fictional; new real accounts never inherit demo inventory',async()=>{
  const db=new Store(':memory:');
  try{
    const a=await db.createDemo(),b=await db.createDemo();
    assert.notEqual(a.id,b.id);
    const state=await db.state(a.id);
    assert.equal(state.bottles.length,8);
    assert.ok(state.bottles.every(bottle=>bottle.provenance==='demo'));
    const real=await db.register('Real','real@example.test','very-secure-pass');
    assert.equal((await db.state(real.id)).bottles.length,0);
  }finally{await db.close();}
});

test('same named concentrations get separate variant identities and duplicate bottles are allowed',async()=>{
  const db=new Store(':memory:');
  try{
    const a=await db.createDemo();
    const one=await db.addBottle(a.id,{...demoBottles[0],variantId:'',concentration:'EDT'});
    const two=await db.addBottle(a.id,{...demoBottles[0],variantId:'',concentration:'EDP'});
    const three=await db.addBottle(a.id,{...demoBottles[0],variantId:'',concentration:'EDP'});
    assert.notEqual(one.variantId,two.variantId);
    assert.equal(two.variantId,three.variantId);
    assert.notEqual(two.id,three.id);
  }finally{await db.close();}
});

test('export includes only the current user and account deletion cascades and revokes access',async()=>{
  const db=new Store(':memory:');
  try{
    const a=await db.createDemo(),b=await db.createDemo();
    const token=await db.createSession(a.id);
    const foreign=await db.addBottle(b.id,{...demoBottles[0],name:'Private fixture'});
    const snapshot=await db.exportState(a.id);
    assert.equal(snapshot.user.id,a.id);
    assert.ok(!snapshot.bottles.some(bottle=>bottle.id===foreign.id));
    await db.deleteUser(a.id);
    assert.equal(await db.sessionUser(token),null);
    await assert.rejects(()=>db.state(a.id));
    assert.equal((await db.state(b.id)).bottles.length,9);
  }finally{await db.close();}
});

test('changing a bottle identity invalidates old scent traits',async()=>{
  const db=new Store(':memory:');
  try{
    const a=await db.createDemo(),b=(await db.state(a.id)).bottles[0];
    const updated=await db.updateBottle(a.id,b.id,{name:'A completely different scent'});
    assert.equal(updated?.profileKnown,false);
    assert.deepEqual(updated?.notes,[]);
    assert.equal(updated?.provenance,'unknown');
  }finally{await db.close();}
});

test('pair feedback preserves individual favorites and ratings',async()=>{
  const db=new Store(':memory:');
  try{
    const a=await db.createDemo(),bs=(await db.state(a.id)).bottles.slice(0,2);
    await db.feedback(a.id,bs.map(b=>b.id),'disliked','DATE');
    const after=(await db.state(a.id)).bottles;
    for(const b of bs){
      assert.equal(after.find(x=>x.id===b.id)?.rating,b.rating);
      assert.equal(after.find(x=>x.id===b.id)?.favorite,b.favorite);
    }
  }finally{await db.close();}
});

test('recommendation snapshot preserves actual context and denies another owner',async()=>{
  const db=new Store(':memory:');
  try{
    const a=await db.createDemo(),b=await db.createDemo();
    const {context,bottles:[bottle]}=await db.state(a.id);
    const actual={...context,occasion:'GYM',setting:'INDOOR' as const,indoorTempC:22,tempC:-5};
    const requestId=await db.recordRecommendation(a.id,actual,[bottle.id]);
    const event=await db.feedback(a.id,[bottle.id],'wore','GYM',requestId);
    assert.equal(event.context.setting,'INDOOR');
    assert.equal(event.context.tempC,-5);
    assert.equal(event.context.indoorTempC,22);
    const other=(await db.state(b.id)).bottles[0];
    await assert.rejects(()=>db.feedback(b.id,[other.id],'wore','GYM',requestId));
  }finally{await db.close();}
});

test('export includes all journal events beyond the UI history limit',async()=>{
  const db=new Store(':memory:');
  try{
    const a=await db.createDemo(),b=(await db.state(a.id)).bottles[0];
    for(let i=0;i<203;i++)await db.feedback(a.id,[b.id],'wore','GENERAL');
    assert.equal((await db.state(a.id)).history.length,200);
    assert.equal((await db.exportState(a.id)).history.length,203);
  }finally{await db.close();}
});

test('liked combos include older saves and collapse reversed duplicate pairs',async()=>{
  const db=new Store(':memory:');
  try{
    const user=await db.createDemo();
    const [a,b]=(await db.state(user.id)).bottles;
    const first=await db.feedback(user.id,[a.id,b.id],'saved','GENERAL');
    const second=await db.feedback(user.id,[b.id,a.id],'saved','WORK');
    await db.db.run('UPDATE wear_events SET created=? WHERE id=?',1,first.id);
    await db.db.run('UPDATE wear_events SET created=? WHERE id=?',2,second.id);
    for(let i=0;i<201;i++)await db.feedback(user.id,[a.id],'wore','GENERAL');
    const state=await db.state(user.id);
    assert.equal(state.history.some(event=>event.reaction==='saved'),false);
    assert.deepEqual(state.likedCombos.map(event=>event.id),[second.id]);
  }finally{await db.close();}
});

test('a recommendation from before consent was revoked cannot restore an outfit after re-enabling',async()=>{
  const db=new Store(':memory:');
  try{
    const user=await db.createDemo();
    const {preferences,context}=await db.state(user.id);
    const consent=(archiveOutfits:boolean)=>db.saveSettings(user.id,{preferences:{...preferences,archiveOutfits}});
    await consent(true);
    const epoch=await db.archiveConsent(user.id);
    const profile=parseOutfitText('White shirt and blue jeans');
    const analysisId=randomUUID();
    await db.saveOutfit(user.id,{id:analysisId,profile,provider:'qwen',model:'test',method:'model',createdAt:new Date().toISOString()});
    await consent(false);
    await consent(true);
    const outfit={analysisId,profile,choices:[],variants:{}};
    const stale=await db.recordRecommendation(user.id,context,[],outfit,epoch);
    const current=await db.recordRecommendation(user.id,context,[],outfit,await db.archiveConsent(user.id));
    assert.deepEqual(await db.getRecommendation(user.id,stale),{context,bottleIds:[]});
    assert.deepEqual((await db.getRecommendation(user.id,current))?.outfit,outfit);
  }finally{await db.close();}
});
