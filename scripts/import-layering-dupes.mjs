import {readFile,writeFile} from 'node:fs/promises';
import {catalogIdentityKey} from '../src/lib/catalog.ts';
import identity from '../catalog/identity.json' with {type:'json'};
import {declaresInspiration} from './lib/declared-inspiration.ts';

const snapshot=JSON.parse(await readFile(new URL('../catalog/layering.json',import.meta.url),'utf8'));
const [source,...duaSources]=process.argv.slice(2);
if(!source)throw new Error('Pass the staged Montagne product JSON filename.');
const products=JSON.parse(await readFile(source,'utf8'));
const normalize=value=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
 .replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,'').trim();
const phrases=new Map();
const originals=new Map();
for(const side of snapshot.entries.flatMap(entry=>[entry.a,entry.b])) {
 if(!side.brand)continue;
 const key=catalogIdentityKey({...side,concentration:'EDP'});
 if(!key)continue;
 const [house,name]=JSON.parse(key);
 const brands=[side.brand,house,...Object.entries(identity.houseAliases).filter(([,value])=>value===house).map(([key])=>key)];
 for(const brand of brands)phrases.set(normalize(brand+' '+side.name),{brand:side.brand,name:side.name});
 originals.set(key,{original:{brand:side.brand,name:side.name},
  brands});
}
const rows=[];
for(const product of products.items??[]) {
 const match=product.title?.match(/^(.+?)\s+INSPIRED\s+BY\s+(.+)$/i);
 if(!match)continue;
 const original=phrases.get(normalize(match[2]));
 const body=(product.body??product.excerpt??'').replace(/<[^>]*>/g,' ');
 if(!original||!/eau de parfum/i.test(body))continue;
 const productUrl=new URL(product.fullUrl,'https://www.montagneparfums.com');
 if(productUrl.origin!=='https://www.montagneparfums.com'||!productUrl.pathname.startsWith('/fragrance/'))continue;
 const name=match[1].toLowerCase().replace(/\b\p{L}/gu,letter=>letter.toUpperCase());
 rows.push({
  original,alternative:{brand:'Montagne Parfums',name,concentration:'EDP'},
  evidence:'brand',sources:[{publisher:'Montagne Parfums',url:productUrl.href}],checkedAt:snapshot.checkedAt,
 });
}
for(const filename of duaSources) {
 const page=JSON.parse(await readFile(filename,'utf8'));
 for(const product of page.products??[]) {
  const text=(product.body_html??'').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|rsquo|#39);/gi,' ').replace(/\s+/g,' ');
  if(/\b(?:hybrid|tribrid|quadbrid|bundle|gift set|our versions of)\b/i.test(product.title+' '+text)||
    !/\b(?:inspired|inspiration|dupe|impression)\b/i.test(text))continue;
  const format=text.match(/CONCENTRATION:\s*(Extrait(?: de Parfum)?|Eau de Parfum|Eau de Toilette|Perfume Oil)/i)?.[1];
  const concentration=format?/extrait/i.test(format)?'EXTRAIT':/eau de parfum/i.test(format)?'EDP':/eau de toilette/i.test(format)?'EDT':'OIL':null;
  if(!concentration)continue;
  const matching=[...originals.values()].filter(candidate=>candidate.brands.some(brand=>
   declaresInspiration(text,candidate.original.name,brand)));
  if(matching.length!==1)continue;
  const url=new URL('/products/'+product.handle,'https://theduabrand.com');
  if(!/^[a-z0-9-]+$/.test(product.handle))continue;
  rows.push({original:matching[0].original,
   alternative:{brand:'DUA Fragrances',name:product.title.trim(),concentration},
   evidence:'brand',sources:[{publisher:'DUA Fragrances',url:url.href}],checkedAt:snapshot.checkedAt});
 }
}
rows.sort((a,b)=>(a.original.brand+a.original.name+a.alternative.name).localeCompare(b.original.brand+b.original.name+b.alternative.name));
const unique=[...new Map(rows.map(row=>[catalogIdentityKey({...row.original,concentration:'EDP'})+catalogIdentityKey(row.alternative),row])).values()];
await writeFile(new URL('../catalog/layering-dupes.json',import.meta.url),JSON.stringify(unique,null,2)+'\n');
console.log('Imported '+unique.length+' maker-stated inspirations for layering fragrances.');
