import {createCipheriv,createDecipheriv,hkdfSync,randomBytes,randomUUID} from 'node:crypto';
import type {Store} from './store.ts';
import type {SavedLook} from './types.ts';
import {outfitSchema,validateImage,type ImageInput} from './outfit.ts';

export const PENDING_PHOTO_MS=15*60*1000;
type PhotoRow={id:string;look_id:string|null;sealed:Uint8Array};

export class PrivateLooks {
  private readonly store:Store;
  private readonly key:Buffer;

  constructor(store:Store,installationKey:Buffer){
    if(installationKey.length!==32)throw new Error('Invalid private photo configuration.');
    this.store=store;
    this.key=Buffer.from(hkdfSync('sha256',installationKey,Buffer.alloc(0),'FragOut private outfit images v1',32));
  }

  private seal(userId:string,purpose:string,bytes:Buffer){
    const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,nonce);
    cipher.setAAD(Buffer.from(userId+'|'+purpose));
    const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);
    return Buffer.concat([nonce,cipher.getAuthTag(),encrypted]);
  }

  private unseal(userId:string,purpose:string,sealed:Uint8Array){
    try{
      const value=Buffer.from(sealed);
      if(value.length<29)throw new Error();
      const cipher=createDecipheriv('aes-256-gcm',this.key,value.subarray(0,12));
      cipher.setAAD(Buffer.from(userId+'|'+purpose));
      cipher.setAuthTag(value.subarray(12,28));
      return Buffer.concat([cipher.update(value.subarray(28)),cipher.final()]);
    }catch{
      throw new Error('Saved photo integrity could not be verified.');
    }
  }

  async stagePhoto(
    userId:string,analysisId:string,image:ImageInput,requested:boolean,consent?:number|null,
    authorize?:(scoped:Store)=>Promise<void>
  ){
    if(!requested||consent===null)return false;
    try{
      return await this.store.withOwnerTransaction(userId,async store=>{
        await authorize?.(store);
        const current=await store.archiveConsent(userId);
        if(current===null||(consent!==undefined&&consent!==current)||!(await store.getOutfit(userId,analysisId)))return false;
        if(image.mime!=='image/jpeg')throw new Error('Private photos must be sanitized JPEG images.');
        const bytes=validateImage(image);
        let sealed:Buffer;
        try{sealed=this.seal(userId,'pending|'+analysisId,bytes);}finally{bytes.fill(0);}
        const changes=await store.db.run(`
          INSERT INTO private_photos (id,user_id,analysis_id,look_id,sealed,expires) VALUES (?,?,?,?,?,?)
          ON CONFLICT(user_id,analysis_id) DO UPDATE SET sealed=excluded.sealed,expires=excluded.expires
          WHERE private_photos.look_id IS NULL
        `,randomUUID(),userId,analysisId,null,sealed,Date.now()+PENDING_PHOTO_MS);
        return changes>0;
      });
    }catch(error){
      if(error instanceof Error&&error.message==='Account not found.')return false;
      throw error;
    }
  }

  async save(
    userId:string,input:{requestId:string;bottleIds:string[];confirmedAccurate:boolean},
    authorize?:(scoped:Store)=>Promise<void>
  ):Promise<SavedLook>{
    return this.store.withOwnerTransaction(userId,async store=>{
      await authorize?.(store);
      if(await store.archiveConsent(userId)===null)throw new Error('Enable outfit archiving before saving a look.');
      if(!input.confirmedAccurate)throw new Error('Confirm the outfit and fragrance selection first.');
      const run=await store.getRecommendation(userId,input.requestId),outfit=run?.outfit;
      if(!run||!outfit||!(await store.getOutfit(userId,outfit.analysisId)))throw new Error('Reviewed recommendation not found or expired.');
      const selected=[...input.bottleIds].sort(),selection=JSON.stringify(selected);
      if(selected.length<1||selected.length>2||new Set(selected).size!==selected.length||
        !outfit.choices.some(choice=>JSON.stringify([...choice].sort())===selection)){
        throw new Error('Select a fragrance or pair offered for this outfit.');
      }
      const bottles=(await Promise.all(input.bottleIds.map(id=>store.getBottle(userId,id)))).map(bottle=>{
        if(!bottle||bottle.ownership!=='OWNED'||bottle.variantId!==outfit.variants[bottle.id]){
          throw new Error('The selected owned fragrance has changed. Find fresh matches.');
        }
        const {id,variantId,brand,name,concentration,color,shape}=bottle;
        return {id,variantId,brand,name,concentration,color,shape};
      });
      // Direct deletion and expiration cleanup can run independently of the owner lock.
      const forUpdate=store.db.engine==='postgres'?' FOR UPDATE':'';
      const previous=await store.db.get<{id:string}>(
        'SELECT id FROM saved_looks WHERE user_id=? AND analysis_id=?'+forUpdate,userId,outfit.analysisId);
      const id=previous?.id??randomUUID();
      const photo=await store.db.get<PhotoRow>(
        'SELECT id,look_id,sealed FROM private_photos WHERE user_id=? AND analysis_id=? AND (expires IS NULL OR expires>?)'+forUpdate,
        userId,outfit.analysisId,Date.now());
      const {occasion,setting,tempC,indoorTempC,policy,mood,vibe}=run.context;
      const look:SavedLook={
        id,analysisId:outfit.analysisId,profile:outfitSchema.parse(outfit.profile),bottles,
        context:{occasion,setting,tempC,indoorTempC,policy,mood,vibe},photoAvailable:!!photo,createdAt:new Date().toISOString()
      };
      let promoted:Buffer|undefined;
      if(photo&&!photo.look_id){
        const bytes=this.unseal(userId,'pending|'+outfit.analysisId,photo.sealed);
        try{promoted=this.seal(userId,'look|'+id,bytes);}finally{bytes.fill(0);}
      }
      await store.db.run(`
        INSERT INTO saved_looks (id,user_id,analysis_id,body,created) VALUES (?,?,?,?,?)
        ON CONFLICT(user_id,analysis_id) DO UPDATE SET body=excluded.body,created=excluded.created
      `,id,userId,outfit.analysisId,JSON.stringify(look),Date.now());
      if(photo&&promoted){
        await store.db.run('UPDATE private_photos SET look_id=?,sealed=?,expires=NULL WHERE id=? AND user_id=?',
          id,promoted,photo.id,userId);
      }
      return look;
    });
  }

  async list(userId:string):Promise<SavedLook[]>{
    if(await this.store.archiveConsent(userId)===null)return [];
    const rows=await this.store.db.all<{body:string}>('SELECT body FROM saved_looks WHERE user_id=? ORDER BY created DESC',userId);
    return rows.map(row=>JSON.parse(row.body));
  }

  async photo(userId:string,lookId:string):Promise<ImageInput|null>{
    if(await this.store.archiveConsent(userId)===null)return null;
    const row=await this.store.db.get<{sealed:Uint8Array}>(`
      SELECT p.sealed FROM private_photos p JOIN saved_looks l ON l.id=p.look_id
      WHERE p.user_id=? AND l.user_id=? AND l.id=? AND p.expires IS NULL
    `,userId,userId,lookId);
    if(!row)return null;
    const bytes=this.unseal(userId,'look|'+lookId,row.sealed);
    try{return {mime:'image/jpeg',data:bytes.toString('base64')};}finally{bytes.fill(0);}
  }

  async remove(userId:string,lookId:string){
    return (await this.store.db.run('DELETE FROM saved_looks WHERE id=? AND user_id=?',lookId,userId))>0;
  }
}
