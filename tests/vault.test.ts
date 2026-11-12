import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {join} from 'node:path';
import {Store} from '../src/lib/store.ts';
import {CredentialVault,installationKey} from '../src/lib/vault.ts';

test('a managed database requires a valid shared vault key',()=>{
 const previous={databaseUrl:process.env.FRAGOUT_DATABASE_URL,key:process.env.FRAGOUT_VAULT_KEY,path:process.env.FRAGOUT_DB};
 process.env.FRAGOUT_DATABASE_URL='postgres://example.invalid/fragout';
 process.env.FRAGOUT_DB=join(process.cwd(),'public','unused-fragout.sqlite');
 try{
  delete process.env.FRAGOUT_VAULT_KEY;
  assert.throws(installationKey,/FRAGOUT_VAULT_KEY/);
  process.env.FRAGOUT_VAULT_KEY='invalid';
  assert.throws(installationKey,/Invalid vault configuration/);
  const key=randomBytes(32);
  process.env.FRAGOUT_VAULT_KEY=key.toString('base64');
  assert.deepEqual(installationKey(),key);
 }finally{
  for(const [name,value] of Object.entries({FRAGOUT_DATABASE_URL:previous.databaseUrl,FRAGOUT_VAULT_KEY:previous.key,FRAGOUT_DB:previous.path})){
   if(value===undefined)delete process.env[name];else process.env[name]=value;
  }
 }
});
test('provider secrets are encrypted, owner-scoped and excluded from export',async()=>{
 const db=new Store(':memory:');
 try{
  const a=await db.createDemo(),b=await db.createDemo(),vault=new CredentialVault(db.db,randomBytes(32));
  const key='test-provider-secret-not-a-real-key',model='synthetic-custom-model';
  await vault.set(a.id,'openai',key,model);
  assert.deepEqual(await vault.get(a.id,'openai'),{model,key});assert.equal(await vault.get(b.id,'openai'),null);
  const ownerConnection=(await vault.metadata(a.id)).find(connection=>connection.provider==='openai');
  const otherConnection=(await vault.metadata(b.id)).find(connection=>connection.provider==='openai');
  assert.deepEqual(ownerConnection,{provider:'openai',model,configured:true});
  assert.deepEqual(otherConnection,{provider:'openai',model:'gpt-4.1-mini',configured:false});
  assert.ok(!JSON.stringify(await db.db.all('SELECT * FROM ai_credentials')).includes(key));
  assert.ok(!JSON.stringify(await db.exportState(a.id)).includes(key));assert.equal(await vault.selected(a.id),'qwen');
  await vault.select(a.id,'openai');assert.equal(await vault.selected(a.id),'openai');
  await vault.remove(a.id,'openai');assert.equal(await vault.selected(a.id),'qwen');assert.equal(await vault.get(a.id,'openai'),null);
 }finally{await db.close();}
});
test('connection selection never borrows another user key and account deletion cascades',async()=>{
 const db=new Store(':memory:');
 try{
  const a=await db.createDemo(),b=await db.createDemo(),vault=new CredentialVault(db.db,randomBytes(32));
  await vault.set(a.id,'claude','test-another-provider-secret','claude-haiku-4-5');
  await assert.rejects(()=>vault.select(b.id,'claude'),/Connect your own API key first/);
  await db.deleteUser(a.id);assert.equal(await vault.get(a.id,'claude'),null);
 }finally{await db.close();}
});
test('failed provider reset rolls back credential removal',async()=>{
 const db=new Store(':memory:');
 try{
  const owner=await db.createDemo(),vault=new CredentialVault(db.db,randomBytes(32));
  const key='synthetic-provider-rollback-key';
  await vault.set(owner.id,'openai',key,'gpt-4.1-mini');
  await vault.select(owner.id,'openai');
  await db.db.run(`
   CREATE TRIGGER reject_selection_reset BEFORE UPDATE ON ai_preferences
   BEGIN SELECT RAISE(ABORT, 'Synthetic selection failure'); END
  `);
  await assert.rejects(()=>vault.remove(owner.id,'openai'));
  assert.equal((await vault.get(owner.id,'openai'))?.key,key);
  assert.equal(await vault.selected(owner.id),'openai');
 }finally{await db.close();}
});
test('ciphertext cannot be moved between users or decrypted with a different installation key',async()=>{
 const db=new Store(':memory:');
 try{
  const a=await db.createDemo(),b=await db.createDemo(),vault=new CredentialVault(db.db,randomBytes(32));
  await vault.set(a.id,'openai','test-owner-bound-secret','gpt-4.1-mini');
  const other=new CredentialVault(db.db,randomBytes(32));
  await assert.rejects(()=>other.get(a.id,'openai'));
  await db.db.run('UPDATE ai_credentials SET user_id=? WHERE user_id=?',b.id,a.id);
  await assert.rejects(()=>vault.get(b.id,'openai'));
 }finally{await db.close();}
});
