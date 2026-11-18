import {matchesBottleSearch} from './scent-search.ts';
import type {Bottle,WearEvent} from './types.ts';

export type CollectionSort='name'|'brand'|'rating'|'least-worn';
export interface CollectionFilters {
 query:string;ownership:string;favorites:boolean;concentration:string;note:string;sort:CollectionSort;
}
export const collectionDefaults:CollectionFilters={
 query:'',ownership:'OWNED',favorites:false,concentration:'ALL',note:'',sort:'name',
};
export const collectionSortOptions=[
 ['name','Name'],['brand','Brand'],['rating','My rating'],['least-worn','Least worn · recent logs'],
] as const;
const normalize=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').trim().toLowerCase();
const notesFor=(bottle:Bottle)=>[...new Map([...bottle.notes,...(bottle.catalogNotes??[])].map(note=>[normalize(note),note])).entries()];

export function collectionNotes(bottles:Bottle[],ownership='OWNED') {
 const counts=new Map<string,{name:string;count:number}>();
 for(const bottle of bottles.filter(bottle=>ownership==='ALL'||bottle.ownership===ownership)) {
  for(const [key,name] of notesFor(bottle)) {
   const current=counts.get(key);
   counts.set(key,{name:current?.name??name,count:(current?.count??0)+1});
  }
 }
 return [...counts.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
}

export function browseCollection(bottles:Bottle[],history:WearEvent[],filters:CollectionFilters) {
 const wearCounts=new Map<string,number>();
 for(const event of history.filter(event=>event.reaction==='wore')) {
  for(const id of new Set(event.bottleIds))wearCounts.set(id,(wearCounts.get(id)??0)+1);
 }
 const visible=bottles.filter(bottle=>
  (filters.ownership==='ALL'||bottle.ownership===filters.ownership)&&
  (!filters.favorites||bottle.favorite)&&
  (filters.concentration==='ALL'||bottle.concentration===filters.concentration)&&
  (!filters.note||notesFor(bottle).some(([key])=>key===normalize(filters.note)))&&
  matchesBottleSearch(bottle,filters.query));
 return visible.sort((a,b)=>{
  const primary=filters.sort==='brand'?a.brand.localeCompare(b.brand):
   filters.sort==='rating'?b.rating-a.rating:
   filters.sort==='least-worn'?(wearCounts.get(a.id)??0)-(wearCounts.get(b.id)??0):0;
  return primary||a.name.localeCompare(b.name)||a.concentration.localeCompare(b.concentration)||a.id.localeCompare(b.id);
 });
}
