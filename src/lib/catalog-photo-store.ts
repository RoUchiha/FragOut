import {createHash} from 'node:crypto';
import type {DataConnection} from './database.ts';
import {findCatalogProfile} from './catalog.ts';
import {catalogEditionById,catalogProfilesById,findPublicCatalogEdition,searchCatalogEditions} from './catalog-editions.ts';
import {catalogReferenceUrl} from './catalog-ratings.ts';
import type {Bottle,CatalogAdminEntry,CatalogEdition,CatalogProfile,CatalogSource} from './types.ts';

export interface AutomaticCatalogPhoto {bytes:Buffer;sourceUrl:string;publisher:string}
type SelectPhoto=(edition:CatalogEdition)=>Promise<AutomaticCatalogPhoto|null>;
type AdmitLookup=()=>boolean|Promise<boolean>;
type PhotoRow={edition_id:string;mode:'automatic'|'override';image_hash:string|null;source_url:string|null;publisher:string|null;updated_at:number};
type Label=Pick<Bottle,'brand'|'name'|'concentration'>;
const retryInterval=2*60*60*1000;
const leaseDuration=30_000;
const lookupLimit=3;
const imagePath=(hash:string)=>'/api/catalog-image/'+hash;

export class CatalogPhotoStore {
 private readonly db:DataConnection;
 private readonly pending=new Map<string,Promise<'denied'|undefined>>();

 constructor(db:DataConnection) {
  this.db=db;
 }

 async isAdmin(userId:string){return !!(await this.db.get('SELECT 1 FROM catalog_admins WHERE user_id=?',userId));}

 async setAdmin(email:string,enabled:boolean) {
  if(this.db.engine==='postgres')throw new Error('Cloud catalog access is managed by the database administrator.');
  return this.db.transaction(async db=>{
   const user=await db.get<{id:string}>('SELECT id FROM users WHERE email=? AND demo=0',email.trim().toLowerCase());
   if(!user)return false;
   if(enabled)await db.run('INSERT INTO catalog_admins (user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING',user.id);
   else await db.run('DELETE FROM catalog_admins WHERE user_id=?',user.id);
   return true;
  });
 }

 private async currentPhotos(editionIds:string[]) {
  const ids=[...new Set(editionIds)];
  if(!ids.length)return new Map<string,PhotoRow>();
  const rows=await this.db.all<PhotoRow>(`
   SELECT photo.edition_id,photo.mode,photo.image_hash,photo.source_url,photo.publisher,photo.updated_at
   FROM catalog_photos photo WHERE photo.edition_id IN (${ids.map(()=>'?').join(',')})
   AND (photo.mode='override' OR NOT EXISTS (
    SELECT 1 FROM catalog_photos WHERE edition_id=photo.edition_id AND mode='override'
   ))
  `,...ids);
  return new Map(rows.map(row=>[row.edition_id,row]));
 }

 async asset(hash:string) {
  if(!/^[a-f0-9]{64}$/.test(hash))return null;
  const row=await this.db.get<{bytes:Uint8Array}>(`
   SELECT bytes FROM catalog_photos photo WHERE image_hash=?
   AND (mode='override' OR NOT EXISTS (
    SELECT 1 FROM catalog_photos WHERE edition_id=photo.edition_id AND mode='override'
   )) LIMIT 1
  `,hash);
  return row?Buffer.from(row.bytes):null;
 }

 private async write(edition:CatalogEdition,mode:PhotoRow['mode'],bytes:Buffer|null,sourceUrl:string|null,publisher:string|null) {
  const hash=bytes?createHash('sha256').update(bytes).digest('hex'):null;
  await this.db.run(`
   INSERT INTO catalog_photos (edition_id,mode,image_hash,bytes,source_url,publisher,updated_at) VALUES (?,?,?,?,?,?,?)
   ON CONFLICT(edition_id,mode) DO UPDATE SET image_hash=excluded.image_hash,bytes=excluded.bytes,
    source_url=excluded.source_url,publisher=excluded.publisher,updated_at=excluded.updated_at
  `,edition.id,mode,hash,bytes,sourceUrl,publisher,Date.now());
 }

 async saveAutomatic(edition:CatalogEdition,photo:AutomaticCatalogPhoto) {
  const url=catalogReferenceUrl(photo.sourceUrl);
  if(url&&photo.publisher&&photo.publisher.length<=100&&photo.bytes.length>0&&photo.bytes.length<=650_000){
   await this.write(edition,'automatic',photo.bytes,url,photo.publisher);
  }
 }

 async setOverride(edition:CatalogEdition,bytes:Buffer|null){await this.write(edition,'override',bytes,null,null);}

 async reset(edition:CatalogEdition){await this.db.run("DELETE FROM catalog_photos WHERE edition_id=? AND mode='override'",edition.id);}

 async reserve(id:string,now=Date.now(),force=false) {
  const changes=await this.db.run(`
   INSERT INTO catalog_photo_attempts (edition_id,retry_at,lease_until) VALUES (?,0,?)
   ON CONFLICT(edition_id) DO UPDATE SET lease_until=excluded.lease_until
   WHERE catalog_photo_attempts.lease_until<=? AND (catalog_photo_attempts.retry_at<=? OR ?=1)
  `,id,now+leaseDuration,now,now,force?1:0);
  return changes>0;
 }

 async ensure(edition:CatalogEdition|null,select:SelectPhoto,admit:AdmitLookup,force=false):Promise<void> {
  if(!edition||catalogProfilesById.get(edition.id)?.photo)return;
  const existing=this.pending.get(edition.id);
  if(existing){
   if(await existing==='denied')await this.ensure(edition,select,admit,force);
   return;
  }
  if(this.pending.size>=lookupLimit)return;
  const task=this.lookup(edition,select,admit,force).finally(()=>this.pending.delete(edition.id));
  this.pending.set(edition.id,task);
  await task;
 }

 private async lookup(edition:CatalogEdition,select:SelectPhoto,admit:AdmitLookup,force:boolean):Promise<'denied'|undefined> {
  const current=(await this.currentPhotos([edition.id])).get(edition.id);
  if(current&&(!force||current.mode==='override'))return;
  const now=Date.now();
  const blocked=await this.db.get(`
   SELECT 1 FROM catalog_photo_attempts WHERE edition_id=?
   AND (lease_until>? OR (retry_at>? AND ?=1))
  `,edition.id,now,now,force?0:1);
  if(blocked)return;
  if(!await admit())return 'denied';
  const startedAt=Date.now();
  if(!await this.reserve(edition.id,startedAt,force))return;
  let photo:AutomaticCatalogPhoto|null=null;
  try{photo=await select(edition);}catch{/* An unavailable source leaves the edition eligible after the retry window. */}
  await this.db.transaction(async tx=>{
   // Only the worker that still owns this lease may publish or set the next retry time.
   const released=await tx.run(
    'UPDATE catalog_photo_attempts SET lease_until=0,retry_at=? WHERE edition_id=? AND lease_until=?',
    Date.now()+retryInterval,edition.id,startedAt+leaseDuration);
   if(released&&photo)await new CatalogPhotoStore(tx).saveAutomatic(edition,photo);
  });
 }

 async profile(label:Label,base=findCatalogProfile(label)):Promise<CatalogProfile|null> {
  const edition=findPublicCatalogEdition(label,base);
  if(!edition)return base;
  const rows=await this.currentPhotos([edition.id]);
  return this.profileWithPhoto(edition,base,rows.get(edition.id));
 }

 async profiles(labels:readonly Label[]):Promise<(CatalogProfile|null)[]> {
  const matches=labels.map(label=>{
   const base=findCatalogProfile(label);
   return {base,edition:findPublicCatalogEdition(label,base)};
  });
  const rows=await this.currentPhotos(matches.flatMap(({edition})=>edition?[edition.id]:[]));
  return matches.map(({edition,base})=>edition?this.profileWithPhoto(edition,base,rows.get(edition.id)):base);
 }

 private profileWithPhoto(edition:CatalogEdition,base:CatalogProfile|null,row:PhotoRow|undefined):CatalogProfile|null {
  if(!row)return base;
  const sources=base?.sources.filter(source=>source.kind!=='photo')??[];
  if(!row.image_hash)return base?{...base,sources,photo:undefined,additionalPhotos:undefined}:null;
  const path=imagePath(row.image_hash);
  const source:CatalogSource={id:'catalog-live-photo',kind:'photo',publisher:row.publisher??'FragDex admin',
   url:row.source_url??path,credit:row.mode==='override'?'Manual catalog photo':'Product photo'};
  const profile=base??{...edition,checkedAt:new Date(row.updated_at).toISOString().slice(0,10),
   notes:[],performance:[],ratings:[],links:[],sources:[]};
  return {...profile,sources:[...sources,source],additionalPhotos:undefined,
   photo:{path,caption:edition.name+' bottle',sourceId:source.id}};
 }

 async entry(edition:CatalogEdition):Promise<CatalogAdminEntry> {
  const rows=await this.currentPhotos([edition.id]);
  return this.entryWithPhoto(edition,rows.get(edition.id));
 }

 private entryWithPhoto(edition:CatalogEdition,row:PhotoRow|undefined):CatalogAdminEntry {
  const profile=this.profileWithPhoto(edition,catalogProfilesById.get(edition.id)??null,row);
  const source=profile?.sources.find(item=>item.id===profile.photo?.sourceId);
  return {...edition,status:row?(row.image_hash?row.mode:'hidden'):(profile?.photo?'bundled':'missing'),
   ...(profile?.photo?{photoPath:profile.photo.path}:{}),
   ...(source&&catalogReferenceUrl(source.url)?{source:{publisher:source.publisher,url:source.url}}:{})};
 }

 async search(q:string) {
  const recent=q?[]:(await this.db.all<{edition_id:string}>(`
   SELECT edition_id FROM catalog_photo_attempts
   ORDER BY CASE WHEN retry_at>=lease_until THEN retry_at ELSE lease_until END DESC LIMIT 40
  `)).map(row=>catalogEditionById(row.edition_id)).filter(edition=>edition!==null);
  const unique=new Map([...recent,...searchCatalogEditions(q)].map(edition=>[edition.id,edition]));
  const editions=[...unique.values()].slice(0,40);
  const rows=await this.currentPhotos(editions.map(edition=>edition.id));
  return editions.map(edition=>this.entryWithPhoto(edition,rows.get(edition.id)));
 }
}
