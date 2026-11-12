import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import type {DataConnection} from './database.ts';
import type {AiProvider} from './types.ts';
import {privateDataPath} from './private-path.ts';

type Paid=Exclude<AiProvider,'qwen'>;
export const DEFAULT_MODELS={qwen:'qwen3-vl:2b-instruct',openai:'gpt-4.1-mini',claude:'claude-haiku-4-5'} as const;

export class CredentialVault {
  private readonly db:DataConnection;
  private readonly key:Buffer;

  constructor(db:DataConnection,key:Buffer){
    if(key.length!==32)throw new Error('Invalid vault configuration.');
    this.db=db;
    this.key=key;
  }

  async set(userId:string,provider:Paid,secret:string,model:string){
    const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,nonce);
    cipher.setAAD(Buffer.from(userId+'|'+provider));
    const encrypted=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
    const sealed=[nonce.toString('base64'),encrypted.toString('base64'),cipher.getAuthTag().toString('base64')].join('.');
    await this.db.run(`
      INSERT INTO ai_credentials (user_id,provider,model,sealed) VALUES (?,?,?,?)
      ON CONFLICT(user_id,provider) DO UPDATE SET model=excluded.model,sealed=excluded.sealed
    `,userId,provider,model,sealed);
  }

  async get(userId:string,provider:Paid){
    const row=await this.db.get<{model:string;sealed:string}>(
      'SELECT model,sealed FROM ai_credentials WHERE user_id=? AND provider=?',userId,provider);
    if(!row)return null;
    const [nonce,encrypted,tag]=row.sealed.split('.').map(part=>Buffer.from(part,'base64'));
    const decipher=createDecipheriv('aes-256-gcm',this.key,nonce);
    decipher.setAAD(Buffer.from(userId+'|'+provider));
    decipher.setAuthTag(tag);
    return {model:row.model,key:Buffer.concat([decipher.update(encrypted),decipher.final()]).toString('utf8')};
  }

  async metadata(userId:string){
    const rows=await this.db.all<{provider:Paid;model:string}>(
      'SELECT provider,model FROM ai_credentials WHERE user_id=?',userId);
    return (['qwen','openai','claude'] as const).map(provider=>{
      const row=rows.find(connection=>connection.provider===provider);
      return {provider,model:row?.model??DEFAULT_MODELS[provider],configured:provider==='qwen'||!!row};
    });
  }

  async selected(userId:string):Promise<AiProvider>{
    const row=await this.db.get<{selected:AiProvider}>('SELECT selected FROM ai_preferences WHERE user_id=?',userId);
    return row?.selected??'qwen';
  }

  async select(userId:string,provider:AiProvider){
    await this.db.transaction(async tx=>{
      await this.lockOwner(tx,userId);
      if(provider!=='qwen'&&!(await tx.get('SELECT 1 FROM ai_credentials WHERE user_id=? AND provider=?',userId,provider))){
        throw new Error('Connect your own API key first.');
      }
      await tx.run(`
        INSERT INTO ai_preferences (user_id,selected) VALUES (?,?)
        ON CONFLICT(user_id) DO UPDATE SET selected=excluded.selected
      `,userId,provider);
    });
  }

  async remove(userId:string,provider:Paid){
    await this.db.transaction(async tx=>{
      await this.lockOwner(tx,userId);
      await tx.run('DELETE FROM ai_credentials WHERE user_id=? AND provider=?',userId,provider);
      await tx.run("UPDATE ai_preferences SET selected='qwen' WHERE user_id=? AND selected=?",userId,provider);
    });
  }

  private async lockOwner(tx:DataConnection,userId:string){
    if(tx.engine==='postgres')await tx.get('SELECT id FROM users WHERE id=? FOR UPDATE',userId);
  }
}

export function installationKey(){
  const env=process.env.FRAGOUT_VAULT_KEY;
  if(env){
    const key=Buffer.from(env,'base64');
    if(key.length!==32)throw new Error('Invalid vault configuration.');
    return key;
  }
  if(process.env.FRAGOUT_DATABASE_URL?.trim())throw new Error('FRAGOUT_VAULT_KEY is required for the managed database.');
  const file=join(dirname(privateDataPath()),'credential-key');
  mkdirSync(dirname(file),{recursive:true});
  try{
    return readFileSync(file);
  }catch(error){
    if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
    const key=randomBytes(32);
    try{
      writeFileSync(file,key,{mode:0o600,flag:'wx'});
      return key;
    }catch(error){
      if((error as NodeJS.ErrnoException).code==='EEXIST')return readFileSync(file);
      throw error;
    }
  }
}
