import {createHash,createCipheriv,createDecipheriv,createPublicKey,createPrivateKey,publicEncrypt,privateDecrypt,randomBytes,randomUUID,constants} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {z} from 'zod';
import {openSqlite,type DataConnection} from './database.ts';
import {assertDatabaseEnvironment,type DeploymentEnvironment} from './environment.ts';
import {findCatalogProfile} from './catalog.ts';
import {findPublicCatalogEdition} from './catalog-editions.ts';
import {bottleSchema} from './validation.ts';
import {defaultPreferences,defaultContext,defaultShortcuts} from './seed.ts';

// Identifiers are code-owned. No table name, column name or SQL comes from a file.
export const backupColumns={
 users:['id','name','email','password','demo','created'],
 bottles:['id','user_id','body'],settings:['user_id','body'],archive_consents:['user_id','epoch'],
 wear_events:['id','user_id','body','created'],saved_looks:['id','user_id','analysis_id','body','created'],
 private_photos:['id','user_id','analysis_id','look_id','sealed','expires'],
 ai_credentials:['user_id','provider','model','sealed'],ai_preferences:['user_id','selected'],
 catalog_admins:['user_id'],catalog_photos:['edition_id','mode','image_hash','bytes','source_url','publisher','updated_at'],
} as const;
type Table=keyof typeof backupColumns;
type Cell=string|number|null|{$binary:string};
type Row=Record<string,Cell>;
export interface DatabaseSnapshot{
 version:1;environment:DeploymentEnvironment;sourceId:string;createdAt:string;schemaVersion:number;vaultKeyId:string;
 tables:Record<Table,Row[]>;
}
const limit=100*1024*1024;
const names=Object.keys(backupColumns) as Table[];
const temporaryTables=['sessions','rate_limits','recommendation_runs','outfit_analyses','catalog_photo_attempts'];
const knownTables=new Set([...names,...temporaryTables,'schema_migrations','deployment_identity']);
const binary=z.object({$binary:z.string().max(14000000).regex(/^[A-Za-z0-9+/]*={0,2}$/)}).strict();
const cell=z.union([z.string().max(2000000),z.number().safe(),z.null(),binary]);
const snapshotSchema=z.object({version:z.literal(1),environment:z.enum(['development','staging','production']),sourceId:z.uuid(),createdAt:z.iso.datetime(),schemaVersion:z.union([z.literal(1),z.literal(2)]),vaultKeyId:z.string().regex(/^[a-f\d]{64}$/),tables:z.record(z.enum(names),z.array(z.record(z.string(),cell)).max(200000))}).strict();
function checkedSnapshot(input:unknown):DatabaseSnapshot{
 const snapshot=snapshotSchema.parse(input);
 for(const table of names)for(const row of snapshot.tables[table]){
  if(Object.keys(row).length!==backupColumns[table].length||backupColumns[table].some(column=>!(column in row))||Object.keys(row).some(column=>!(backupColumns[table] as readonly string[]).includes(column)))throw new Error('Invalid backup columns.');
 }
 return snapshot;
}
const encode=(row:Record<string,unknown>):Row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,value instanceof Uint8Array?{$binary:Buffer.from(value).toString('base64')}:value as Cell]));
const decode=(value:Cell)=>value&&typeof value==='object'?Buffer.from(value.$binary,'base64'):value;

export async function captureSnapshot(db:DataConnection,options:{environment:DeploymentEnvironment;vaultKeyId:string}):Promise<DatabaseSnapshot>{
 return db.transaction(async tx=>{
  if(tx.engine==='postgres')await tx.run('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  const identity=await assertDatabaseEnvironment(tx,options.environment);
  const version=await tx.get<{version:number}>('SELECT MAX(version) AS version FROM schema_migrations');
  const schema=await tx.all<{name:string}>(tx.engine==='postgres'?"SELECT tablename AS name FROM pg_catalog.pg_tables WHERE schemaname=current_schema()":"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  if(![1,2].includes(version?.version??0)||schema.some(row=>!knownTables.has(row.name)))throw new Error('Backup schema coverage must be updated before taking a snapshot.');
  const tables={} as Record<Table,Row[]>;
  let estimatedBytes=1024;
  for(const table of names){
   const filter=table==='private_photos'?' WHERE look_id IS NOT NULL AND expires IS NULL':'';
   const order=table==='bottles'||table==='wear_events'?(tx.engine==='postgres'?'sort_order':'rowid'):table==='catalog_photos'?'edition_id,mode':table==='ai_credentials'?'user_id,provider':backupColumns[table][0];
   const rows:Row[]=[],pageSize=table==='private_photos'||table==='catalog_photos'?32:500;
   for(let offset=0;;offset+=pageSize){
    const page=await tx.all<Record<string,unknown>>('SELECT '+backupColumns[table].join(',')+' FROM '+table+filter+' ORDER BY '+order+' LIMIT '+pageSize+' OFFSET '+offset);
    for(const row of page){const encoded=encode(row);estimatedBytes+=Buffer.byteLength(JSON.stringify(encoded))+1;if(estimatedBytes>limit)throw new Error('Snapshot exceeds the configured byte limit.');rows.push(encoded);}
    if(rows.length>200000)throw new Error('Snapshot exceeds the configured row limit.');if(page.length<pageSize)break;
   }
   tables[table]=rows;
  }
  return checkedSnapshot({version:1,environment:identity.environment,sourceId:identity.instanceId,createdAt:new Date().toISOString(),schemaVersion:version?.version??1,vaultKeyId:options.vaultKeyId,tables});
 });
}

const b64=z.string().max(180000000).regex(/^[A-Za-z0-9+/]+={0,2}$/);
const envelopeSchema=z.object({version:z.literal(1),kind:z.enum(['snapshot','escrow']),sourceId:z.string().min(1).max(64),createdAt:z.iso.datetime(),keyId:z.string().regex(/^[a-f\d]{64}$/),wrappedKey:b64,nonce:b64,tag:b64,ciphertext:b64}).strict();
type Envelope=z.infer<typeof envelopeSchema>;
const header=(value:Pick<Envelope,'kind'|'sourceId'|'createdAt'|'keyId'>)=>Buffer.from(JSON.stringify({version:1,kind:value.kind,sourceId:value.sourceId,createdAt:value.createdAt,keyId:value.keyId}));
function publicKey(pem:string){
 const key=createPublicKey(pem);
 if(key.asymmetricKeyType!=='rsa'||(key.asymmetricKeyDetails?.modulusLength??0)<3072)throw new Error('Use an RSA recovery key of at least 3072 bits.');
 return key;
}
function encrypt(payload:Buffer,kind:Envelope['kind'],sourceId:string,pem:string){
 if(payload.length>limit)throw new Error('Backup exceeds the configured byte limit.');
 const key=publicKey(pem),keyId=createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex'),secret=randomBytes(32),nonce=randomBytes(12);
 const metadata={version:1 as const,kind,sourceId,createdAt:new Date().toISOString(),keyId};
 let compressed:Buffer|undefined;
 try{
  compressed=gzipSync(payload);const cipher=createCipheriv('aes-256-gcm',secret,nonce);cipher.setAAD(header(metadata));
  const ciphertext=Buffer.concat([cipher.update(compressed),cipher.final()]);
  const wrappedKey=publicEncrypt({key,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},secret);
  return Buffer.from(JSON.stringify({...metadata,wrappedKey:wrappedKey.toString('base64'),nonce:nonce.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')}));
 }finally{secret.fill(0);compressed?.fill(0);}
}
function decrypt(bytes:Buffer,kind:Envelope['kind'],pem:string){
 let secret:Buffer|undefined,compressed:Buffer|undefined;
 try{
  if(bytes.length>180000000)throw new Error();const envelope=envelopeSchema.parse(JSON.parse(bytes.toString()));
  if(envelope.kind!==kind)throw new Error();
  const key=createPrivateKey(pem),pub=publicKey(createPublicKey(key).export({type:'spki',format:'pem'}).toString());
  if(createHash('sha256').update(pub.export({type:'spki',format:'der'})).digest('hex')!==envelope.keyId)throw new Error();
  const nonce=Buffer.from(envelope.nonce,'base64'),tag=Buffer.from(envelope.tag,'base64');if(nonce.length!==12||tag.length!==16)throw new Error();
  secret=privateDecrypt({key,oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},Buffer.from(envelope.wrappedKey,'base64'));
  if(secret.length!==32)throw new Error();const cipher=createDecipheriv('aes-256-gcm',secret,nonce);cipher.setAAD(header(envelope));cipher.setAuthTag(tag);
  compressed=Buffer.concat([cipher.update(Buffer.from(envelope.ciphertext,'base64')),cipher.final()]);
  return gunzipSync(compressed,{maxOutputLength:limit});
 }catch{throw new Error('Backup integrity check failed.');}
 finally{secret?.fill(0);compressed?.fill(0);}
}
export function sealBackup(snapshot:DatabaseSnapshot,pem:string){
 const valid=checkedSnapshot(snapshot),plain=Buffer.from(JSON.stringify(valid));
 try{return encrypt(plain,'snapshot',valid.sourceId,pem);}finally{plain.fill(0);}
}
export function openBackup(bytes:Buffer,pem:string){
 const plain=decrypt(bytes,'snapshot',pem);try{return checkedSnapshot(JSON.parse(plain.toString()));}finally{plain.fill(0);}
}
export function createVaultEscrow(key:Buffer,pem:string){
 if(key.length!==32)throw new Error('Invalid vault key.');return encrypt(key,'escrow',createHash('sha256').update(key).digest('hex'),pem);
}
export function openVaultEscrow(bytes:Buffer,pem:string){
 const key=decrypt(bytes,'escrow',pem),envelope=envelopeSchema.parse(JSON.parse(bytes.toString()));
 if(key.length!==32||createHash('sha256').update(key).digest('hex')!==envelope.sourceId){key.fill(0);throw new Error('Vault recovery integrity check failed.');}return key;
}

function sanitized(snapshot:DatabaseSnapshot){
 const tables=Object.fromEntries(names.map(name=>[name,[]])) as unknown as Record<Table,Row[]>;
 const users=new Map<string,string>(),bottles=new Map<string,{id:string;name:string}>();
 for(const row of snapshot.tables.users){
  if(row.demo!==0)continue;const id=randomUUID();users.set(String(row.id),id);
  tables.users.push({id,name:'Test member '+users.size,email:'test.'+id+'@example.test',password:null,demo:0,created:Date.now()});
  tables.settings.push({user_id:id,body:JSON.stringify({preferences:defaultPreferences,context:defaultContext,shortcuts:defaultShortcuts})});
  tables.archive_consents.push({user_id:id,epoch:0});
 }
 for(const row of snapshot.tables.bottles){
  const userId=users.get(String(row.user_id));if(!userId)continue;
  const original=JSON.parse(String(row.body));
  const profile=findCatalogProfile(original),edition=findPublicCatalogEdition(original,profile);if(!edition)continue;
  const safe=bottleSchema.parse({brand:edition.brand,name:edition.name,concentration:edition.concentration,ownership:original.ownership,family:'',notes:[],strength:1,climate:'UNKNOWN',profileKnown:false,provenance:'unknown',color:original.color,shape:original.shape,sizeMl:original.sizeMl,fillPct:original.fillPct,rating:original.rating,favorite:original.favorite,memo:'',shelves:[]});
  const id=randomUUID(),variantId=createHash('sha256').update([safe.brand,safe.name,safe.concentration].map(s=>s.trim().toLowerCase().replace(/\s+/g,' ')).join('|')).digest('hex');
  bottles.set(String(row.id),{id,name:safe.name});tables.bottles.push({id,user_id:userId,body:JSON.stringify({...safe,id,variantId})});
 }
 for(const row of snapshot.tables.wear_events){
  const userId=users.get(String(row.user_id));if(!userId)continue;const original=JSON.parse(String(row.body));
  if(!Array.isArray(original.bottleIds)||!original.bottleIds.length||original.bottleIds.some((id:string)=>!bottles.has(id)))continue;
  if(!['wore','loved','disliked','saved'].includes(original.reaction)||!Number.isFinite(Date.parse(original.at)))continue;
  const id=randomUUID(),selected=original.bottleIds.map((id:string)=>bottles.get(id)!);
  tables.wear_events.push({id,user_id:userId,created:Number(row.created),body:JSON.stringify({id,bottleIds:selected.map((b:{id:string})=>b.id),names:selected.map((b:{name:string})=>b.name),reaction:original.reaction,occasion:'GENERAL',at:new Date(original.at).toISOString(),context:defaultContext})});
 }
 return {...snapshot,vaultKeyId:'0'.repeat(64),tables};
}
async function applyToStaging(db:DataConnection,snapshot:DatabaseSnapshot){
 return db.transaction(async tx=>{
  const target=await assertDatabaseEnvironment(tx,'staging');if(target.instanceId===snapshot.sourceId)throw new Error('A refresh cannot target its source.');
  for(const table of temporaryTables)await tx.run('DELETE FROM '+table);
  for(const table of [...names].reverse())await tx.run('DELETE FROM '+table);
  for(const table of names)for(const row of snapshot.tables[table])await tx.run('INSERT INTO '+table+' ('+backupColumns[table].join(',')+') VALUES ('+backupColumns[table].map(()=>'?').join(',')+')',...backupColumns[table].map(column=>decode(row[column])));
  if((await tx.all('PRAGMA foreign_key_check')).length)throw new Error('Restored database failed integrity checks.');
  return Object.fromEntries(names.map(table=>[table,snapshot.tables[table].length])) as Record<Table,number>;
 });
}
export async function refreshStaging(db:DataConnection,input:DatabaseSnapshot){
 const snapshot=checkedSnapshot(input);
 if(snapshot.environment!=='production'||db.engine!=='sqlite')throw new Error('Refresh flows only from production into local staging.');
 await assertDatabaseEnvironment(db,'staging');
 return applyToStaging(db,sanitized(snapshot));
}
export async function verifySnapshotRestore(input:DatabaseSnapshot){
 const snapshot=checkedSnapshot(input),db=openSqlite(':memory:',{environment:'staging'});
 try{
  const counts=await applyToStaging(db,snapshot);
  const restored=await captureSnapshot(db,{environment:'staging',vaultKeyId:snapshot.vaultKeyId});
  if(JSON.stringify(restored.tables)!==JSON.stringify(snapshot.tables))throw new Error('Restored values did not match the backup.');
  return counts;
 }finally{await db.close();}
}
