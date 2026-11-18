import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {catalogIdentityKey,catalogProfiles} from '../src/lib/catalog.ts';
import {searchCatalogEditions} from '../src/lib/catalog-editions.ts';

const origin='https://willitlayer.com';
const args=process.argv.slice(2);
const flag=name=>args[args.indexOf(name)+1];
const checkedAt=args.includes('--checked-at')?flag('--checked-at'):new Date().toISOString().slice(0,10);
if(!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt))throw new Error('Use an ISO date with --checked-at.');
const output=resolve(args.includes('--out')?flag('--out'):'catalog/layering.json');
const normalize=value=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
  .replace(/&/g,' and ').replace(/[’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const editions=searchCatalogEditions('',100000);
const houses=new Map(editions.map(edition=>[normalize(edition.brand),edition.brand]));
const formats=[...new Set(editions.map(edition=>edition.concentration))];
const compact=value=>value.replaceAll(' ','');
const identityIndex=new Map();
const nameIndex=new Map();
for(const edition of editions) {
 const profile=catalogProfiles.find(profile=>profile.id===edition.id);
 for(const name of [edition.name,...(profile?.aliases??[])]) {
  const raw=catalogIdentityKey({...edition,name});
  if(!raw)continue;
  const [house,release,format]=JSON.parse(raw);
  const key=JSON.stringify([compact(house),compact(release),format]);
  identityIndex.set(key,[...new Set([...(identityIndex.get(key)??[]),edition.id])]);
  const nameKey=compact(release);
  nameIndex.set(nameKey,[...new Set([...(nameIndex.get(nameKey)??[]),edition.id])]);
 }
}
const decode=value=>value.replace(/&(?:amp|quot|apos|lt|gt|#39|#x27|#\d+|#x[\da-f]+);/gi,entity=>{
  const named={'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&#39;':"'",'&#x27;':"'"};
  if(named[entity.toLowerCase()])return named[entity.toLowerCase()];
  return String.fromCodePoint(parseInt(entity.slice(entity[2].toLowerCase()==='x'?3:2,-1),entity[2].toLowerCase()==='x'?16:10));
});
async function read(url) {
  for(let attempt=0;attempt<3;attempt++) {
    const response=await fetch(url,{signal:AbortSignal.timeout(20000),redirect:'error',
      headers:{'User-Agent':'FragOut-Catalog/1.0 (public layering reference import)'}});
    if((response.status===429||response.status>=500)&&attempt<2) {
      await new Promise(resolve=>setTimeout(resolve,2000*(attempt+1)));
      continue;
    }
    if(!response.ok)throw new Error('Public reference returned HTTP '+response.status);
    const body=await response.text();
    if(body.length>512000)throw new Error('Public reference is too large.');
    return body;
  }
}
function fragrance(label,slug) {
  const marker=slug.indexOf('-by-');
  const slugHouse=marker>=0?slug.slice(marker+4).replaceAll('-',' '):'';
  const slugName=(marker>=0?slug.slice(0,marker):slug).replaceAll('-',' ');
  const brand=houses.get(normalize(slugHouse))||slugHouse;
  const catalogIds=brand?formats.flatMap(concentration=>{
    const raw=catalogIdentityKey({brand,name:slugName,concentration});
    if(!raw)return [];
    const [house,name,format]=JSON.parse(raw);
    return identityIndex.get(JSON.stringify([compact(house),compact(name),format]))??[];
  }):nameIndex.get(compact(normalize(slugName)))??[];
  const matched=editions.find(edition=>catalogIds.includes(edition.id));
  const title=decode(label??'').replace(/\s*[—|]\s*layering.*$/i,'').trim();
  const complete=compact(normalize(title))===compact(normalize(slug.replaceAll('-',' ')));
  const readable=value=>value.replace(/\b\p{L}/gu,letter=>letter.toUpperCase());
  const name=matched?.name??readable(slugName);
  const house=matched?.brand??(brand?readable(brand):'');
  const concentrationSpecified=/\b(?:eau de parfum|eau de toilette|extrait|edp|edt|edc|parfum|cologne|mist|oil)\b/i.test(slugName);
  return {label:complete?title:name+(house?' by '+house:''),name,...(house?{brand:house}:{}),
    concentrationSpecified,catalogIds:[...new Set(catalogIds)]};
}

const sitemap=await read(origin+'/sitemap.xml');
const urls=[...new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>decode(match[1])))]
  .filter(value=>{const url=new URL(value);return url.origin===origin&&/^\/layer\/[^/]+\/[^/]+$/.test(url.pathname);});
if(!urls.length)throw new Error('No public layering pages were listed.');
const entries=[],failures=[];
let cursor=0;
async function worker() {
  while(cursor<urls.length) {
    const url=urls[cursor++];
    try {
      const html=await read(url);
      const title=decode(html.match(/<title>([^<]+)<\/title>/i)?.[1]??'').trim();
      const labels=title.split(/\s*×\s*/);
      const description=decode(html.match(/<meta name="description" content="([^"]*)"/i)?.[1]??'');
      const rawScore=description.match(/\b(\d+(?:\.\d+)?)\/10\b/)?.[1];
      const score=rawScore===undefined?null:Number(rawScore);
      if(score!==null&&(score<0||score>10))throw new Error('Invalid source score.');
      const slugs=new URL(url).pathname.split('/').slice(2);
      entries.push({
        id:'wil-'+createHash('sha256').update(url).digest('hex').slice(0,16),
        a:fragrance(labels[0],slugs[0]),b:fragrance(labels[1],slugs[1]),
        source:{publisher:'Will It Layer?',url,score,scale:10,method:'algorithmic'},
        checkedAt,
      });
      if(entries.length%50===0)console.log('Imported '+entries.length+' public pairing references.');
    } catch(error) {
      failures.push({url,error:error.message});
    }
    await new Promise(resolve=>setTimeout(resolve,250));
  }
}
await Promise.all([worker(),worker(),worker()]);
entries.sort((a,b)=>a.source.url.localeCompare(b.source.url));
const dataset={
  publisher:'Will It Layer?',methodologyUrl:origin+'/',
  checkedAt,listed:urls.length,
  entries,failures,
};
await mkdir(resolve(output,'..'),{recursive:true});
await writeFile(output,JSON.stringify(dataset,null,2)+'\n');
console.log(JSON.stringify({
  imported:entries.length,failed:failures.length,
  exactPairs:entries.filter(entry=>entry.a.catalogIds.length===1&&entry.b.catalogIds.length===1).length,
  output,
}));
if(failures.length)process.exitCode=1;
