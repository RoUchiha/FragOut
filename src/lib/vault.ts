import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import type {DatabaseSync} from 'node:sqlite';
import type {AiProvider} from './types.ts';
import {privateDataPath} from './private-path.ts';
type Paid=Exclude<AiProvider,'qwen'>;
export const DEFAULT_MODELS={qwen:'qwen3-vl:2b-instruct',openai:'gpt-4.1-mini',claude:'claude-haiku-4-5'} as const;
export class CredentialVault {
 db:DatabaseSync;key:Buffer;
 constructor(db:DatabaseSync,key:Buffer){
  if(key.length!==32)throw new Error('Invalid vault configuration.');this.db=db;this.key=key;
  db.exec(`CREATE TABLE IF NOT EXISTS ai_credentials(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,provider TEXT NOT NULL,model TEXT NOT NULL,sealed TEXT NOT NULL,PRIMARY KEY(user_id,provider));CREATE TABLE IF NOT EXISTS ai_preferences(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,selected TEXT NOT NULL);`);
 }
 set(userId:string,provider:Paid,secret:string,model:string){
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,nonce);cipher.setAAD(Buffer.from(userId+'|'+provider));
  const encrypted=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);const sealed=[nonce.toString('base64'),encrypted.toString('base64'),cipher.getAuthTag().toString('base64')].join('.');
  this.db.prepare('INSERT INTO ai_credentials VALUES(?,?,?,?) ON CONFLICT(user_id,provider) DO UPDATE SET model=excluded.model,sealed=excluded.sealed').run(userId,provider,model,sealed);
 }
 get(userId:string,provider:Paid){
  const row=this.db.prepare('SELECT model,sealed FROM ai_credentials WHERE user_id=? AND provider=?').get(userId,provider) as {model:string;sealed:string}|undefined;if(!row)return null;
  const [nonce,encrypted,tag]=row.sealed.split('.').map(s=>Buffer.from(s,'base64'));const decipher=createDecipheriv('aes-256-gcm',this.key,nonce);decipher.setAAD(Buffer.from(userId+'|'+provider));decipher.setAuthTag(tag);
  return {model:row.model,key:Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8')};
 }
 metadata(userId:string){const rows=this.db.prepare('SELECT provider,model FROM ai_credentials WHERE user_id=?').all(userId) as {provider:Paid;model:string}[];return (['qwen','openai','claude'] as const).map(provider=>({provider,model:rows.find(r=>r.provider===provider)?.model??DEFAULT_MODELS[provider],configured:provider==='qwen'||rows.some(r=>r.provider===provider)}));}
 selected(userId:string):AiProvider {const row=this.db.prepare('SELECT selected FROM ai_preferences WHERE user_id=?').get(userId) as {selected:AiProvider}|undefined;return row?.selected??'qwen';}
 select(userId:string,provider:AiProvider){if(provider!=='qwen'&&!this.get(userId,provider))throw new Error('Connect your own API key first.');this.db.prepare('INSERT INTO ai_preferences VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET selected=excluded.selected').run(userId,provider);}
 remove(userId:string,provider:Paid){this.db.prepare('DELETE FROM ai_credentials WHERE user_id=? AND provider=?').run(userId,provider);if(this.selected(userId)===provider)this.select(userId,'qwen');}
}
export function installationKey(){
 const env=process.env.FRAGOUT_VAULT_KEY;if(env){const b=Buffer.from(env,'base64');if(b.length!==32)throw new Error('Invalid vault configuration.');return b;}
 const file=join(dirname(privateDataPath()),'credential-key');mkdirSync(dirname(file),{recursive:true});
 try{return readFileSync(file);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;const key=randomBytes(32);try{writeFileSync(file,key,{mode:0o600,flag:'wx'});return key;}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')return readFileSync(file);throw e;}}
}
