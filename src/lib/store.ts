import {DatabaseSync} from 'node:sqlite';
import {randomUUID,randomBytes,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {defaultContext,defaultPreferences,defaultShortcuts,demoBottles} from './seed.ts';
import type {AppState,Bottle,Preferences,Shortcut,User,WearContext,WearEvent} from './types.ts';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
type UserRow={id:string;name:string;email:string|null;demo:number;password:string|null};
const publicUser=(u:UserRow):User=>({id:u.id,name:u.name,email:u.email,demo:!!u.demo});
const identity=(b:Pick<Bottle,'brand'|'name'|'concentration'>)=>hash([b.brand,b.name,b.concentration].map(s=>s.trim().toLowerCase().replace(/\s+/g,' ')).join('|'));
export class Store {
  db:DatabaseSync;
  constructor(path:string){
    if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
    this.db=new DatabaseSync(path);this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE,password TEXT,demo INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS bottles(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS bottles_owner ON bottles(user_id);
    CREATE TABLE IF NOT EXISTS settings(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS wear_events(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS events_owner ON wear_events(user_id,created);
    CREATE TABLE IF NOT EXISTS recommendation_runs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,body TEXT NOT NULL,created INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);
    INSERT OR IGNORE INTO schema_migrations VALUES(1,datetime('now'));`);
    this.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
    this.db.prepare('DELETE FROM users WHERE demo=1 AND created<?').run(Date.now()-7*86400000);
    this.db.prepare('DELETE FROM recommendation_runs WHERE created<?').run(Date.now()-86400000);
  }
  close(){this.db.close();}
  register(name:string,email:string,password:string){
    if(password.length<12)throw new Error('Use a password with at least 12 characters.');
    const salt=randomBytes(16).toString('hex'),digest=scryptSync(password,salt,64).toString('hex');
    const id=randomUUID();
    try{this.db.prepare('INSERT INTO users VALUES(?,?,?,?,0,?)').run(id,name,email.trim().toLowerCase(),`${salt}:${digest}`,Date.now());}
    catch{throw new Error('Unable to create this account. Try signing in or use another email.');}
    this.initSettings(id);return this.user(id)!;
  }
  private initSettings(id:string){this.db.prepare('INSERT INTO settings VALUES(?,?)').run(id,JSON.stringify({preferences:defaultPreferences,context:defaultContext,shortcuts:defaultShortcuts}));}
  createDemo(){
    const id=randomUUID();this.db.prepare('INSERT INTO users VALUES(?,?,NULL,NULL,1,?)').run(id,'Scent explorer',Date.now());
    this.initSettings(id);for(const b of demoBottles)this.addBottle(id,b);return this.user(id)!;
  }
  user(id:string){const row=this.db.prepare('SELECT * FROM users WHERE id=?').get(id) as UserRow|undefined;return row?publicUser(row):null;}
  login(email:string,password:string){
    const row=this.db.prepare('SELECT * FROM users WHERE email=?').get(email.trim().toLowerCase()) as UserRow|undefined;
    const parts=row?.password?.split(':');const salt=parts?.[0]??'00000000000000000000000000000000';
    const expected=parts?.[1]?Buffer.from(parts[1],'hex'):Buffer.alloc(64);const actual=scryptSync(password,salt,64);
    return row&&parts&&timingSafeEqual(actual,expected)?publicUser(row):null;
  }
  createSession(userId:string){const token=randomBytes(32).toString('hex');this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),userId,Date.now()+7*86400000);return token;}
  sessionUser(token:string){if(!token||token.length!==64)return null;const row=this.db.prepare('SELECT user_id FROM sessions WHERE token_hash=? AND expires>?').get(hash(token),Date.now()) as {user_id:string}|undefined;return row?this.user(row.user_id):null;}
  revokeSession(token:string){this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));}
  state(userId:string,allHistory=false):AppState{
    const user=this.user(userId);if(!user)throw new Error('Account not found.');
    const setting=this.db.prepare('SELECT body FROM settings WHERE user_id=?').get(userId) as {body:string};
    const bottles=(this.db.prepare('SELECT body FROM bottles WHERE user_id=? ORDER BY rowid').all(userId) as {body:string}[]).map(r=>JSON.parse(r.body) as Bottle);
    const history=(this.db.prepare('SELECT body FROM wear_events WHERE user_id=? ORDER BY created DESC'+(allHistory?'':' LIMIT 200')).all(userId) as {body:string}[]).map(r=>JSON.parse(r.body) as WearEvent);
    return {user,bottles,history,...JSON.parse(setting.body)};
  }
  exportState(userId:string){return this.state(userId,true);}
  addBottle(userId:string,input:Bottle):Bottle{
    const b={...input,id:randomUUID(),variantId:input.provenance==='demo'&&input.variantId?input.variantId:identity(input)};
    this.db.prepare('INSERT INTO bottles VALUES(?,?,?)').run(b.id,userId,JSON.stringify(b));return b;
  }
  updateBottle(userId:string,id:string,patch:Partial<Bottle>):Bottle|null{
    const row=this.db.prepare('SELECT body FROM bottles WHERE id=? AND user_id=?').get(id,userId) as {body:string}|undefined;if(!row)return null;
    const before=JSON.parse(row.body) as Bottle;const b={...before,...patch,id};
    if(identity(b)!==identity(before)){
      b.variantId=identity(b);b.profileKnown=false;b.notes=[];b.family='';b.climate='UNKNOWN';b.strength=1;b.provenance='unknown';
    }
    this.db.prepare('UPDATE bottles SET body=? WHERE id=? AND user_id=?').run(JSON.stringify(b),id,userId);return b;
  }
  removeBottle(userId:string,id:string){return this.db.prepare('DELETE FROM bottles WHERE id=? AND user_id=?').run(id,userId).changes>0;}
  saveSettings(userId:string,patch:{preferences?:Preferences;context?:WearContext;shortcuts?:Shortcut[]}){
    const s=this.state(userId);this.db.prepare('UPDATE settings SET body=? WHERE user_id=?').run(JSON.stringify({preferences:patch.preferences??s.preferences,context:patch.context??s.context,shortcuts:patch.shortcuts??s.shortcuts}),userId);
  }
  recordRecommendation(userId:string,context:WearContext,bottleIds:string[]){
    const id=randomUUID();this.db.prepare('INSERT INTO recommendation_runs VALUES(?,?,?,?)').run(id,userId,JSON.stringify({context,bottleIds}),Date.now());return id;
  }
  feedback(userId:string,ids:string[],reaction:WearEvent['reaction'],occasion:string,requestId?:string){
    const state=this.state(userId);const bs=ids.map(id=>state.bottles.find(b=>b.id===id&&b.ownership==='OWNED'));
    if(ids.length<1||ids.length>2||new Set(ids).size!==ids.length||bs.some(b=>!b))throw new Error('Choose one or two bottles you own.');
    let context={...state.context,occasion};
    if(requestId){
      const row=this.db.prepare('SELECT body FROM recommendation_runs WHERE id=? AND user_id=? AND created>?').get(requestId,userId,Date.now()-86400000) as {body:string}|undefined;
      if(!row)throw new Error('This recommendation has expired. Please generate a new pick.');
      const run=JSON.parse(row.body) as {context:WearContext;bottleIds:string[]};
      if(ids.some(id=>!run.bottleIds.includes(id)))throw new Error('Bottle does not belong to this recommendation.');
      context=run.context;
    }
    const event:WearEvent={id:randomUUID(),bottleIds:ids,names:bs.map(b=>b!.name),occasion:context.occasion,reaction,at:new Date().toISOString(),context};
    this.db.prepare('INSERT INTO wear_events VALUES(?,?,?,?)').run(event.id,userId,JSON.stringify(event),Date.now());
    if(ids.length===1&&(reaction==='loved'||reaction==='disliked'))for(const b of bs)this.updateBottle(userId,b!.id,{rating:reaction==='loved'?5:1,favorite:reaction==='loved'});
    return event;
  }
  deleteEvent(userId:string,id:string){return this.db.prepare('DELETE FROM wear_events WHERE id=? AND user_id=?').run(id,userId).changes>0;}
  deleteUser(userId:string){this.db.prepare('DELETE FROM users WHERE id=?').run(userId);}
  limit(key:string,max:number,periodMs:number){
    const now=Date.now();this.db.prepare('DELETE FROM rate_limits WHERE expires<?').run(now);
    this.db.prepare('INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(hash(key),now+periodMs);
    const row=this.db.prepare('SELECT count FROM rate_limits WHERE key=?').get(hash(key)) as {count:number};return row.count<=max;
  }
}
const singleton=globalThis as typeof globalThis&{fragoutStore?:Store};
export function getStore(){return singleton.fragoutStore??=(new Store(process.env.FRAGOUT_DB??join(process.cwd(),'data','fragout.sqlite')));}
