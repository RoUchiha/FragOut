import {chmodSync,lstatSync,mkdirSync,readdirSync} from 'node:fs';
import {basename,dirname,join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {privateDataPath} from './private-path.ts';
const protectedDirectories=new Set<string>();
export function protectPrivateDirectory(databasePath:string){
 const file=privateDataPath(databasePath),directory=dirname(file);
 if(protectedDirectories.has(directory))return;
 mkdirSync(directory,{recursive:true,mode:0o700});
 const allowed=new Set([basename(file),basename(file)+'-wal',basename(file)+'-shm',basename(file)+'-journal','credential-key']);
 if(lstatSync(directory).isSymbolicLink())throw new Error('Use a dedicated private data directory, without links.');
 for(const entry of readdirSync(directory,{withFileTypes:true}))if(!entry.isFile()||entry.isSymbolicLink()||!allowed.has(entry.name))throw new Error('Use a dedicated private data directory without unrelated files.');
 if(process.platform==='win32'){
  const systemRoot=process.env.SystemRoot??'C:\\Windows';
  const environment:NodeJS.ProcessEnv={NODE_ENV:process.env.NODE_ENV??'production'};for(const name of ['SystemRoot','WINDIR','PATH','TEMP','TMP','USERPROFILE','USERNAME'])if(process.env[name])environment[name]=process.env[name];
  const options={windowsHide:true,stdio:'pipe' as const,env:environment};
  const identity=execFileSync(join(systemRoot,'System32','whoami.exe'),['/user','/fo','csv','/nh'],{...options,encoding:'utf8'});
  const sid=identity.match(/S-\d-(?:\d+-)*\d+/)?.[0];if(!sid)throw new Error('Unable to identify the private data service account.');
  const icacls=join(systemRoot,'System32','icacls.exe');
  const protect=(target:string,folder:boolean)=>{
   execFileSync(icacls,[target,'/reset'],options);
   const rights=folder?'(OI)(CI)(F)':'(F)';
   execFileSync(icacls,[target,'/inheritance:r','/grant:r','*'+sid+':'+rights,'*S-1-5-18:'+rights,'*S-1-5-32-544:'+rights],options);
  };
  protect(directory,true);for(const entry of readdirSync(directory))protect(join(directory,entry),false);
 }else{
  chmodSync(directory,0o700);for(const entry of readdirSync(directory))chmodSync(join(directory,entry),0o600);
 }
 protectedDirectories.add(directory);
}
