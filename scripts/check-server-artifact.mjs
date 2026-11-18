// Reproduce serverless packaging: only files named by the API trace are available.
// A developer's complete node_modules or Turbopack symlinks must not mask omissions.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,copyFile,mkdir,rm,realpath,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,resolve,relative,join,sep,isAbsolute} from 'node:path';
import {spawnSync} from 'node:child_process';

const root=resolve('.'),entry='.next/server/app/api/[...path]/route.js';
const trace=JSON.parse(await readFile(entry+'.nft.json','utf8'));
const base=await realpath(tmpdir()),isolated=await mkdtemp(join(base,'fragout-artifact-'));
try{
 const paths=new Set([entry,'package.json','.next/package.json',...trace.files.map(file=>relative(root,resolve(dirname(entry),file)))]);
 for(const file of paths){
  assert.ok(!isAbsolute(file)&&file!=='..'&&!file.startsWith('..'+sep),'A server trace cannot depend on files outside the checkout.');
  // Trace directory hints are not files; do not smuggle an untraced package tree in.
  if((await stat(resolve(root,file))).isDirectory())continue;
  const dest=resolve(isolated,file);assert.ok(dest.startsWith(isolated+sep));
  await mkdir(dirname(dest),{recursive:true});await copyFile(resolve(root,file),dest);
 }
 for(const file of ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz','node_modules/tesseract.js/src/worker-script/node/index.js']){
  assert.ok(paths.has(file.replaceAll('/',sep))||paths.has(file),'OCR asset missing from API deployment trace: '+file);
 }
 const env=Object.fromEntries(['PATH','Path','SystemRoot','SYSTEMROOT','TEMP','TMP'].filter(key=>process.env[key]).map(key=>[key,process.env[key]]));
 const result=spawnSync(process.execPath,['-e','require(process.argv[1]);',resolve(isolated,entry)],{
  cwd:isolated,env:{...env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'},encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:1000000,
 });
 assert.equal(result.status,0,'Isolated API artifact did not load: '+String(result.stderr||result.error||'').slice(0,1500));
 console.log('Isolated server artifact passed: API module and packaged OCR dependencies load without checkout dependencies.');
}finally{
 const target=await realpath(isolated);assert.equal(dirname(target),base);assert.ok(target.startsWith(join(base,'fragout-artifact-')));
 await rm(target,{recursive:true,force:true});
}
