import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdir,mkdtemp,readFile,realpath,writeFile} from 'node:fs/promises';
import {isAbsolute,join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {catalogProfiles} from '../src/lib/catalog.ts';
import {readLimitedBody} from '../src/lib/catalog-http.ts';
import {findAutomaticCatalogPhoto} from '../src/lib/catalog-photo-selector.ts';
import {bottleImageSearchUrl,discoverProductPhotos} from './catalog-photo-discovery.ts';
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
let draftProfiles=null;

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
   draftProfiles=draft;
   const draftIds=new Set(draft.map(edition=>edition.id));
   report.draft={...JSON.parse(build.stdout),added:draft.filter(edition=>!byId.has(edition.id)).map(edition=>edition.id),
    removed:catalogProfiles.filter(edition=>!draftIds.has(edition.id)).map(edition=>edition.id)};
  }
 }
}

if(!values['data-only']) {
 const profiles=draftProfiles??catalogProfiles;
 const importable=new Set(profiles.map(edition=>edition.id));
 const queue=selected??profiles.filter(edition=>!edition.photo).slice(offset,offset+limit);
 const imports=[];
 for(const edition of queue) {
  const searchUrl=bottleImageSearchUrl(edition);
  const page=edition.sources?.find(source=>source.kind==='house'||source.id==='product')?.url;
  const identity={id:edition.id,brand:edition.brand,name:edition.name,concentration:edition.concentration,
   ...(edition.releaseYear?{releaseYear:edition.releaseYear}:{})};
  const automatic=edition.photo?null:await findAutomaticCatalogPhoto(identity).catch(()=>null);
  if(automatic) {
   const suffix=createHash('sha256').update(automatic.bytes).digest('hex').slice(0,12);
   const image=edition.id.replace(':','-')+'-'+suffix+'.jpg';
   await writeFile(join(run,image),automatic.bytes,{flag:'wx'});
   const selectedPhoto={image,suffix,publisher:automatic.publisher,url:automatic.sourceUrl,imageUrl:automatic.imageUrl};
   report.photos.push({...identity,searchUrl,status:'automatic',selectedPhoto});
   if(importable.has(edition.id)) imports.push({id:edition.id,...selectedPhoto,
    view:'front-angle',cover:true,caption:edition.name+' bottle',credit:'Product photo via '+automatic.publisher});
   continue;
  }
  let candidates=[];
  try {
   if(page) candidates=await discoverProductPhotos(page);
  } catch {
   // The Google Images query remains usable when a product page cannot be fetched.
  }
  report.photos.push({...identity,searchUrl,status:edition.photo?'bundled':'missing',candidates});
 }
 if(imports.length) await writeFile(join(run,'selected-photos.json'),JSON.stringify(imports,null,2)+'\n',{flag:'wx'});
 report.photoScan={requested:queue.length,completed:report.photos.length,
  nextOffset:selected?null:offset+report.photos.length};
}

await writeFile(join(run,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('Staged results in '+run);
if(report.draft) console.log('Draft contains '+report.draft.editions+' editions.');
console.log('Checked '+report.photos.length+' photo entries and selected '+
 report.photos.filter(edition=>edition.status==='automatic').length+' new images.');
for(const error of report.errors) console.error(error);
if(report.errors.length) process.exitCode=1;
