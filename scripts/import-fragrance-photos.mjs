import {lstat,open,readFile,rename,unlink,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {z} from 'zod';
import {catalogReferenceUrl} from '../src/lib/catalog-ratings.ts';

const slug=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(130);
const creditLine=z.string().trim().min(1).max(200);
const sourceUrl=z.string().max(500).refine(url=>!!catalogReferenceUrl(url),'Use a public HTTPS source page');
const stockPhotoLicenses=new Set(['https://unsplash.com/license','https://www.pexels.com/license/']);
const licenseUrl=sourceUrl.refine(url=>stockPhotoLicenses.has(url)||
 /^https:\/\/creativecommons\.org\/(?:licenses\/(?:by|by-sa)\/(?:2\.0|2\.5|3\.0|4\.0)\/|publicdomain\/zero\/1\.0\/)$/.test(url),
 'Use a reviewed license that allows resizing and reuse in FragDex');
const manifestSchema=z.array(z.object({
 id:slug,
 image:z.string().max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpe?g|png|webp)$/i),
 suffix:slug.optional(),
 cover:z.boolean().optional(),
 view:z.enum(['front','front-angle']),
 publisher:creditLine,
 url:sourceUrl,
 credit:creditLine,
 caption:creditLine,
 license:z.object({name:creditLine,url:licenseUrl}).strict(),
}).strict()).min(1).max(300);

const input=process.argv[2];
if(!input) throw new Error('Usage: node scripts/import-fragrance-photos.mjs PATH_TO_REVIEWED_PHOTOS.json');
const manifestPath=resolve(input);
const catalogDir=fileURLToPath(new URL('../catalog/',import.meta.url));
const bottlesDir=fileURLToPath(new URL('../public/catalog/bottles/',import.meta.url));
const manifest=manifestSchema.parse(JSON.parse(await readFile(manifestPath,'utf8')));
const catalog=JSON.parse(await readFile(join(catalogDir,'fragrances.json'),'utf8'));
const ids=new Set(catalog.map(entry=>entry.id));
const registryPath=join(catalogDir,'photos.json');
const lockPath=join(catalogDir,'photos.import.lock');
const tempPath=join(catalogDir,'photos.import.tmp');
const lock=await open(lockPath,'wx');

try {
 const registry=JSON.parse(await readFile(registryPath,'utf8'));
 const targets=new Set();
 const additions=[];
 for(const {id,image,suffix,cover,view,publisher,url,credit,license,caption} of manifest) {
  if(!ids.has(id)) throw new Error('Unknown fragrance edition '+id);
  const file=suffix?id+'-'+suffix:id;
  if(targets.has(file)) throw new Error('Duplicate photo '+file);
  targets.add(file);
  const inputPath=join(dirname(manifestPath),image);
  const info=await lstat(inputPath);
  if(!info.isFile()||!info.size||info.size>10_000_000) throw new Error('Invalid local image '+image);
  const photo=sharp(inputPath,{limitInputPixels:25_000_000});
  const metadata=await photo.metadata();
  if(!['jpeg','png','webp'].includes(metadata.format)||(metadata.pages??1)>1)
   throw new Error('Expected a still JPG, PNG, or WebP '+image);
  const jpeg=await photo.autoOrient().resize({width:1000,height:1000,fit:'inside',withoutEnlargement:true})
   .flatten({background:'#fff'}).jpeg({quality:85,mozjpeg:true}).toBuffer();
  const path=join(bottlesDir,file+'.jpg');
  const previous=await readFile(path).catch(error=>{if(error.code!=='ENOENT') throw error;return null;});
  if(previous&&!previous.equals(jpeg)) throw new Error('Choose a new suffix to preserve '+file);
  if(!previous) additions.push({path,jpeg});
  const photos=registry[id]??=[];
  const existing=photos.find(item=>item.file===file);
  if(existing&&existing.url!==url) throw new Error('Photo already credited to a different source '+file);
  const record={file,view,publisher,url,credit:credit+' · JPEG optimized',license,caption};
  registry[id]=photos.filter(item=>item.file!==file);
  if(cover) registry[id].unshift(record);
  else registry[id].splice(existing?photos.indexOf(existing):registry[id].length,0,record);
 }

 for(const {path,jpeg} of additions) await writeFile(path,jpeg,{flag:'wx'});
 const ordered=Object.fromEntries(Object.entries(registry).sort(([a],[b])=>a.localeCompare(b)));
 await writeFile(tempPath,JSON.stringify(ordered,null,2)+'\n',{flag:'wx'});
 try {
  await rename(tempPath,registryPath);
 } finally {
  await unlink(tempPath).catch(error=>{if(error.code!=='ENOENT') throw error;});
 }
 console.log('Reviewed '+manifest.length+' photos. Added '+additions.length+' JPEG files.');
} finally {
 await lock.close();
 await unlink(lockPath);
}
