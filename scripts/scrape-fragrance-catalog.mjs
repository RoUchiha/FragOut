import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdir,mkdtemp,readFile,realpath,writeFile} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
import {catalogProfiles} from '../src/lib/catalog.ts';
import {discoverCommonsPhotos} from '../src/lib/catalog-commons.ts';
import {hasWebThumbnail} from '../src/lib/catalog-web-thumbnails.ts';
import {readLimitedBody,retryAfterDelay} from '../src/lib/catalog-http.ts';
import publicEditions from '../catalog/thumbnail-editions.json' with {type:'json'};

const sources=[
 ['scento.jsonl','https://raw.githubusercontent.com/Scento-com/perfume-dataset/main/perfumes.jsonl'],
 ['mysecretcart.csv','https://mysecretcart.com/data/fragrance-database.csv'],
 ['gouttes.json','https://cdn.shopify.com/s/files/1/0937/0340/5861/files/gouttes-rares-longevity-sillage-index-2026-09-24.json'],
];
const repository=fileURLToPath(new URL('../',import.meta.url));
const {values}=parseArgs({options:{
 out:{type:'string'},edition:{type:'string',multiple:true},limit:{type:'string',default:'10'},
 offset:{type:'string',default:'0'},'data-only':{type:'boolean'},'photos-only':{type:'boolean'},
}});
const limit=Number(values.limit),offset=Number(values.offset);
if(!values.out||values['data-only']&&values['photos-only']||!Number.isInteger(limit)||limit<1||limit>250||
 !Number.isInteger(offset)||offset<0||values['data-only']&&values.edition)
 throw new Error('Usage: npm run catalog:scrape -- --out PATH [--edition ID] [--limit 10] [--offset 0] [--data-only | --photos-only]');
const byId=new Map([...publicEditions,...catalogProfiles].map(edition=>[edition.id,edition]));
const selected=values.edition?[...new Set(values.edition)].map(id=>{
 const edition=byId.get(id);
 if(!edition) throw new Error('Unknown public edition: '+id);
 return edition;
}):null;
if(selected&&selected.length>250) throw new Error('Select at most 250 public editions.');

const output=resolve(values.out);
const privateFolders=['public','catalog','.git'].map(folder=>resolve(repository,folder));
function checkOutput(path) {
 for(const folder of privateFolders) {
  const child=relative(folder,path);
  if(!child||!isAbsolute(child)&&child!=='..'&&!child.startsWith('..'+sep))
   throw new Error('Stage scraper results outside the catalog, public assets, and Git folders.');
 }
}
checkOutput(output);
await mkdir(output,{recursive:true});
const parent=await realpath(output);
checkOutput(parent);
const run=await mkdtemp(join(parent,'fragdex-'));
const checkedAt=new Date().toISOString().slice(0,10);
const report={checkedAt,sources:[],draft:null,photos:[],photoScan:null,errors:[]};

async function fetchSource([name,url]) {
 const response=await fetch(url,{redirect:'error',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000)});
 if(!response.ok||response.redirected) {
  await response.body?.cancel();
  throw new Error(name+' returned '+response.status);
 }
 const bytes=await readLimitedBody(response,8*1024*1024);
 if(!bytes?.length) throw new Error(name+' returned empty or oversized data');
 await writeFile(join(run,name),bytes,{flag:'wx'});
 return {name,url,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}

if(!values['photos-only']) {
 const downloaded=await Promise.allSettled(sources.map(fetchSource));
 for(const result of downloaded) {
  if(result.status==='fulfilled') report.sources.push(result.value);
  else report.errors.push(result.reason instanceof Error?result.reason.message:'Dataset download failed.');
 }
 if(report.sources.length===sources.length) {
  const snapshot=join(run,'snapshot');
  const build=spawnSync('python',[join(repository,'scripts','build-fragrance-catalog.py'),
   ...sources.map(([name])=>join(run,name)),'--checked-at',checkedAt,'--output-dir',snapshot],
  {cwd:repository,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:256*1024});
  if(build.status!==0) {
   await writeFile(join(run,'compiler-error.txt'),build.stderr||build.error?.message||'Compiler exited before completion.',{flag:'wx'});
   report.errors.push('Draft compilation failed. See compiler-error.txt in the run folder.');
  } else {
   const draft=JSON.parse(await readFile(join(snapshot,'fragrances.json'),'utf8'));
   const draftIds=new Set(draft.map(edition=>edition.id));
   report.draft={...JSON.parse(build.stdout),added:draft.filter(edition=>!byId.has(edition.id)).map(edition=>edition.id),
    removed:catalogProfiles.filter(edition=>!draftIds.has(edition.id)).map(edition=>edition.id)};
  }
 }
}

if(!values['data-only']) {
 const queue=selected??catalogProfiles.filter(edition=>!edition.photo&&!hasWebThumbnail(edition)).slice(offset,offset+limit);
 let retryAfterSeconds=null;
 const searchRequest=async (url,options)=>{
  const response=await fetch(url,options);
  if(response.status===429||response.status===503||response.headers.has('retry-after'))
   retryAfterSeconds=Math.ceil(retryAfterDelay(response.headers.get('retry-after'))/1000);
  return response;
 };
 for(const edition of queue) {
  try {
   const candidates=await discoverCommonsPhotos(edition,searchRequest);
   report.photos.push({id:edition.id,brand:edition.brand,name:edition.name,concentration:edition.concentration,
    status:candidates.length?'needs-review':'no-candidates',candidates});
  } catch(error) {
   report.errors.push(edition.id+' · '+(error instanceof Error?error.message:'Image discovery failed.'));
   break;
  }
  if(queue.length>1&&edition!==queue.at(-1)) await delay(1050);
 }
 report.photoScan={requested:queue.length,completed:report.photos.length,
  nextOffset:selected?null:offset+report.photos.length,
  remainingEditions:queue.slice(report.photos.length).map(edition=>edition.id),retryAfterSeconds};
}

await writeFile(join(run,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('Staged results in '+run);
if(report.draft) console.log('Draft contains '+report.draft.editions+' editions.');
console.log('Searched '+report.photos.length+' editions and found review candidates for '+
 report.photos.filter(edition=>edition.candidates.length).length+'.');
if(report.photoScan?.remainingEditions.length) {
 const {nextOffset,retryAfterSeconds}=report.photoScan;
 if(retryAfterSeconds) console.log('Wikimedia asked for a pause of at least '+retryAfterSeconds+' seconds.');
 if(nextOffset!==null) console.log('Resume with --photos-only --offset '+nextOffset+'.');
}
for(const error of report.errors) console.error(error);
if(report.errors.length) process.exitCode=1;
