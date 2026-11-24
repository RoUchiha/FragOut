import snapshot from '../../catalog/layering.json' with {type:'json'};
import extraDupes from '../../catalog/layering-dupes.json' with {type:'json'};
import {catalogIdentityKey,catalogProfiles,findCatalogDupes,findCatalogProfile} from './catalog.ts';
import {catalogThumbnailPhotos} from './catalog-photos.ts';
import {catalogEditionById,findPublicCatalogEdition} from './catalog-editions.ts';
import type {Bottle,CatalogDupe,LayeringLibraryEntry,LayeringLibrarySide,LayeringReference} from './types.ts';

const profiles=new Map(catalogProfiles.map(profile=>[profile.id,profile]));
interface ImportedSide {label:string;name:string;brand?:string;catalogIds:string[];concentrationSpecified?:boolean}
interface ImportedPair {
 id:string;a:ImportedSide;b:ImportedSide;checkedAt:string;
 source:{publisher:string;url:string;score:number|null;scale:number};
}
const sourceEntries:ImportedPair[]=snapshot.entries;
const normalize=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase()
 .replace(/[’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const pairKey=(a:string,b:string)=>JSON.stringify([a,b].sort());
const pairIndex=new Map<string,ImportedPair>();
const namedPairIndex=new Map<string,ImportedPair>();
function nameKey(label:{brand?:string;name:string}) {
 if(!label.brand)return null;
 const key=catalogIdentityKey({brand:label.brand,name:label.name,concentration:'EDP'});
 return key?JSON.stringify(JSON.parse(key).slice(0,2)):null;
}
for(const entry of sourceEntries) {
 const a=nameKey(entry.a),b=nameKey(entry.b);
 if(a&&b&&!entry.a.concentrationSpecified&&!entry.b.concentrationSpecified) {
  const key=pairKey(a,b);
  const previous=namedPairIndex.get(key);
  if(!previous||(entry.source.score??0)>(previous.source.score??0))namedPairIndex.set(key,entry);
 }
 if(entry.a.catalogIds.length!==1||entry.b.catalogIds.length!==1)continue;
 const key=pairKey(entry.a.catalogIds[0],entry.b.catalogIds[0]);
 const previous=pairIndex.get(key);
 if(!previous||(entry.source.score??0)>(previous.source.score??0))pairIndex.set(key,entry);
}

function names(bottle:Bottle) {
 if(bottle.provenance==='demo')return [];
 const direct=nameKey(bottle);
 const alternatives=extraDupes.filter(row=>catalogIdentityKey(row.alternative)===catalogIdentityKey(bottle)).map(row=>row.original);
 return [
  ...(direct?[{key:direct,substitute:false}]:[]),
  ...[...findCatalogDupes(bottle).originals,...alternatives].flatMap(original=>{
   const key=nameKey(original);
   return key?[{key,substitute:true}]:[];
  }),
 ];
}

function origins(bottle:Bottle) {
 if(bottle.provenance==='demo')return [];
 const profile=findPublicCatalogEdition(bottle);
 const originalIds=findCatalogDupes(bottle).originals.map(original=>findCatalogProfile(original)?.id).filter(id=>id!==undefined);
 return [...new Set([...(profile?[profile.id]:[]),...originalIds])];
}

function reference(entry:ImportedPair,dupeAdapted=false):LayeringReference {
 return {
  publisher:entry.source.publisher,url:entry.source.url,score:entry.source.score,scale:entry.source.scale,
  originalPair:[entry.a.label,entry.b.label],dupeAdapted,
  editionUnconfirmed:!entry.a.concentrationSpecified||!entry.b.concentrationSpecified,
 };
}

export function createLayeringReferenceLookup(){
 // Scope identity/dupe work to this recommendation request, never user globals.
 const cache=new WeakMap<Bottle,{ids:string[];named:ReturnType<typeof names>;directId:string|undefined}>();
 const facts=(bottle:Bottle)=>{
  let value=cache.get(bottle);
  if(!value){value={ids:origins(bottle),named:names(bottle),directId:findPublicCatalogEdition(bottle)?.id};cache.set(bottle,value);}
  return value;
 };
 return (a:Bottle,b:Bottle):LayeringReference|undefined=>{
  const firstFacts=facts(a),secondFacts=facts(b);
  for(const first of firstFacts.ids)for(const second of secondFacts.ids){
   const entry=pairIndex.get(pairKey(first,second));
   if(entry)return reference(entry,firstFacts.directId!==first||secondFacts.directId!==second);
  }
  for(const first of firstFacts.named)for(const second of secondFacts.named){
   const entry=namedPairIndex.get(pairKey(first.key,second.key));
   if(entry)return reference(entry,first.substitute||second.substitute);
  }
 };
}
export function layeringReferenceFor(a:Bottle,b:Bottle):LayeringReference|undefined {
 return createLayeringReferenceLookup()(a,b);
}

export function searchLayeringCatalog(bottles:Bottle[],query='',ownedOnly=false,offset=0) {
 const owned=bottles.filter(bottle=>bottle.ownership==='OWNED');
 const ownedOrigins=owned.map(bottle=>({bottle,ids:origins(bottle),names:names(bottle)}));
 const matches=(item:typeof ownedOrigins[number],side:ImportedSide)=>item.ids.some(id=>side.catalogIds.includes(id))||
  (!side.concentrationSpecified&&item.names.some(candidate=>candidate.key===nameKey(side)));
 const alternatives=(value:ImportedSide)=>{
  const recorded=value.catalogIds.flatMap(id=>{
   const edition=catalogEditionById(id);
   return edition?findCatalogDupes(edition).alternatives.map(dupe=>({...dupe,originalConcentration:edition.concentration})):[];
  });
  const extra:CatalogDupe[]=extraDupes.filter(row=>nameKey(row.original)===nameKey(value)).map(row=>({
   ...row.alternative,evidence:'brand',sources:row.sources,
  }));
  return [...new Map([...extra,...recorded].map(dupe=>[catalogIdentityKey(dupe),dupe])).values()].slice(0,3);
 };
 const side=(value:ImportedSide):LayeringLibrarySide=>({
  label:value.label,
  alternatives:alternatives(value),
  editions:value.catalogIds.flatMap(id=>{
   const edition=catalogEditionById(id);
   if(!edition)return [];
   const photo=catalogThumbnailPhotos(profiles.get(id))[0]?.path;
   return [{...edition,dupes:findCatalogDupes(edition),...(photo?{photo}:{})}];
  }),
  owned:ownedOrigins.filter(item=>matches(item,value)).map(({bottle,names})=>({
   id:bottle.id,variantId:bottle.variantId,name:bottle.name,brand:bottle.brand,concentration:bottle.concentration,
   substitute:!value.catalogIds.includes(findPublicCatalogEdition(bottle)?.id??'')&&
    !names.some(candidate=>candidate.key===nameKey(value)&&!candidate.substitute),
  })),
 });
 const terms=normalize(query).split(' ').filter(Boolean);
 const matching=sourceEntries.filter(entry=>{
  const ids=[...entry.a.catalogIds,...entry.b.catalogIds];
  const search=normalize([entry.a.label,entry.b.label,...ids.flatMap(id=>profiles.get(id)?.notes.map(note=>note.name)??[])].join(' '));
  return terms.every(term=>search.includes(term))&&(!ownedOnly||ownedOrigins.some(item=>matches(item,entry.a)||matches(item,entry.b)));
 }).sort((a,b)=>(b.source.score??0)-(a.source.score??0)||a.id.localeCompare(b.id));
 const entries:LayeringLibraryEntry[]=matching.slice(offset,offset+12).map(entry=>({
  id:entry.id,a:side(entry.a),b:side(entry.b),reference:reference(entry),checkedAt:entry.checkedAt,
 }));
 return {entries,total:matching.length,nextOffset:offset+entries.length<matching.length?offset+entries.length:null};
}
