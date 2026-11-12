import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {Store} from '../src/lib/store.ts';
import {parseOutfitText} from '../src/lib/outfit.ts';
import {PrivateLooks} from '../src/lib/private-looks.ts';

async function setup(archiveEnabled=true){
 const db=new Store(':memory:');
 const a=await db.createDemo(),b=await db.createDemo(),vault=new PrivateLooks(db,randomBytes(32));
 const enable=async(userId=a.id)=>db.saveSettings(userId,{preferences:{...(await db.state(userId)).preferences,archiveOutfits:true}});
 if(archiveEnabled)await enable();
 const profile=parseOutfitText('White shirt and navy trousers');
 const receipt={id:randomUUID(),profile,provider:'qwen' as const,model:'synthetic',method:'model' as const,createdAt:new Date().toISOString()};
 await db.saveOutfit(a.id,receipt);
 const {bottles,context}=await db.state(a.id);
 const owned=bottles.filter(x=>x.ownership==='OWNED').slice(0,2);
 const requestId=await db.recordRecommendation(a.id,context,owned.map(x=>x.id),{analysisId:receipt.id,profile,choices:[[owned[0].id],owned.map(x=>x.id)],variants:Object.fromEntries(owned.map(x=>[x.id,x.variantId]))});
 const image={mime:'image/jpeg' as const,data:(await sharp({create:{width:6,height:4,channels:3,background:'#93a878'}}).jpeg().toBuffer()).toString('base64')};
 const save=()=>vault.save(a.id,{requestId,bottleIds:owned.map(x=>x.id),confirmedAccurate:true});
 return {db,a,b,vault,receipt,image,owned,enable,save,requestId};
}

async function photoCount(db:Store){
 return (await db.db.get<{n:number}>('SELECT COUNT(*) AS n FROM private_photos'))!.n;
}

test('archive is off for new and legacy settings; default image analysis writes no image',async()=>{
 const h=await setup(false);try{
  const {preferences,context,shortcuts}=await h.db.state(h.a.id);
  assert.equal(preferences.archiveOutfits,false);
  const {archiveOutfits,...legacyPreferences}=preferences;
  await h.db.db.run('UPDATE settings SET body=? WHERE user_id=?',JSON.stringify({preferences:legacyPreferences,context,shortcuts}),h.a.id);
  assert.equal((await h.db.state(h.a.id)).preferences.archiveOutfits,false);
  assert.equal(await h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,false),false);assert.equal(await h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true),false);
  assert.equal(await photoCount(h.db),0);await assert.rejects(h.save,/enable|archive|consent/i);
 }finally{await h.db.close();}
});

test('opted-in photos are encrypted and only the reviewed owner selection may be saved',async()=>{
 const h=await setup();try{assert.equal(await h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true),true);
  const row=await h.db.db.get<{sealed:Uint8Array}>('SELECT sealed FROM private_photos');
  assert.ok(row);assert.ok(!Buffer.from(row.sealed).includes(Buffer.from(h.image.data,'base64')));
  const look=await h.save();assert.equal(look.photoAvailable,true);assert.deepEqual(look.bottles.map(x=>x.id),h.owned.map(x=>x.id));assert.deepEqual(await h.vault.photo(h.a.id,look.id),h.image);
  const archive=JSON.stringify(await h.vault.list(h.a.id));
  assert.ok(!archive.includes(h.image.data));assert.ok(!archive.includes('sealed'));
 }finally{await h.db.close();}
});

test('known look, photo, analysis and recommendation IDs do not cross accounts',async()=>{
 const h=await setup();try{await h.enable(h.b.id);assert.equal(await h.vault.stagePhoto(h.b.id,h.receipt.id,h.image,true),false);await h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true);const look=await h.save();
  assert.deepEqual(await h.vault.list(h.b.id),[]);assert.equal(await h.vault.photo(h.b.id,look.id),null);assert.equal(await h.vault.remove(h.b.id,look.id),false);
  await assert.rejects(()=>h.vault.save(h.b.id,{requestId:h.requestId,bottleIds:h.owned.map(x=>x.id),confirmedAccurate:true}));
 }finally{await h.db.close();}
});

test('pending image TTL and consent revocation prevent late retention',async()=>{
 const h=await setup();try{await h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true);
  await h.db.db.run('UPDATE private_photos SET expires=?',Date.now()-1);
  assert.equal((await h.save()).photoAvailable,false);
  await h.db.pruneOutfits();assert.equal(await photoCount(h.db),0);
  await h.db.saveSettings(h.a.id,{preferences:{...(await h.db.state(h.a.id)).preferences,archiveOutfits:false}});
  assert.equal(await h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true),false);assert.equal(await photoCount(h.db),0);
 }finally{await h.db.close();}
});

test('turning archiving off deletes saved looks, photos and pending copies atomically',async()=>{
 const h=await setup();try{await h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true);const look=await h.save();
  await h.db.saveSettings(h.a.id,{preferences:{...(await h.db.state(h.a.id)).preferences,archiveOutfits:false}});
  assert.deepEqual(await h.vault.list(h.a.id),[]);assert.equal(await h.vault.photo(h.a.id,look.id),null);assert.equal(await photoCount(h.db),0);
 }finally{await h.db.close();}
});

test('an upload overlapping archive revocation leaves no pending copy',async t=>{
 const h=await setup();
 const checked=Promise.withResolvers<void>(),resume=Promise.withResolvers<void>();
 try{
  const consent=await h.db.archiveConsent(h.a.id);
  const preferences={...(await h.db.state(h.a.id)).preferences,archiveOutfits:false};
  const getOutfit=Store.prototype.getOutfit;
  t.mock.method(Store.prototype,'getOutfit',async function(this:Store,...args:Parameters<Store['getOutfit']>){
   const receipt=await getOutfit.apply(this,args);
   checked.resolve();
   await resume.promise;
   return receipt;
  });
  const upload=h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true,consent);
  await Promise.race([checked.promise,upload.then(()=>{throw new Error('Upload finished before its analysis was checked.');})]);
  const disable=h.db.saveSettings(h.a.id,{preferences});
  await Promise.race([disable,new Promise<void>(resolve=>setImmediate(resolve))]);
  resume.resolve();
  await Promise.all([upload,disable]);
  assert.equal(await photoCount(h.db),0);
 }finally{
  resume.resolve();
  await h.db.close();
 }
});

test('archive revocation invalidates an old upload even after archiving is re-enabled',async()=>{
 const h=await setup();try{
  const consent=await h.db.archiveConsent(h.a.id);
  await h.db.saveSettings(h.a.id,{preferences:{...(await h.db.state(h.a.id)).preferences,archiveOutfits:false}});await h.enable();
  assert.equal(await h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true,consent),false);
  assert.equal(await photoCount(h.db),0);
 }finally{await h.db.close();}
});

test('unsaved recommendation clothing copies expire with their analysis and are purged on opt-out',async()=>{
 const h=await setup();try{
  await h.db.db.run('UPDATE outfit_analyses SET created=? WHERE id=?',Date.now()-16*60000,h.receipt.id);
  assert.equal((await h.db.getRecommendation(h.a.id,h.requestId))?.outfit,undefined);
  await h.db.pruneOutfits();
  await h.db.saveOutfit(h.a.id,h.receipt);
  const state=await h.db.state(h.a.id);
  const run=await h.db.recordRecommendation(h.a.id,state.context,h.owned.map(x=>x.id),{analysisId:h.receipt.id,profile:h.receipt.profile,choices:[],variants:{}});
  await h.db.saveSettings(h.a.id,{preferences:{...state.preferences,archiveOutfits:false}});
  const snapshot=await h.db.getRecommendation(h.a.id,run);
  assert.equal(snapshot?.outfit,undefined);
  assert.ok(snapshot?.context,'Wear context must remain available');
 }finally{await h.db.close();}
});

test('archive rejects inaccurate, foreign, unoffered and relabelled selections',async()=>{
 const h=await setup();try{
  const foreign=(await h.db.state(h.b.id)).bottles[0].id;
  await assert.rejects(()=>h.vault.save(h.a.id,{requestId:h.requestId,bottleIds:h.owned.map(x=>x.id),confirmedAccurate:false}));
  await assert.rejects(()=>h.vault.save(h.a.id,{requestId:h.requestId,bottleIds:[foreign],confirmedAccurate:true}));
  await assert.rejects(()=>h.vault.save(h.a.id,{requestId:h.requestId,bottleIds:[h.owned[1].id],confirmedAccurate:true}));
  await h.db.updateBottle(h.a.id,h.owned[0].id,{name:'Changed exact variant'});await assert.rejects(h.save);
 }finally{await h.db.close();}
});

test('ciphertext tampering is rejected without returning encrypted bytes or key material',async()=>{
 const h=await setup();try{await h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true);const look=await h.save();
  await h.db.db.run('UPDATE private_photos SET sealed=? WHERE look_id=?',Buffer.from('synthetic-tampering'),look.id);
  await assert.rejects(()=>h.vault.photo(h.a.id,look.id),/photo|read|integrity/i);
 }finally{await h.db.close();}
});

test('deleting a saved look or account cascades images and export excludes photo bytes',async()=>{
 const h=await setup();try{await h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true);let look=await h.save();
  assert.ok(!JSON.stringify(await h.db.exportState(h.a.id)).includes(h.image.data));assert.equal(await h.vault.remove(h.a.id,look.id),true);assert.equal(await h.vault.photo(h.a.id,look.id),null);
  await h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true);look=await h.save();await h.db.deleteUser(h.a.id);assert.equal(await h.vault.photo(h.a.id,look.id),null);
  assert.equal(await photoCount(h.db),0);
 }finally{await h.db.close();}
});
