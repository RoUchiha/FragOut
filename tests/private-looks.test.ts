import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {randomBytes,randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {Store} from '../src/lib/store.ts';
import {parseOutfitText} from '../src/lib/outfit.ts';

async function setup(){
 const file=new URL('../src/lib/private-looks.ts',import.meta.url);assert.ok(existsSync(file),'Private archive must be implemented before photos can be retained');
 const {PrivateLooks}=await import('../src/lib/private-looks.ts');
 const db=new Store(':memory:'),a=db.createDemo(),b=db.createDemo(),vault=new PrivateLooks(db,randomBytes(32));
 const profile=parseOutfitText('White shirt and navy trousers');
 const receipt={id:randomUUID(),profile,provider:'qwen' as const,model:'synthetic',method:'model' as const,createdAt:new Date().toISOString()};db.saveOutfit(a.id,receipt);
 const owned=db.state(a.id).bottles.filter(x=>x.ownership==='OWNED').slice(0,2);
 const requestId=db.recordRecommendation(a.id,db.state(a.id).context,owned.map(x=>x.id),{analysisId:receipt.id,profile,choices:[[owned[0].id],owned.map(x=>x.id)],variants:Object.fromEntries(owned.map(x=>[x.id,x.variantId]))});
 const image={mime:'image/jpeg' as const,data:(await sharp({create:{width:6,height:4,channels:3,background:'#93a878'}}).jpeg().toBuffer()).toString('base64')};
 const enable=()=>db.saveSettings(a.id,{preferences:{...db.state(a.id).preferences,archiveOutfits:true}});
 const save=()=>vault.save(a.id,{requestId,bottleIds:owned.map(x=>x.id),confirmedAccurate:true});
 return {db,a,b,vault,receipt,image,owned,enable,save,requestId};
}

test('archive is off for new and legacy settings; default image analysis writes no image',async()=>{
 const h=await setup();try{assert.equal(h.db.state(h.a.id).preferences.archiveOutfits,false);
  assert.equal(h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,false),false);assert.equal(h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true),false);
  assert.equal(h.db.db.prepare('SELECT COUNT(*) AS n FROM private_photos').get()!.n,0);assert.throws(h.save,/enable|archive|consent/i);
 }finally{h.db.close();}
});

test('opted-in photos are encrypted and only the reviewed owner selection may be saved',async()=>{
 const h=await setup();try{h.enable();assert.equal(h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true),true);
  const row=h.db.db.prepare('SELECT sealed FROM private_photos').get() as {sealed:Uint8Array};assert.ok(!Buffer.from(row.sealed).includes(Buffer.from(h.image.data,'base64')));
  const look=h.save();assert.equal(look.photoAvailable,true);assert.deepEqual(look.bottles.map(x=>x.id),h.owned.map(x=>x.id));assert.deepEqual(h.vault.photo(h.a.id,look.id),h.image);
  assert.ok(!JSON.stringify(h.vault.list(h.a.id)).includes(h.image.data));assert.ok(!JSON.stringify(h.vault.list(h.a.id)).includes('sealed'));
 }finally{h.db.close();}
});

test('known look, photo, analysis and recommendation IDs do not cross accounts',async()=>{
 const h=await setup();try{h.enable();assert.equal(h.vault.stagePhoto(h.b.id,h.receipt.id,h.image,true),false);h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true);const look=h.save();
  assert.deepEqual(h.vault.list(h.b.id),[]);assert.equal(h.vault.photo(h.b.id,look.id),null);assert.equal(h.vault.remove(h.b.id,look.id),false);
  assert.throws(()=>h.vault.save(h.b.id,{requestId:h.requestId,bottleIds:h.owned.map(x=>x.id),confirmedAccurate:true}));
 }finally{h.db.close();}
});

test('pending image TTL and consent revocation prevent late retention',async()=>{
 const h=await setup();try{h.enable();h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true);
  h.db.db.prepare('UPDATE private_photos SET expires=?').run(Date.now()-1);h.db.pruneOutfits();assert.equal(h.db.db.prepare('SELECT COUNT(*) AS n FROM private_photos').get()!.n,0);
  h.db.saveSettings(h.a.id,{preferences:{...h.db.state(h.a.id).preferences,archiveOutfits:false}});
  assert.equal(h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true),false);assert.equal(h.db.db.prepare('SELECT COUNT(*) AS n FROM private_photos').get()!.n,0);
 }finally{h.db.close();}
});

test('turning archiving off deletes saved looks, photos and pending copies atomically',async()=>{
 const h=await setup();try{h.enable();h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true);const look=h.save();
  h.db.saveSettings(h.a.id,{preferences:{...h.db.state(h.a.id).preferences,archiveOutfits:false}});
  assert.deepEqual(h.vault.list(h.a.id),[]);assert.equal(h.vault.photo(h.a.id,look.id),null);assert.equal(h.db.db.prepare('SELECT COUNT(*) AS n FROM private_photos').get()!.n,0);
 }finally{h.db.close();}
});

test('archive revocation invalidates an old upload even after archiving is re-enabled',async()=>{
 const h=await setup();try{h.enable();
  const consent=typeof h.db.archiveConsent==='function'?h.db.archiveConsent(h.a.id):0;
  h.db.saveSettings(h.a.id,{preferences:{...h.db.state(h.a.id).preferences,archiveOutfits:false}});h.enable();
  assert.equal(h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true,consent),false);
  assert.equal(h.db.db.prepare('SELECT COUNT(*) AS n FROM private_photos').get()!.n,0);
 }finally{h.db.close();}
});

test('unsaved recommendation clothing copies expire with their analysis and are purged on opt-out',async()=>{
 const h=await setup();try{h.enable();
  h.db.db.prepare('UPDATE outfit_analyses SET created=? WHERE id=?').run(Date.now()-16*60000,h.receipt.id);
  h.db.pruneOutfits();assert.equal(h.db.getRecommendation(h.a.id,h.requestId)?.outfit,undefined);
  h.db.saveOutfit(h.a.id,h.receipt);
  const run=h.db.recordRecommendation(h.a.id,h.db.state(h.a.id).context,h.owned.map(x=>x.id),{analysisId:h.receipt.id,profile:h.receipt.profile,choices:[],variants:{}});
  h.db.saveSettings(h.a.id,{preferences:{...h.db.state(h.a.id).preferences,archiveOutfits:false}});
  assert.equal(h.db.getRecommendation(h.a.id,run)?.outfit,undefined);
  assert.ok(h.db.getRecommendation(h.a.id,run)?.context,'Wear context must remain available');
 }finally{h.db.close();}
});

test('archive rejects inaccurate, foreign, unoffered and relabelled selections',async()=>{
 const h=await setup();try{h.enable();
  assert.throws(()=>h.vault.save(h.a.id,{requestId:h.requestId,bottleIds:h.owned.map(x=>x.id),confirmedAccurate:false}));
  assert.throws(()=>h.vault.save(h.a.id,{requestId:h.requestId,bottleIds:[h.db.state(h.b.id).bottles[0].id],confirmedAccurate:true}));
  assert.throws(()=>h.vault.save(h.a.id,{requestId:h.requestId,bottleIds:[h.owned[1].id],confirmedAccurate:true}));
  h.db.updateBottle(h.a.id,h.owned[0].id,{name:'Changed exact variant'});assert.throws(h.save);
 }finally{h.db.close();}
});

test('ciphertext tampering is rejected without returning encrypted bytes or key material',async()=>{
 const h=await setup();try{h.enable();h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true);const look=h.save();
  h.db.db.prepare('UPDATE private_photos SET sealed=? WHERE look_id=?').run(Buffer.from('synthetic-tampering'),look.id);
  assert.throws(()=>h.vault.photo(h.a.id,look.id),/photo|read|integrity/i);
 }finally{h.db.close();}
});

test('deleting a saved look or account cascades images and export excludes photo bytes',async()=>{
 const h=await setup();try{h.enable();h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true);let look=h.save();
  assert.ok(!JSON.stringify(h.db.exportState(h.a.id)).includes(h.image.data));assert.equal(h.vault.remove(h.a.id,look.id),true);assert.equal(h.vault.photo(h.a.id,look.id),null);
  h.vault.stagePhoto(h.a.id,h.receipt.id,h.image,true);look=h.save();h.db.deleteUser(h.a.id);assert.equal(h.vault.photo(h.a.id,look.id),null);
  assert.equal(h.db.db.prepare('SELECT COUNT(*) AS n FROM private_photos').get()!.n,0);
 }finally{h.db.close();}
});
