import {catalogProfiles} from './catalog.ts';
import {catalogProfilesById,searchCatalogEditions} from './catalog-editions.ts';
import type {CatalogProfile,CatalogSearchReply,ComparisonNotes} from './types.ts';

const normalize=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim();
type Stage='any'|'top'|'heart'|'base'|'listed';
export interface CatalogSearchOptions {query?:string;include?:string[];exclude?:string[];stage?:Stage;match?:'all'|'any';offset?:number}

/** Filters recorded note names; absence from a listed pyramid is not an allergen guarantee. */
export function discoverCatalog({query='',include=[],exclude=[],stage='any',match='all',offset=0}:CatalogSearchOptions):CatalogSearchReply {
 const wanted=include.map(normalize),unwanted=exclude.map(normalize);
 const matches=searchCatalogEditions(query,10000).filter(edition=>{
  if(!wanted.length&&!unwanted.length)return true;
  const profile=catalogProfilesById.get(edition.id);
  if(!profile?.notes.length)return false;
  const notes=new Set(profile.notes.filter(note=>stage==='any'||note.stage===stage).map(note=>normalize(note.name)));
  if(!notes.size)return false;
  return (!wanted.length||(match==='all'?wanted.every(note=>notes.has(note)):wanted.some(note=>notes.has(note))))&&
   unwanted.every(note=>!notes.has(note));
 });
 return {total:matches.length,offset,entries:matches.slice(offset,offset+12).map(edition=>({
  ...edition,hasNotes:!!catalogProfilesById.get(edition.id)?.notes.length,
 }))};
}

function noteMap(profile:CatalogProfile|null){return new Map(profile?.notes.map(note=>[normalize(note.name),note.name])??[]);}
export function compareProfiles(left:CatalogProfile|null,right:CatalogProfile|null):ComparisonNotes {
 const a=noteMap(left),b=noteMap(right),sharedNotes=[...a].filter(([key])=>b.has(key)).map(([,name])=>name);
 const sort=(names:string[])=>names.sort((a,b)=>a.localeCompare(b));
 return {sharedNotes:sort(sharedNotes),leftOnly:sort([...a].filter(([key])=>!b.has(key)).map(([,name])=>name)),
  rightOnly:sort([...b].filter(([key])=>!a.has(key)).map(([,name])=>name)),
  noteOverlap:a.size&&b.size?Math.round(sharedNotes.length/(new Set([...a.keys(),...b.keys()]).size)*100):null};
}

export function similarCatalog(profile:CatalogProfile|null,limit=5){
 if(!profile?.notes.length)return [];
 return catalogProfiles.filter(other=>other.id!==profile.id&&other.notes.length).map(other=>{
  const comparison=compareProfiles(profile,other);
  const {id,brand,name,concentration,releaseYear}=other;
  return {edition:{id,brand,name,concentration,releaseYear},sharedNotes:comparison.sharedNotes,overlap:comparison.noteOverlap!};
 }).filter(match=>match.sharedNotes.length>0).sort((a,b)=>b.overlap-a.overlap||b.sharedNotes.length-a.sharedNotes.length||a.edition.id.localeCompare(b.edition.id)).slice(0,limit);
}
