import {createCipheriv,createDecipheriv,hkdfSync,randomBytes,randomUUID} from 'node:crypto';
import type {Store} from './store.ts';
import type {SavedLook} from './types.ts';
import {outfitSchema,validateImage,type ImageInput} from './outfit.ts';

export const PENDING_PHOTO_MS=15*60*1000;
type PhotoRow={id:string;look_id:string|null;sealed:Uint8Array};
export class PrivateLooks {
 private store:Store;
 private key:Buffer;
 constructor(store:Store,installationKey:Buffer){
  if(installationKey.length!==32)throw new Error('Invalid private photo configuration.');
  this.store=store;this.key=Buffer.from(hkdfSync('sha256',installationKey,Buffer.alloc(0),'FragOut private outfit images v1',32));
 }
 private enabled(userId:string){return !!this.store.user(userId)&&this.store.state(userId).preferences.archiveOutfits===true;}
 private seal(userId:string,purpose:string,bytes:Buffer){
  const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.key,nonce);
  cipher.setAAD(Buffer.from(userId+'|'+purpose));
  const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);return Buffer.concat([nonce,cipher.getAuthTag(),encrypted]);
 }
 private unseal(userId:string,purpose:string,sealed:Uint8Array){
  try{const value=Buffer.from(sealed);if(value.length<29)throw new Error();
   const cipher=createDecipheriv('aes-256-gcm',this.key,value.subarray(0,12));cipher.setAAD(Buffer.from(userId+'|'+purpose));cipher.setAuthTag(value.subarray(12,28));
   return Buffer.concat([cipher.update(value.subarray(28)),cipher.final()]);
  }catch{throw new Error('Saved photo integrity could not be verified.');}
 }
 stagePhoto(userId:string,analysisId:string,image:ImageInput,requested:boolean,consent:number|null=this.store.archiveConsent(userId)){
  this.store.pruneOutfits();
  if(!requested||consent===null||consent!==this.store.archiveConsent(userId)||!this.store.getOutfit(userId,analysisId))return false;
  if(image.mime!=='image/jpeg')throw new Error('Private photos must be sanitized JPEG images.');
  const bytes=validateImage(image),sealed=this.seal(userId,'pending|'+analysisId,bytes);
  try{return this.store.db.prepare('INSERT INTO private_photos VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,analysis_id) DO UPDATE SET sealed=excluded.sealed,expires=excluded.expires WHERE private_photos.look_id IS NULL').run(randomUUID(),userId,analysisId,null,sealed,Date.now()+PENDING_PHOTO_MS).changes>0;}
  finally{bytes.fill(0);}
 }
 save(userId:string,input:{requestId:string;bottleIds:string[];confirmedAccurate:boolean}):SavedLook{
  this.store.pruneOutfits();if(!this.enabled(userId))throw new Error('Enable outfit archiving before saving a look.');
  if(!input.confirmedAccurate)throw new Error('Confirm the outfit and fragrance selection first.');
  const run=this.store.getRecommendation(userId,input.requestId),outfit=run?.outfit;
  if(!run||!outfit||!this.store.getOutfit(userId,outfit.analysisId))throw new Error('Reviewed recommendation not found or expired.');
  const selected=[...input.bottleIds].sort();
  if(selected.length<1||selected.length>2||new Set(selected).size!==selected.length||!outfit.choices.some(choice=>JSON.stringify([...choice].sort())===JSON.stringify(selected)))throw new Error('Select a fragrance or pair offered for this outfit.');
  const state=this.store.state(userId),bottles=input.bottleIds.map(id=>state.bottles.find(b=>b.id===id&&b.ownership==='OWNED'&&b.variantId===outfit.variants[id]));
  if(bottles.some(b=>!b))throw new Error('The selected owned fragrance has changed. Find fresh matches.');
  const previous=this.store.db.prepare('SELECT id FROM saved_looks WHERE user_id=? AND analysis_id=?').get(userId,outfit.analysisId) as {id:string}|undefined;
  const id=previous?.id??randomUUID(),photo=this.store.db.prepare('SELECT id,look_id,sealed FROM private_photos WHERE user_id=? AND analysis_id=? AND (expires IS NULL OR expires>?)').get(userId,outfit.analysisId,Date.now()) as PhotoRow|undefined;
  const context=run.context;
  const look:SavedLook={id,analysisId:outfit.analysisId,profile:outfitSchema.parse(outfit.profile),bottles:bottles.map(b=>({id:b!.id,variantId:b!.variantId,brand:b!.brand,name:b!.name,concentration:b!.concentration,color:b!.color,shape:b!.shape})),context:{occasion:context.occasion,setting:context.setting,tempC:context.tempC,indoorTempC:context.indoorTempC,policy:context.policy,mood:context.mood,vibe:context.vibe},photoAvailable:!!photo,createdAt:new Date().toISOString()};
  const bytes=photo&&!photo.look_id?this.unseal(userId,'pending|'+outfit.analysisId,photo.sealed):null;
  this.store.db.exec('BEGIN IMMEDIATE');try{
   this.store.db.prepare('INSERT INTO saved_looks VALUES(?,?,?,?,?) ON CONFLICT(user_id,analysis_id) DO UPDATE SET body=excluded.body,created=excluded.created').run(id,userId,outfit.analysisId,JSON.stringify(look),Date.now());
   if(photo&&bytes)this.store.db.prepare('UPDATE private_photos SET look_id=?,sealed=?,expires=NULL WHERE id=? AND user_id=?').run(id,this.seal(userId,'look|'+id,bytes),photo.id,userId);
   this.store.db.exec('COMMIT');return look;
  }catch(error){this.store.db.exec('ROLLBACK');throw error;}finally{bytes?.fill(0);}
 }
 list(userId:string):SavedLook[]{
  this.store.pruneOutfits();if(!this.enabled(userId))return [];
  return (this.store.db.prepare('SELECT body FROM saved_looks WHERE user_id=? ORDER BY created DESC').all(userId) as {body:string}[]).map(r=>JSON.parse(r.body));
 }
 photo(userId:string,lookId:string):ImageInput|null{
  if(!this.enabled(userId))return null;
  const row=this.store.db.prepare('SELECT p.sealed FROM private_photos p JOIN saved_looks l ON l.id=p.look_id WHERE p.user_id=? AND l.user_id=? AND l.id=?').get(userId,userId,lookId) as {sealed:Uint8Array}|undefined;
  if(!row)return null;const bytes=this.unseal(userId,'look|'+lookId,row.sealed);
  try{return {mime:'image/jpeg',data:bytes.toString('base64')};}finally{bytes.fill(0);}
 }
 remove(userId:string,lookId:string){return this.store.db.prepare('DELETE FROM saved_looks WHERE id=? AND user_id=?').run(lookId,userId).changes>0;}
}
