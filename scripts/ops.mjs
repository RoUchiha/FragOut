import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir,unlink,lstat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {resolve,join,dirname,sep} from 'node:path';
import {parseArgs} from 'node:util';
import {put,get,list,del} from '@vercel/blob';
import {openConfiguredDatabase,openSqlite} from '../src/lib/database.ts';
import {captureSnapshot,sealBackup,openBackup,refreshStaging,verifySnapshotRestore,openVaultEscrow} from '../src/lib/backups.ts';
import {privateDataPath} from '../src/lib/private-path.ts';

const {values,positionals}=parseArgs({allowPositionals:true,options:{config:{type:'string'},'empty-inventory':{type:'string'},file:{type:'string'},'local-only':{type:'boolean'}}});
const command=positionals[0],configPath=resolve(values.config??process.env.FRAGOUT_OPS_CONFIG??'../../work/fragout-ops/private/operator.json');
const config=await readFile(configPath,'utf8').then(JSON.parse).catch(()=>({
 publicKeyPath:resolve('ops/backup-public.pem'),backupRoot:process.env.FRAGOUT_BACKUP_DIR,
 vaultKeyId:process.env.FRAGOUT_BACKUP_VAULT_KEY_ID,
}));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const pattern=/^\d{4}-\d{2}-\d{2}T[\d-]+Z-[a-f\d-]{36}\.fragbackup$/;
const prefix='fragout/production/database/';
const root=config.backupRoot?privateDataPath(config.backupRoot):null;
let lock,locked=false;
async function encryptedRead(path){
 const file=privateDataPath(resolve(path)),info=await lstat(file);
 if(!info.isFile()||info.isSymbolicLink()||info.size>180000000)throw new Error('Invalid encrypted backup file.');
 return readFile(file);
}
async function stored(bytes,pathname,ttlDays){
 const token=process.env.FRAGOUT_BACKUP_BLOB_TOKEN??process.env.BLOB_READ_WRITE_TOKEN;
 if(!token)throw new Error('Private off-site backup storage is not configured.');
 if(process.env.VERCEL_BLOB_API_URL||process.env.NEXT_PUBLIC_VERCEL_BLOB_API_URL)throw new Error('Custom storage endpoints are not permitted in the backup job.');
 const result=await put(pathname,bytes,{token,access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/octet-stream',cacheControlMaxAge:60,...(ttlDays?{ttlDays}:{})});
 const url=new URL(result.url);assert.equal(url.protocol,'https:');assert.ok(url.hostname.endsWith('.private.blob.vercel-storage.com'));
 const copy=await get(result.url,{token,access:'private',useCache:false});
 if(!copy||copy.statusCode!==200)throw new Error('Off-site backup could not be read back.');
 const downloaded=Buffer.from(await new Response(copy.stream).arrayBuffer());assert.equal(hash(downloaded),hash(bytes));
 const anonymous=await fetch(result.url,{credentials:'omit',redirect:'manual',signal:AbortSignal.timeout(10000)});
 await anonymous.body?.cancel();assert.ok([401,403,404].includes(anonymous.status),'The backup must not be anonymously readable.');
 return {url:result.url,sha256:hash(bytes),anonymousStatus:anonymous.status};
}
async function prune(){
 const cutoff=Date.now()-7*86400000;
 for(const name of await readdir(root)){
  if(!pattern.test(name))continue;const path=resolve(root,name);assert.equal(dirname(path),root);
  const info=await lstat(path);if(info.isFile()&&!info.isSymbolicLink()&&info.mtimeMs<cutoff)await unlink(path);
 }
 const token=process.env.FRAGOUT_BACKUP_BLOB_TOKEN??process.env.BLOB_READ_WRITE_TOKEN;if(!token)return;
 let cursor;
 for(let pages=0;pages<100;pages++){
  const page=await list({token,prefix,cursor,limit:1000});
  const retired=page.blobs.filter(blob=>blob.pathname.startsWith(prefix)&&pattern.test(blob.pathname.slice(prefix.length))&&new Date(blob.uploadedAt).getTime()<cutoff).map(blob=>blob.url);
  if(retired.length)await del(retired,{token});if(!page.hasMore)break;cursor=page.cursor;
 }
}
try{
 if(!root)throw new Error('Configure a private backup directory.');await mkdir(root,{recursive:true,mode:0o700});
 if((await lstat(root)).isSymbolicLink())throw new Error('Backup directory cannot be a link.');
 lock=join(root,'.operator.lock');const handle=await import('node:fs/promises').then(fs=>fs.open(lock,'wx',0o600));await handle.close();locked=true;
 if(config.blobEnvironmentPath)process.loadEnvFile(config.blobEnvironmentPath);
 if(command==='backup'){
  let snapshot;
  if(values['empty-inventory']){
   snapshot=JSON.parse(await readFile(privateDataPath(resolve(values['empty-inventory'])),'utf8'));
   if(snapshot.environment!=='production'||Object.values(snapshot.tables).some(rows=>!Array.isArray(rows)||rows.length))throw new Error('The management inventory shortcut is permitted only for a verified empty production database.');
   snapshot.vaultKeyId=config.vaultKeyId;
  }else{
   const reader=process.env.FRAGOUT_BACKUP_DATABASE_URL??(config.readerPath?await readFile(config.readerPath,'utf8').then(JSON.parse).then(row=>row.sourceUrl):null);
   if(!reader)throw new Error('The separately authorized read-only production credential is not configured.');
   const db=openConfiguredDatabase({FRAGOUT_DATABASE_URL:reader,FRAGOUT_ENVIRONMENT:'production'},{backupReadOnly:true});
   try{snapshot=await captureSnapshot(db,{environment:'production',vaultKeyId:config.vaultKeyId});}finally{await db.close();}
  }
  const counts=await verifySnapshotRestore(snapshot),publicKey=await readFile(config.publicKeyPath,'utf8'),bytes=sealBackup(snapshot,publicKey);
  const filename=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID()+'.fragbackup';assert.ok(pattern.test(filename));
  const path=resolve(root,filename);assert.equal(dirname(path),root);await writeFile(path,bytes,{flag:'wx',mode:0o600});
  assert.equal(hash(await readFile(path)),hash(bytes));
  const remote=values['local-only']?null:await stored(bytes,prefix+filename,7);
  const report={at:new Date().toISOString(),sourceEnvironment:'production',sourceId:snapshot.sourceId,counts,localFile:path,sha256:hash(bytes),offsite:remote,restoreVerified:true};
  await writeFile(join(root,'last-backup.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
  if(remote)await prune();console.log(JSON.stringify(report));
 }else if(command==='verify'){
  if(!values.file||!config.recoveryKeyPath)throw new Error('Choose an encrypted backup and its separate recovery key.');
  const snapshot=openBackup(await encryptedRead(values.file),await readFile(config.recoveryKeyPath,'utf8'));
  const counts=await verifySnapshotRestore(snapshot);console.log(JSON.stringify({verified:true,environment:snapshot.environment,counts}));
 }else if(command==='refresh'){
  if(!values.file||!config.testDatabasePath||!config.recoveryKeyPath)throw new Error('Choose a verified backup and configure the separate local test database.');
  const snapshot=openBackup(await encryptedRead(values.file),await readFile(config.recoveryKeyPath,'utf8'));
  const db=openSqlite(config.testDatabasePath,{environment:'staging'});
  try{const counts=await refreshStaging(db,snapshot);console.log(JSON.stringify({refreshed:true,targetEnvironment:'staging',sourceId:snapshot.sourceId,counts}));}finally{await db.close();}
 }else if(command==='escrow'){
  if(!config.recoveryKeyPath)throw new Error('Configure the separate recovery key.');
  const pathname='vault-'+config.vaultKeyId+'.fragvault',bytes=await encryptedRead(join(root,pathname)),privateKey=await readFile(config.recoveryKeyPath,'utf8');
  const vault=openVaultEscrow(bytes,privateKey);assert.equal(hash(vault),config.vaultKeyId);vault.fill(0);
  const remote=values['local-only']?null:await stored(bytes,'fragout/production/recovery/'+pathname);
  console.log(JSON.stringify({encryptedEscrowVerified:true,offsite:remote}));
 }else throw new Error('Choose backup, verify, refresh or escrow.');
}catch(error){
 const approved=new Set(['The separately authorized read-only production credential is not configured.','Private off-site backup storage is not configured.']);
 console.error(approved.has(error?.message)?error.message:'Operator action failed. No production data was modified; inspect configuration and retry.');process.exitCode=1;
}finally{if(locked)await unlink(lock);}
