import {randomUUID,randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {defaultContext,defaultPreferences,defaultShortcuts,demoBottles} from './seed.ts';
import {openConfiguredDatabase,openSqlite,type DataConnection} from './database.ts';
import {CatalogPhotoStore} from './catalog-photo-store.ts';
import {catalogThumbnailPhotos} from './catalog-photos.ts';
import type {AppState,Bottle,OutfitReceipt,OutfitSnapshot,Preferences,RecommendationSnapshot,SavedLook,Shortcut,User,WearContext,WearEvent} from './types.ts';

const DAY_MS=86400000;
const ACCOUNT_LIFETIME_MS=7*DAY_MS;
const OUTFIT_ANALYSIS_MS=15*60*1000;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
type UserRow={id:string;name:string;email:string|null;demo:number;password?:string|null};
type BodyRow={body:string};
type Settings=Pick<AppState,'preferences'|'context'|'shortcuts'>;
type SettingsPatch={preferences?:Omit<Preferences,'archiveOutfits'>&{archiveOutfits?:boolean};context?:WearContext;shortcuts?:Shortcut[]};
const publicUser=(u:UserRow):User=>({id:u.id,name:u.name,email:u.email,demo:!!u.demo});
const identity=(b:Pick<Bottle,'brand'|'name'|'concentration'>)=>hash([b.brand,b.name,b.concentration].map(s=>s.trim().toLowerCase().replace(/\s+/g,' ')).join('|'));
const newBottle=(input:Bottle):Bottle=>({...input,id:randomUUID(),variantId:input.provenance==='demo'&&input.variantId?input.variantId:identity(input)});
const comboKey=(ids:string[])=>JSON.stringify([...ids].sort());

export class Store {
  readonly db:DataConnection;
  readonly catalogPhotos:CatalogPhotoStore;

  constructor(pathOrConnection:string|DataConnection){
    this.db=typeof pathOrConnection==='string'?openSqlite(pathOrConnection):pathOrConnection;
    this.catalogPhotos=new CatalogPhotoStore(this.db);
  }

  async close(){await this.db.close();}

  private get rowLock(){return this.db.engine==='postgres'?' FOR UPDATE':'';}
  private get insertionOrder(){return this.db.engine==='postgres'?'sort_order':'rowid';}

  async withOwnerTransaction<T>(userId:string,work:(store:Store)=>Promise<T>):Promise<T>{
    return this.db.transaction(async tx=>{
      const user=await tx.get('SELECT id FROM users WHERE id=? AND (demo=0 OR created>?)'+this.rowLock,userId,Date.now()-ACCOUNT_LIFETIME_MS);
      if(!user)throw new Error('Account not found.');
      return work(new Store(tx));
    });
  }

  async register(name:string,email:string,password:string):Promise<User>{
    if(password.length<12)throw new Error('Use a password with at least 12 characters.');
    const salt=randomBytes(16).toString('hex'),digest=scryptSync(password,salt,64).toString('hex');
    const user={id:randomUUID(),name,email:email.trim().toLowerCase(),demo:false};
    await this.db.transaction(async tx=>{
      const inserted=await tx.run(`INSERT INTO users (id,name,email,password,demo,created) VALUES (?,?,?,?,0,?)
        ON CONFLICT(email) DO NOTHING`,user.id,user.name,user.email,`${salt}:${digest}`,Date.now());
      if(!inserted)throw new Error('Unable to create this account. Try signing in or use another email.');
      await this.initSettings(tx,user.id);
    });
    return user;
  }

  private async initSettings(db:DataConnection,userId:string){
    await db.run('INSERT INTO settings (user_id,body) VALUES (?,?)',userId,
      JSON.stringify({preferences:defaultPreferences,context:defaultContext,shortcuts:defaultShortcuts}));
  }

  async createDemo():Promise<User>{
    const user={id:randomUUID(),name:'Scent explorer',email:null,demo:true};
    const bottles=demoBottles.map(newBottle);
    await this.db.transaction(async tx=>{
      await tx.run('INSERT INTO users (id,name,email,password,demo,created) VALUES (?,?,NULL,NULL,1,?)',user.id,user.name,Date.now());
      await this.initSettings(tx,user.id);
      await tx.run('INSERT INTO bottles (id,user_id,body) VALUES '+bottles.map(()=>'(?,?,?)').join(','),
        ...bottles.flatMap(bottle=>[bottle.id,user.id,JSON.stringify(bottle)]));
    });
    return user;
  }

  async user(id:string):Promise<User|null>{
    const row=await this.db.get<UserRow>('SELECT id,name,email,demo FROM users WHERE id=? AND (demo=0 OR created>?)',id,Date.now()-ACCOUNT_LIFETIME_MS);
    return row?publicUser(row):null;
  }

  async login(email:string,password:string):Promise<User|null>{
    const row=await this.db.get<UserRow>('SELECT id,name,email,demo,password FROM users WHERE email=? AND demo=0',email.trim().toLowerCase());
    const parts=row?.password?.split(':');
    const salt=parts?.[0]??'00000000000000000000000000000000';
    const expected=parts?.[1]?Buffer.from(parts[1],'hex'):Buffer.alloc(64);
    const actual=scryptSync(password,salt,64);
    return row&&parts&&expected.length===actual.length&&timingSafeEqual(actual,expected)?publicUser(row):null;
  }

  async createSession(userId:string){
    const token=randomBytes(32).toString('hex');
    await this.db.run('INSERT INTO sessions (token_hash,user_id,expires) VALUES (?,?,?)',hash(token),userId,Date.now()+ACCOUNT_LIFETIME_MS);
    return token;
  }

  async sessionUser(token:string,lock=false):Promise<User|null>{
    if(!token||token.length!==64)return null;
    const now=Date.now();
    const row=await this.db.get<UserRow>(`
      SELECT u.id,u.name,u.email,u.demo FROM sessions s JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=? AND s.expires>? AND (u.demo=0 OR u.created>?)
    `+(lock&&this.db.engine==='postgres'?' FOR SHARE OF s':''),hash(token),now,now-ACCOUNT_LIFETIME_MS);
    return row?publicUser(row):null;
  }

  async revokeSession(token:string){await this.db.run('DELETE FROM sessions WHERE token_hash=?',hash(token));}

  private async settings(userId:string):Promise<Settings>{
    const row=await this.db.get<BodyRow>('SELECT body FROM settings WHERE user_id=?',userId);
    if(!row)throw new Error('Account not found.');
    const saved=JSON.parse(row.body) as Settings;
    return {...saved,preferences:{...defaultPreferences,...saved.preferences}};
  }

  private async savedComboEvents(userId:string){
    const pair=this.db.engine==='postgres'
      ? "jsonb_array_length(body::jsonb -> 'bottleIds')=2"
      : "json_array_length(body,'$.bottleIds')=2";
    const json=this.db.engine==='postgres'?'body::jsonb':'body';
    const rows=await this.db.all<BodyRow>(`
      SELECT body FROM wear_events WHERE user_id=?
      AND ${json} ->> 'reaction'='saved' AND ${pair}
      ORDER BY created DESC,${this.insertionOrder} DESC
    `,userId);
    return rows.map(row=>JSON.parse(row.body) as WearEvent);
  }

  async state(userId:string,allHistory=false):Promise<AppState>{
    const user=await this.user(userId);
    if(!user)throw new Error('Account not found.');
    const [settings,admin,bottleRows,historyRows,comboEvents]=await Promise.all([
      this.settings(userId),
      this.catalogPhotos.isAdmin(userId),
      this.db.all<BodyRow>('SELECT body FROM bottles WHERE user_id=? ORDER BY '+this.insertionOrder,userId),
      this.db.all<BodyRow>('SELECT body FROM wear_events WHERE user_id=? ORDER BY created DESC,'+this.insertionOrder+' DESC'+(allHistory?'':' LIMIT 200'),userId),
      this.savedComboEvents(userId),
    ]);
    if(admin)user.catalogAdmin=true;
    const storedBottles=bottleRows.map(row=>JSON.parse(row.body) as Bottle);
    const profiles=await this.catalogPhotos.profiles(storedBottles);
    const bottles=storedBottles.map((bottle,index)=>{
      const catalogPhotos=catalogThumbnailPhotos(profiles[index]).map(photo=>photo.path);
      return catalogPhotos.length?{...bottle,catalogPhoto:catalogPhotos[0],catalogPhotos}:bottle;
    });
    const likes=new Map<string,WearEvent>();
    for(const event of comboEvents){
      const key=comboKey(event.bottleIds);
      if(!likes.has(key))likes.set(key,event);
    }
    const history=historyRows.map(row=>JSON.parse(row.body) as WearEvent);
    return {user,bottles,history,...settings,likedCombos:[...likes.values()]};
  }

  async pruneOutfits(){
    if(this.db.engine!=='sqlite')return;
    const now=Date.now();
    await this.db.run('DELETE FROM outfit_analyses WHERE created<=?',now-OUTFIT_ANALYSIS_MS);
    await this.db.run(`
      UPDATE recommendation_runs SET body=json_remove(body,'$.outfit')
      WHERE json_type(body,'$.outfit') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM outfit_analyses a WHERE a.user_id=recommendation_runs.user_id
        AND a.id=json_extract(recommendation_runs.body,'$.outfit.analysisId')
      )
    `);
    await this.db.run('DELETE FROM private_photos WHERE expires IS NOT NULL AND expires<=?',now);
  }

  async archiveConsent(userId:string):Promise<number|null>{
    const row=await this.db.get<{body:string;epoch:number|null}>(`
      SELECT s.body,c.epoch FROM users u JOIN settings s ON s.user_id=u.id
      LEFT JOIN archive_consents c ON c.user_id=u.id
      WHERE u.id=? AND (u.demo=0 OR u.created>?)
    `,userId,Date.now()-ACCOUNT_LIFETIME_MS);
    return row&&(JSON.parse(row.body) as Settings).preferences?.archiveOutfits===true?(row.epoch??0):null;
  }

  async exportState(userId:string){
    await this.pruneOutfits();
    const [state,analyses,looks]=await Promise.all([
      this.state(userId,true),
      this.db.all<BodyRow>('SELECT body FROM outfit_analyses WHERE user_id=? AND created>?',userId,Date.now()-OUTFIT_ANALYSIS_MS),
      this.db.all<BodyRow>('SELECT body FROM saved_looks WHERE user_id=?',userId),
    ]);
    return {...state,outfitAnalyses:analyses.map(r=>JSON.parse(r.body) as OutfitReceipt),
      savedLooks:looks.map(r=>JSON.parse(r.body) as SavedLook)};
  }

  async saveOutfit(userId:string,receipt:OutfitReceipt){
    await this.pruneOutfits();
    await this.db.run('INSERT INTO outfit_analyses (id,user_id,body,created) VALUES (?,?,?,?)',receipt.id,userId,JSON.stringify(receipt),Date.now());
  }

  async getOutfit(userId:string,id:string){
    await this.pruneOutfits();
    const row=await this.db.get<BodyRow>('SELECT body FROM outfit_analyses WHERE user_id=? AND id=? AND created>?',userId,id,Date.now()-OUTFIT_ANALYSIS_MS);
    return row?JSON.parse(row.body) as OutfitReceipt:null;
  }

  async addBottle(userId:string,input:Bottle):Promise<Bottle>{
    const bottle=newBottle(input);
    await this.db.run('INSERT INTO bottles (id,user_id,body) VALUES (?,?,?)',bottle.id,userId,JSON.stringify(bottle));
    return bottle;
  }

  async getBottle(userId:string,id:string):Promise<Bottle|null>{return this.readBottle(userId,id);}

  private async readBottle(userId:string,id:string,lock=false):Promise<Bottle|null>{
    const row=await this.db.get<BodyRow>('SELECT body FROM bottles WHERE id=? AND user_id=?'+(lock?this.rowLock:''),id,userId);
    return row?JSON.parse(row.body) as Bottle:null;
  }

  async updateBottle(userId:string,id:string,patch:Partial<Bottle>):Promise<Bottle|null>{
    return this.withOwnerTransaction(userId,async store=>{
      const before=await store.readBottle(userId,id,true);
      return before?store.patchBottle(userId,before,patch):null;
    });
  }

  private async patchBottle(userId:string,before:Bottle,patch:Partial<Bottle>):Promise<Bottle>{
    const bottle={...before,...patch,id:before.id};
    const variant=identity(bottle);
    if(variant!==identity(before)){
      bottle.variantId=variant;bottle.profileKnown=false;bottle.notes=[];bottle.family='';
      bottle.climate='UNKNOWN';bottle.strength=1;bottle.provenance='unknown';
    }
    await this.db.run('UPDATE bottles SET body=? WHERE id=? AND user_id=?',JSON.stringify(bottle),bottle.id,userId);
    return bottle;
  }

  async removeBottle(userId:string,id:string){
    return (await this.db.run('DELETE FROM bottles WHERE id=? AND user_id=?',id,userId))>0;
  }

  async saveSettings(userId:string,patch:SettingsPatch){
    await this.withOwnerTransaction(userId,async store=>{
      const saved=await store.settings(userId);
      await store.db.run('UPDATE settings SET body=? WHERE user_id=?',JSON.stringify({
        preferences:{...saved.preferences,...patch.preferences},
        context:patch.context??saved.context,shortcuts:patch.shortcuts??saved.shortcuts,
      }),userId);
      if(patch.preferences?.archiveOutfits===false){
        await store.db.run(`INSERT INTO archive_consents (user_id,epoch) VALUES (?,1)
          ON CONFLICT(user_id) DO UPDATE SET epoch=archive_consents.epoch+1`,userId);
        await store.db.run('DELETE FROM saved_looks WHERE user_id=?',userId);
        await store.db.run('DELETE FROM private_photos WHERE user_id=?',userId);
        const redact=store.db.engine==='postgres'
          ? "UPDATE recommendation_runs SET body=(body::jsonb - 'outfit')::text WHERE user_id=? AND body::jsonb -> 'outfit' IS NOT NULL"
          : "UPDATE recommendation_runs SET body=json_remove(body,'$.outfit') WHERE user_id=? AND json_type(body,'$.outfit') IS NOT NULL";
        await store.db.run(redact,userId);
      }
    });
  }

  async recordRecommendation(userId:string,context:WearContext,bottleIds:string[],outfit?:OutfitSnapshot,
    archiveEpoch?:number|null,authorize?:(store:Store)=>Promise<void>){
    const id=randomUUID();
    const insert=async(db:DataConnection,retained?:OutfitSnapshot)=>{
      const body=JSON.stringify({context,bottleIds,...(retained?{outfit:retained}:{})});
      await db.run('INSERT INTO recommendation_runs (id,user_id,body,created) VALUES (?,?,?,?)',id,userId,body,Date.now());
    };
    if(outfit&&archiveEpoch!==undefined){
      await this.withOwnerTransaction(userId,async store=>{
        const active=archiveEpoch!==null&&await store.archiveConsent(userId)===archiveEpoch&&await store.db.get(
          'SELECT 1 FROM outfit_analyses WHERE user_id=? AND id=? AND created>?',userId,outfit.analysisId,Date.now()-OUTFIT_ANALYSIS_MS);
        if(active)await authorize?.(store);
        await insert(store.db,active?outfit:undefined);
      });
    }else await insert(this.db,outfit);
    return id;
  }

  async getRecommendation(userId:string,id:string){
    await this.pruneOutfits();
    return this.readRecommendation(userId,id);
  }

  private async readRecommendation(userId:string,id:string){
    const now=Date.now();
    const json=this.db.engine==='postgres'?'run.body::jsonb':'run.body';
    const redacted=this.db.engine==='postgres'?`(${json} - 'outfit')::text`:"json_remove(run.body,'$.outfit')";
    const row=await this.db.get<BodyRow>(`
      SELECT CASE WHEN ${json} -> 'outfit' IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM outfit_analyses a WHERE a.user_id=run.user_id
        AND a.id=${json} -> 'outfit' ->> 'analysisId' AND a.created>?
      ) THEN ${redacted} ELSE run.body END AS body
      FROM recommendation_runs run WHERE run.user_id=? AND run.id=? AND run.created>?
    `,now-OUTFIT_ANALYSIS_MS,userId,id,now-DAY_MS);
    return row?JSON.parse(row.body) as RecommendationSnapshot:null;
  }

  async feedback(userId:string,ids:string[],reaction:WearEvent['reaction'],occasion:string,requestId?:string){
    return this.withOwnerTransaction(userId,store=>store.writeFeedback(userId,ids,reaction,occasion,requestId));
  }

  private async writeFeedback(userId:string,ids:string[],reaction:WearEvent['reaction'],occasion:string,requestId?:string){
    if(ids.length<1||ids.length>2||new Set(ids).size!==ids.length)throw new Error('Choose one or two bottles you own.');
    const bottles=await Promise.all(ids.map(id=>this.readBottle(userId,id,true)));
    if(!bottles.every(bottle=>bottle?.ownership==='OWNED'))throw new Error('Choose one or two bottles you own.');
    const settings=await this.settings(userId);
    let context={...settings.context,occasion};
    if(requestId){
      const run=await this.readRecommendation(userId,requestId);
      if(!run)throw new Error('This recommendation has expired. Please generate a new pick.');
      if(ids.some(id=>!run.bottleIds.includes(id)))throw new Error('Bottle does not belong to this recommendation.');
      context=run.context;
    }
    const now=Date.now();
    const event:WearEvent={id:randomUUID(),bottleIds:ids,names:bottles.map(bottle=>bottle!.name),occasion:context.occasion,reaction,at:new Date(now).toISOString(),context};
    await this.db.run('INSERT INTO wear_events (id,user_id,body,created) VALUES (?,?,?,?)',event.id,userId,JSON.stringify(event),now);
    if(ids.length===1&&(reaction==='loved'||reaction==='disliked')){
      await this.patchBottle(userId,bottles[0]!,{rating:reaction==='loved'?5:1,favorite:reaction==='loved'});
    }
    return event;
  }

  async setComboLike(userId:string,ids:string[],liked:boolean,occasion:string,requestId?:string){
    if(ids.length!==2||ids[0]===ids[1])throw new Error('Choose two distinct bottles you own.');
    const key=comboKey(ids);
    await this.withOwnerTransaction(userId,async store=>{
      const matches=(await store.savedComboEvents(userId)).filter(event=>comboKey(event.bottleIds)===key);
      if(liked){
        if(!matches.length)await store.writeFeedback(userId,ids,'saved',occasion,requestId);
      }else{
        for(const event of matches)await store.deleteEvent(userId,event.id);
      }
    });
  }

  async deleteEvent(userId:string,id:string){
    return (await this.db.run('DELETE FROM wear_events WHERE id=? AND user_id=?',id,userId))>0;
  }

  async deleteUser(userId:string){await this.db.run('DELETE FROM users WHERE id=?',userId);}

  async limit(key:string,max:number,periodMs:number){
    const now=Date.now();
    if(this.db.engine==='sqlite')await this.db.run('DELETE FROM rate_limits WHERE expires<=?',now);
    const row=await this.db.get<{count:number}>(`
      INSERT INTO rate_limits (key,count,expires) VALUES (?,1,?)
      ON CONFLICT(key) DO UPDATE SET
        count=CASE WHEN rate_limits.expires<=? THEN 1 ELSE rate_limits.count+1 END,
        expires=CASE WHEN rate_limits.expires<=? THEN excluded.expires ELSE rate_limits.expires END
      RETURNING count
    `,hash(key),now+periodMs,now,now);
    return !!row&&row.count<=max;
  }
}

const singleton=globalThis as typeof globalThis&{fragoutStore?:Store};
export function getStore():Store{
  if(!singleton.fragoutStore){
    const store=new Store(openConfiguredDatabase());
    singleton.fragoutStore=store;
    if(store.db.engine==='sqlite'){
      const prune=()=>{void store.pruneOutfits().catch(()=>{/* Retry on the next read or sweep. */});};
      prune();
      setInterval(prune,60000).unref();
    }
  }
  return singleton.fragoutStore;
}
