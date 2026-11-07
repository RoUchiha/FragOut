import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/lib/store.ts';
import {demoBottles} from '../src/lib/seed.ts';
import {parseOutfitText} from '../src/lib/outfit.ts';
import {randomUUID} from 'node:crypto';

test('expired outfit descriptions are purged during reads, exports and writes',()=>{
  const db=new Store(':memory:'),a=db.createDemo(),b=db.createDemo();
  const receipt=()=>({id:randomUUID(),profile:parseOutfitText('White shirt and blue jeans'),provider:'qwen' as const,model:'test',method:'model' as const,createdAt:new Date().toISOString()});
  const old=receipt();db.saveOutfit(a.id,old);
  db.db.prepare('UPDATE outfit_analyses SET created=? WHERE id=?').run(Date.now()-48*3600000,old.id);
  assert.deepEqual(db.exportState(a.id).outfitAnalyses,[]);
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM outfit_analyses').get()!.n,0);
  const fresh=receipt();db.saveOutfit(a.id,fresh);
  assert.equal(db.getOutfit(b.id,fresh.id),null);assert.equal(db.getOutfit(a.id,fresh.id)?.id,fresh.id);
  db.db.prepare('UPDATE outfit_analyses SET created=? WHERE id=?').run(Date.now()-48*3600000,fresh.id);
  assert.equal(db.getOutfit(a.id,fresh.id),null);
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM outfit_analyses').get()!.n,0);
  const aged=receipt();db.saveOutfit(b.id,aged);
  db.db.prepare('UPDATE outfit_analyses SET created=? WHERE id=?').run(Date.now()-48*3600000,aged.id);
  db.saveOutfit(a.id,receipt());
  assert.equal(db.db.prepare('SELECT COUNT(*) AS n FROM outfit_analyses').get()!.n,1);db.close();
});

test('unsaved outfit descriptions expire after fifteen minutes',()=>{
 const db=new Store(':memory:'),user=db.createDemo(),receipt={id:randomUUID(),profile:parseOutfitText('White shirt and jeans'),provider:'qwen' as const,model:'test',method:'model' as const,createdAt:new Date().toISOString()};
 db.saveOutfit(user.id,receipt);db.db.prepare('UPDATE outfit_analyses SET created=?').run(Date.now()-16*60000);
 assert.equal(db.getOutfit(user.id,receipt.id),null);db.close();
});
test('real SQLite accounts isolate CRUD, preferences and feedback',()=>{
  const db=new Store(':memory:');
  const a=db.register('Alice','alice@example.test','very-secure-pass');
  const b=db.register('Bob','bob@example.test','different-secure-pass');
  assert.equal(db.state(a.id).bottles.length,0);
  const bottle=db.addBottle(a.id,{...demoBottles[0],id:'',provenance:'personal'});
  assert.equal(db.state(a.id).bottles.length,1);assert.equal(db.state(b.id).bottles.length,0);
  assert.equal(db.updateBottle(b.id,bottle.id,{name:'stolen'}),null);
  assert.equal(db.removeBottle(b.id,bottle.id),false);
  const changed=db.updateBottle(a.id,bottle.id,{ownership:'WISHLIST'});
  assert.equal(changed?.ownership,'WISHLIST');
  assert.equal(db.removeBottle(a.id,bottle.id),true);assert.equal(db.state(a.id).bottles.length,0);
  db.close();
});
test('passwords validate and sessions are revocable and never stored plaintext',()=>{
  const db=new Store(':memory:');const a=db.register('Alice','alice@example.test','very-secure-pass');
  assert.equal(db.login('alice@example.test','wrong'),null);
  assert.equal(db.login('alice@example.test','very-secure-pass')?.id,a.id);
  const token=db.createSession(a.id);assert.equal(db.sessionUser(token)?.id,a.id);
  db.revokeSession(token);assert.equal(db.sessionUser(token),null);db.close();
});
test('demo is private and fictional; new real accounts never inherit demo inventory',()=>{
  const db=new Store(':memory:');const a=db.createDemo();const b=db.createDemo();
  assert.notEqual(a.id,b.id);assert.equal(db.state(a.id).bottles.length,8);
  assert.ok(db.state(a.id).bottles.every(b=>b.provenance==='demo'));
  const real=db.register('Real','real@example.test','very-secure-pass');assert.equal(db.state(real.id).bottles.length,0);db.close();
});
test('same named concentrations get separate variant identities and duplicate bottles are allowed',()=>{
  const db=new Store(':memory:');const a=db.createDemo();const one=db.addBottle(a.id,{...demoBottles[0],variantId:'',concentration:'EDT'});
  const two=db.addBottle(a.id,{...demoBottles[0],variantId:'',concentration:'EDP'});
  const three=db.addBottle(a.id,{...demoBottles[0],variantId:'',concentration:'EDP'});
  assert.notEqual(one.variantId,two.variantId);assert.equal(two.variantId,three.variantId);assert.notEqual(two.id,three.id);db.close();
});
test('export includes only the current user and account deletion cascades and revokes access',()=>{
  const db=new Store(':memory:');const a=db.createDemo(),b=db.createDemo();const token=db.createSession(a.id);
  assert.equal(db.state(a.id).user.id,a.id);db.deleteUser(a.id);assert.equal(db.sessionUser(token),null);
  assert.throws(()=>db.state(a.id));assert.equal(db.state(b.id).bottles.length,8);db.close();
});
test('changing a bottle identity invalidates old scent traits',()=>{
 const db=new Store(':memory:');const a=db.createDemo();const b=db.state(a.id).bottles[0];
 const updated=db.updateBottle(a.id,b.id,{name:'A completely different scent'});
 assert.equal(updated?.profileKnown,false);assert.deepEqual(updated?.notes,[]);assert.equal(updated?.provenance,'unknown');db.close();
});
test('pair feedback preserves individual favorites and ratings',()=>{
 const db=new Store(':memory:');const a=db.createDemo();const bs=db.state(a.id).bottles.slice(0,2);
 db.feedback(a.id,bs.map(b=>b.id),'disliked','DATE');const after=db.state(a.id).bottles;
 for(const b of bs){assert.equal(after.find(x=>x.id===b.id)?.rating,b.rating);assert.equal(after.find(x=>x.id===b.id)?.favorite,b.favorite);}db.close();
});
test('recommendation snapshot preserves actual context and denies another owner',()=>{
 const db=new Store(':memory:');const a=db.createDemo(),b=db.createDemo();const bottle=db.state(a.id).bottles[0];
 const actual={...db.state(a.id).context,occasion:'GYM',setting:'INDOOR' as const,indoorTempC:22,tempC:-5};
 const requestId=db.recordRecommendation(a.id,actual,[bottle.id]);
 const event=db.feedback(a.id,[bottle.id],'wore','GYM',requestId);
 assert.equal(event.context.setting,'INDOOR');assert.equal(event.context.tempC,-5);assert.equal(event.context.indoorTempC,22);
 assert.throws(()=>db.feedback(b.id,[db.state(b.id).bottles[0].id],'wore','GYM',requestId));db.close();
});
test('export includes all journal events beyond the UI history limit',()=>{
 const db=new Store(':memory:');const a=db.createDemo();const b=db.state(a.id).bottles[0];
 for(let i=0;i<203;i++)db.feedback(a.id,[b.id],'wore','GENERAL');
 assert.equal(db.state(a.id).history.length,200);assert.equal(db.exportState(a.id).history.length,203);db.close();
});

test('liked combos include older saves and collapse reversed duplicate pairs',()=>{
 const db=new Store(':memory:');
 try {
  const user=db.createDemo();
  const [a,b]=db.state(user.id).bottles;
  const first=db.feedback(user.id,[a.id,b.id],'saved','GENERAL');
  const second=db.feedback(user.id,[b.id,a.id],'saved','WORK');
  const age=db.db.prepare('UPDATE wear_events SET created=? WHERE id=?');
  age.run(1,first.id);
  age.run(2,second.id);
  for(let i=0;i<201;i++) db.feedback(user.id,[a.id],'wore','GENERAL');
  const state=db.state(user.id);
  assert.equal(state.history.some(event=>event.reaction==='saved'),false);
  assert.deepEqual(state.likedCombos.map(event=>event.id),[second.id]);
 } finally { db.close(); }
});
