import assert from 'node:assert/strict';
import {test} from 'node:test';
import {generateKeyPairSync,randomBytes,createHash} from 'node:crypto';
import {openSqlite} from '../src/lib/database.ts';
import {Store} from '../src/lib/store.ts';
import {CredentialVault} from '../src/lib/vault.ts';
import {demoBottles} from '../src/lib/seed.ts';
import {captureSnapshot,sealBackup,openBackup,refreshStaging,verifySnapshotRestore,createVaultEscrow,openVaultEscrow} from '../src/lib/backups.ts';

const keys=generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});
async function fixture(){
 const db=openSqlite(':memory:',{environment:'production'}),store=new Store(db),key=randomBytes(32);
 const user=await store.register('SYNTHETIC PRIVATE NAME','private-person@example.test','synthetic-production-password');
 const bottle=await store.addBottle(user.id,{...demoBottles[0],id:'',brand:'Dior',name:'Sauvage',concentration:'EDP',provenance:'personal',memo:'SYNTHETIC PRIVATE MEMO',shelves:['Private shelf']});
 await store.createSession(user.id);
 await new CredentialVault(db,key).set(user.id,'openai','synthetic-provider-secret','gpt-4.1-mini');
 await db.run('INSERT INTO private_photos (id,user_id,analysis_id,look_id,sealed,expires) VALUES (?,?,?,NULL,?,?)','pending',user.id,'temporary',Buffer.from('SYNTHETIC PENDING IMAGE'),Date.now()+60000);
 await db.run('INSERT INTO saved_looks (id,user_id,analysis_id,body,created) VALUES (?,?,?,?,?)','archived-look',user.id,'saved-analysis',JSON.stringify({id:'archived-look',profile:{summary:'SYNTHETIC ARCHIVED OUTFIT'}}),Date.now());
 await db.run('INSERT INTO private_photos (id,user_id,analysis_id,look_id,sealed,expires) VALUES (?,?,?,?,?,NULL)','archived-photo',user.id,'saved-analysis','archived-look',Buffer.from('SYNTHETIC ARCHIVED PHOTO\0bytes'));
 return {db,store,key,user,bottle,snapshot:await captureSnapshot(db,{environment:'production',vaultKeyId:createHash('sha256').update(key).digest('hex')})};
}

test('consistent backups contain durable records and never retain temporary sessions or pending selfies',async()=>{
 const h=await fixture();try{
  assert.equal(h.snapshot.tables.users.length,1);assert.equal(h.snapshot.tables.bottles.length,1);
  assert.equal(h.snapshot.tables.ai_credentials.length,1);assert.equal(h.snapshot.tables.private_photos.length,1);
  assert.ok(!('sessions' in h.snapshot.tables));assert.ok(!('outfit_analyses' in h.snapshot.tables));
  assert.ok(!JSON.stringify(h.snapshot).includes('SYNTHETIC PENDING IMAGE'));
  const sealed=sealBackup(h.snapshot,keys.publicKey);
  for(const value of ['private-person@example.test','SYNTHETIC PRIVATE MEMO','synthetic-provider-secret'])assert.ok(!sealed.includes(Buffer.from(value)));
  assert.deepEqual(openBackup(sealed,keys.privateKey),h.snapshot);
 }finally{await h.store.close();}
});

test('backup metadata, ciphertext, wrapped keys and authentication tags cannot be altered',async()=>{
 const h=await fixture();try{
  const bytes=sealBackup(h.snapshot,keys.publicKey),base=JSON.parse(bytes.toString());
  for(const [field,value] of [['kind','escrow'],['sourceId','changed'],['tag',randomBytes(16).toString('base64')],['ciphertext',randomBytes(64).toString('base64')],['wrappedKey',randomBytes(384).toString('base64')]]){
   assert.throws(()=>openBackup(Buffer.from(JSON.stringify({...base,[field]:value})),keys.privateKey));
  }
  const wrong=generateKeyPairSync('rsa',{modulusLength:3072,privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
  assert.throws(()=>openBackup(bytes,wrong.privateKey));
 }finally{await h.store.close();}
});

test('a complete backup restores into an isolated database with verified bytes, counts and foreign keys',async()=>{
 const h=await fixture();try{
  const checked=await verifySnapshotRestore(openBackup(sealBackup(h.snapshot,keys.publicKey),keys.privateKey));
  assert.equal(checked.users,1);assert.equal(checked.bottles,1);assert.equal(checked.ai_credentials,1);assert.equal(checked.private_photos,1);
  const invalid=structuredClone(h.snapshot);invalid.tables.bottles[0].user_id='missing-owner';
  await assert.rejects(()=>verifySnapshotRestore(invalid));
 }finally{await h.store.close();}
});

test('staging refresh anonymizes identities and copies only public fragrance data, with no live credentials or images',async()=>{
 const h=await fixture(),stage=openSqlite(':memory:',{environment:'staging'});try{
  const result=await refreshStaging(stage,h.snapshot);assert.equal(result.users,1);assert.equal(result.bottles,1);
  const copy=await captureSnapshot(stage,{environment:'staging',vaultKeyId:'0'.repeat(64)}),text=JSON.stringify(copy);
  for(const value of ['SYNTHETIC PRIVATE NAME','private-person@example.test','synthetic-production-password','synthetic-provider-secret','SYNTHETIC PRIVATE MEMO','Private shelf',h.user.id,h.bottle.id])assert.ok(!text.includes(value),value);
  assert.equal(copy.tables.users[0].password,null);assert.equal(copy.tables.ai_credentials.length,0);assert.equal(copy.tables.private_photos.length,0);assert.equal(copy.tables.catalog_admins.length,0);
  assert.equal(JSON.parse(String(copy.tables.settings[0].body)).preferences.archiveOutfits,false);
  assert.equal(JSON.parse(String(copy.tables.bottles[0].body)).brand,'Dior');
  assert.ok(await h.store.login('private-person@example.test','synthetic-production-password'));
 }finally{await h.store.close();await stage.close();}
});

test('one-way refresh refuses production, the source itself and an incorrect source environment before any writes',async()=>{
 const h=await fixture(),stage=openSqlite(':memory:',{environment:'staging'});try{
  const before=(await captureSnapshot(h.db,{environment:'production',vaultKeyId:'0'.repeat(64)})).tables;
  await assert.rejects(()=>refreshStaging(h.db,h.snapshot));
  assert.deepEqual((await captureSnapshot(h.db,{environment:'production',vaultKeyId:'0'.repeat(64)})).tables,before);
  await assert.rejects(()=>refreshStaging(stage,{...h.snapshot,environment:'staging'}));
  const identity=await stage.get<{instance_id:string}>('SELECT instance_id FROM deployment_identity WHERE id=1');
  await assert.rejects(()=>refreshStaging(stage,{...h.snapshot,sourceId:identity!.instance_id}));
  assert.equal((await stage.get<{n:number}>('SELECT count(*) AS n FROM users'))?.n,0);
 }finally{await h.store.close();await stage.close();}
});

test('invalid snapshot schemas and table/column injection cannot change an existing test database',async()=>{
 const h=await fixture(),stage=openSqlite(':memory:',{environment:'staging'});try{
  await refreshStaging(stage,h.snapshot);
  const count=(await stage.get<{n:number}>('SELECT count(*) AS n FROM users'))!.n;
  const invalid=structuredClone(h.snapshot);invalid.tables.users[0]['name); DELETE FROM users;--']='malicious';
  await assert.rejects(()=>refreshStaging(stage,invalid));
  assert.equal((await stage.get<{n:number}>('SELECT count(*) AS n FROM users'))?.n,count);
 }finally{await h.store.close();await stage.close();}
});

test('the vault recovery escrow is encrypted separately and cannot be mistaken for a database snapshot',()=>{
 const key=randomBytes(32),sealed=createVaultEscrow(key,keys.publicKey);
 assert.ok(!sealed.includes(Buffer.from(key.toString('base64'))));assert.deepEqual(openVaultEscrow(sealed,keys.privateKey),key);
 assert.throws(()=>openBackup(sealed,keys.privateKey));
});

test('backup fails closed when schema drift introduces a table outside its coverage',async()=>{
 const h=await fixture();try{
  await h.db.run('CREATE TABLE new_private_feature (id TEXT PRIMARY KEY, body TEXT)');
  await assert.rejects(()=>captureSnapshot(h.db,{environment:'production',vaultKeyId:'0'.repeat(64)}),/schema|coverage/i);
 }finally{await h.store.close();}
});
