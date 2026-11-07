import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {Store} from '../src/lib/store.ts';
import {CredentialVault} from '../src/lib/vault.ts';
test('provider secrets are encrypted, owner-scoped and excluded from export',()=>{
 const db=new Store(':memory:');const a=db.createDemo(),b=db.createDemo();const vault=new CredentialVault(db.db,randomBytes(32));
 const key='test-provider-secret-not-a-real-key';vault.set(a.id,'openai',key,'gpt-4.1-mini');
 assert.equal(vault.get(a.id,'openai')?.key,key);assert.equal(vault.get(b.id,'openai'),null);
 assert.ok(!JSON.stringify(db.db.prepare('SELECT * FROM ai_credentials').all()).includes(key));
 assert.ok(!JSON.stringify(db.exportState(a.id)).includes(key));assert.equal(vault.selected(a.id),'qwen');
 vault.select(a.id,'openai');assert.equal(vault.selected(a.id),'openai');
 vault.remove(a.id,'openai');assert.equal(vault.selected(a.id),'qwen');assert.equal(vault.get(a.id,'openai'),null);db.close();
});
test('connection selection never borrows another user key and account deletion cascades',()=>{
 const db=new Store(':memory:');const a=db.createDemo(),b=db.createDemo();const vault=new CredentialVault(db.db,randomBytes(32));
 vault.set(a.id,'claude','test-another-provider-secret','claude-haiku-4-5');assert.throws(()=>vault.select(b.id,'claude'));
 db.deleteUser(a.id);assert.equal(vault.get(a.id,'claude'),null);db.close();
});
test('ciphertext cannot be moved between users or decrypted with a different installation key',()=>{
 const db=new Store(':memory:');const a=db.createDemo(),b=db.createDemo();const vault=new CredentialVault(db.db,randomBytes(32));
 vault.set(a.id,'openai','test-owner-bound-secret','gpt-4.1-mini');
 db.db.prepare('UPDATE ai_credentials SET user_id=? WHERE user_id=?').run(b.id,a.id);
 assert.throws(()=>vault.get(b.id,'openai'));
 const other=new CredentialVault(db.db,randomBytes(32));assert.throws(()=>other.get(b.id,'openai'));db.close();
});
