import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import {resolve,join,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {createManufacturerPhotoFinder} from '../src/lib/manufacturer-photo.ts';
import {readLimitedBody} from '../src/lib/catalog-http.ts';

const root=fileURLToPath(new URL('../',import.meta.url)),catalog=join(root,'catalog'),bottles=join(root,'public/catalog/bottles');
const {values}=parseArgs({options:{cache:{type:'string'},ids:{type:'string'},refresh:{type:'boolean'}}});
const cache=resolve(values.cache??join(root,'../../work/fragout-manufacturer-images/cache'));
if([join(root,'public'),join(root,'mobile'),join(root,'.next'),join(root,'.git'),catalog].some(path=>cache===path||cache.startsWith(path+sep)))throw new Error('Keep the source cache outside packaged app directories.');
await mkdir(cache,{recursive:true});
const registryPath=join(catalog,'photos.json'),profilesPath=join(catalog,'fragrances.json'),indexPath=join(catalog,'manufacturer-images.json');
const profiles=JSON.parse(await readFile(profilesPath,'utf8')),registry=JSON.parse(await readFile(registryPath,'utf8')),index=JSON.parse(await readFile(indexPath,'utf8'));
const ids=values.ids?new Set(values.ids.split(',')):null;
if(ids&&[...ids].some(id=>!profiles.some(profile=>profile.id===id)))throw new Error('Unknown catalog ID.');
// Parfumo stays first. Runtime admin overrides live separately in the database.
const selected=profiles.filter(profile=>(!ids||ids.has(profile.id))&&registry[profile.id]?.[0]?.publisher!=='Parfumo'&&(values.refresh||!registry[profile.id]?.[0]?.publisher.endsWith(' (official)')));
let nextRequest=0,admission=Promise.resolve();
const request=async(input,init)=>{
 const url=String(input),key=createHash('sha256').update(url).digest('hex'),path=join(cache,key+'.json');
 const saved=await readFile(path,'utf8').then(JSON.parse).catch(()=>null);
 if(saved&&Date.now()-saved.at<86400000)return new Response(Buffer.from(saved.body,'base64'),{status:saved.status,headers:saved.headers});
 const turn=admission.then(async()=>{const delay=Math.max(0,nextRequest-Date.now());if(delay)await new Promise(done=>setTimeout(done,delay));nextRequest=Date.now()+400;});
 admission=turn.catch(()=>{});await turn;
 const response=await fetch(url,init),headers=Object.fromEntries(['content-type','location'].flatMap(name=>response.headers.has(name)?[[name,response.headers.get(name)]]:[]));
 const bytes=response.ok?await readLimitedBody(response,headers['content-type']?.startsWith('image/')?6_000_000:2_000_000):Buffer.alloc(0);
 if(!response.ok)await response.body?.cancel();
 if(!bytes)return new Response(null,{status:413});
 await writeFile(path,JSON.stringify({at:Date.now(),status:response.status,headers,body:bytes.toString('base64')}));
 return new Response(bytes.length?bytes:null,{status:response.status,headers});
};
const find=createManufacturerPhotoFinder(request,{timeoutMs:25000}),results=new Map(),misses=[];
let cursor=0,completed=0;
async function worker(){
 while(cursor<selected.length){
  const edition=selected[cursor++],start=performance.now(),photo=await find(edition);
  if(photo)results.set(edition.id,photo);else misses.push(edition.id);
  console.log(JSON.stringify({completed:++completed,total:selected.length,id:edition.id,matched:!!photo,ms:Math.round(performance.now()-start)}));
 }
}
await Promise.all([worker(),worker()]);
const fingerprints=new Map();
for(const [id,rows] of Object.entries(registry))for(const row of rows){
 const hash=createHash('sha256').update(await readFile(join(bottles,row.file+'.jpg'))).digest('hex');
 fingerprints.set(hash,id);
}
const oldFiles=new Set();
for(const profile of profiles){
 const photo=results.get(profile.id);if(!photo)continue;
 const hash=createHash('sha256').update(photo.bytes).digest('hex');
 if(fingerprints.has(hash)&&fingerprints.get(hash)!==profile.id){results.delete(profile.id);misses.push(profile.id);continue;}
 fingerprints.set(hash,profile.id);
 const file=profile.id+'-'+hash.slice(0,12);
 if(!/^[a-z0-9-]+$/.test(file))throw new Error('Invalid public asset name.');
 const target=join(bottles,file+'.jpg'),existing=await readFile(target).catch(()=>null);
 if(existing&&!existing.equals(photo.bytes))throw new Error('Public image hash collision.');
 if(!existing)await writeFile(target,photo.bytes,{flag:'wx'});
 for(const old of registry[profile.id]??[])oldFiles.add(old.file+'.jpg');
 const caption=profile.brand+' '+profile.name+' '+profile.concentration+' bottle',credit='Official manufacturer product image · JPEG optimized';
 registry[profile.id]=[{file,view:'front',publisher:photo.publisher,url:photo.sourceUrl,imageUrl:photo.imageUrl,credit,caption}];
 index[profile.id]={sourceUrl:photo.sourceUrl,imageUrl:photo.imageUrl,imageHash:hash,checkedAt:new Date().toISOString().slice(0,10)};
 profile.sources=profile.sources.filter(source=>source.kind!=='photo');
 profile.sources.push({id:'photo',publisher:photo.publisher,url:photo.sourceUrl,kind:'photo',credit});
 profile.photo={path:'/catalog/bottles/'+file+'.jpg',caption,sourceId:'photo'};delete profile.additionalPhotos;
}
function profileLine(value){
 let result='',quoted=false,escaped=false;
 for(const char of JSON.stringify(value)){
  result+=char;
  if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;}
  else if(char==='"')quoted=true;else if(char===','||char===':')result+=' ';
 }
 return result;
}
async function atomic(path,value){
 const temp=path+'.manufacturer-tmp',content=path===profilesPath?'[\n'+value.map(row=>'  '+profileLine(row)).join(',\n')+'\n]\n':JSON.stringify(value,null,2)+'\n';
 await writeFile(temp,content);await rename(temp,path);
}
for(const id of Object.keys(index))if(!registry[id]?.[0]?.publisher.endsWith(' (official)'))delete index[id];
await atomic(registryPath,Object.fromEntries(Object.entries(registry).sort(([a],[b])=>a.localeCompare(b))));
await atomic(profilesPath,profiles);
await atomic(indexPath,Object.fromEntries(Object.entries(index).sort(([a],[b])=>a.localeCompare(b))));
const used=new Set(Object.values(registry).flat().map(row=>row.file+'.jpg'));
for(const name of oldFiles){
 const target=resolve(bottles,name);
 if(dirname(target)!==resolve(bottles)||!/^[a-z0-9-]+\.jpg$/.test(name))throw new Error('Old image path left the public bottle directory.');
 if(!used.has(name))await unlink(target);
}
const report={at:new Date().toISOString(),attempted:selected.length,updated:results.size,retained:misses.length,misses};
await writeFile(join(cache,'last-import.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
