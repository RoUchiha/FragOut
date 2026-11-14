import {z} from 'zod';
import {catalogIdentityKey,catalogProfiles,findCatalogProfile} from './catalog.ts';
import type {BottleCandidate} from './types.ts';

export const modelBottleSchema=z.object({
 candidates:z.array(z.object({
  brand:z.string().trim().max(100),
  name:z.string().trim().max(120),
 }).strict()).max(3),
}).strict();

const normalize=(value:string)=>value.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'')
 .replace(/&/g,' and ').replace(/[’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const contains=(text:string,phrase:string)=>phrase.length>0&&(' '+text+' ').includes(' '+phrase+' ');
const includesLabel=(text:string,phrase:string)=>{
 const normalized=normalize(phrase);
 if(contains(text,normalized))return true;
 // OCR sometimes joins two printed words in a logo, as in "JOMALONE".
 const joined=normalized.replaceAll(' ','');
 return joined!==normalized&&joined.length>=6&&contains(text,joined);
};
const visibleBrand=(words:string,brand:string)=>includesLabel(words,brand)||includesLabel(words,brand.replace(/\blondon$/, '').trim());
const concentrations=[
 ['EXTRAIT',/\b(?:extrait(?: de parfum)?|pure perfume)\b/],
 ['EDP',/\b(?:eau de parfum|edp)\b/],
 ['EDT',/\b(?:eau de toilette|edt)\b/],
 ['EDC',/\b(?:eau de cologne|edc|cologne)\b/],
 ['ELIXIR',/\belixir\b/],
 ['MIST',/\b(?:perfume mist|fragrance mist|body mist|hair mist)\b/],
 ['OIL',/\b(?:perfume oil|fragrance oil)\b/],
 ['PARFUM',/\bparfum\b/],
] as const;

export function groundedBottleCandidates(readings:string[],proposal:z.infer<typeof modelBottleSchema>['candidates']) {
 const labelLines:string[]=[];
 const printedNames=new Set<string>();
 const visibleConcentrations=new Set<string>();
 for(const reading of readings) {
  const lines=reading.split('\n').map(normalize);
  lines.forEach((line,index)=>{
   if(!line)return;
   labelLines.push(line);
   printedNames.add(line);
   const concentration=concentrations.find(([,pattern])=>pattern.test(line));
   if(concentration)visibleConcentrations.add(concentration[0]);
   // Some front labels stack a name over several lines. Keep words in the
   // same reading and in order. The full joined name must match exactly.
   const next=lines[index+1];
   const last=lines[index+2];
   if(next) {
    printedNames.add(line+' '+next);
    if(last)printedNames.add(line+' '+next+' '+last);
   }
  });
 }
 const hasVisibleBrand=(brand:string)=>labelLines.some(line=>visibleBrand(line,brand));
 const concentration=visibleConcentrations.size===1?[...visibleConcentrations][0]:'UNKNOWN';
 const candidates:BottleCandidate[]=[];
 const knownLabels=new Set<string>();
 const add=(brand:string,name:string)=>{
  const key=JSON.stringify([normalize(brand),normalize(name)]);
  if(knownLabels.has(key)||candidates.length>=3)return;
  knownLabels.add(key);
  const profile=findCatalogProfile({brand,name,concentration});
  candidates.push({brand:profile?.brand??brand,name:profile?.name??name,concentration,confidence:'uncertain',
   clue:concentration==='UNKNOWN'?'Concentration unclear. Check the bottle or box.':'Compare these label details with your bottle.'});
 };
 for (const candidate of proposal) {
  const house=normalize(candidate.brand);
  const normalizedName=normalize(candidate.name);
  const printedName=normalizedName.startsWith(house+' ')?normalizedName.slice(house.length+1):normalizedName;
  if(house&&printedName!==house&&hasVisibleBrand(house)&&(printedNames.has(printedName)||printedNames.has(house+' '+printedName))){
   add(candidate.brand,candidate.name);
  }
 }
 if(!candidates.length) {
  const editions=catalogProfiles.filter(edition=>{
   const key=catalogIdentityKey(edition);
   if(!key)return false;
   const [house,name]=JSON.parse(key) as [string,string,string];
   const printedName=normalize(edition.name);
   const nameIsVisible=printedNames.has(printedName)||printedNames.has(house+' '+printedName)||
    (concentration!=='UNKNOWN'&&(printedNames.has(name)||printedNames.has(house+' '+name)));
   return (concentration==='UNKNOWN'||edition.concentration===concentration)&&nameIsVisible&&hasVisibleBrand(house);
  });
  const matches=new Map(editions.map(edition=>[JSON.stringify([normalize(edition.brand),normalize(edition.name)]),edition]));
  if(matches.size===1) {
   const edition=[...matches.values()][0];
   add(edition.brand,edition.name);
  }
 }
 return {
  candidates,
  message:candidates.length?'Check the exact label before saving.':'No readable fragrance label. Retake the photo or enter it manually.',
 };
}
