import {findCatalogProfile} from './catalog.ts';
import {catalogReferenceUrl} from './catalog-ratings.ts';
import type {Bottle,PairRecord} from './types.ts';

export function enrichRecommendationBottles(bottles:Bottle[]):Bottle[] {
 return bottles.map(bottle=>{
  if(bottle.provenance==='demo')return bottle;
  const profile=findCatalogProfile(bottle);
  if(!profile?.notes.length)return bottle;
  const catalogNotes=profile.notes.map(note=>note.name.toLowerCase());
  if(bottle.profileKnown)return {...bottle,catalogNotes};
  const source=profile.sources.find(item=>item.kind==='house'&&profile.notes.some(note=>note.sourceIds.includes(item.id)))
   ??profile.sources.find(item=>profile.notes.some(note=>note.sourceIds.includes(item.id)));
  const url=source&&catalogReferenceUrl(source.url);
  const projection=Math.max(0,...profile.ratings.filter(item=>item.facet==='projection').map(item=>item.score));
  const strength=projection<=2?1:projection<=3.5?2:3;
  return {...bottle,notes:catalogNotes,profileKnown:true,provenance:'catalog',strength,climate:'UNKNOWN',
   ...(url&&source?{catalogSource:{label:source.publisher,url}}:{}),
   ...(!projection?{strengthUnknown:true as const}:{})};
 });
}

const reviewedBrandPairs=[{
 ids:['jo-malone-london-wood-sage-and-sea-salt-edc','jo-malone-london-peony-and-blush-suede-edc'],
 author:'Jo Malone London',
 url:'https://www.jomalone.com/scent-layering',
 note:'Jo Malone London recommends layering these two colognes to add warmth.',
 reviewedAt:'2026-11-12',
}] as const;

export function reviewedPairsFor(bottles:Bottle[]):PairRecord[] {
 const owned=bottles.filter(bottle=>bottle.ownership==='OWNED'&&bottle.provenance!=='demo');
 const editions=owned.map(bottle=>({bottle,id:findCatalogProfile(bottle)?.id}));
 return reviewedBrandPairs.flatMap(pair=>{
  const [first,second]=pair.ids.map(id=>[...new Set(editions.filter(item=>item.id===id).map(item=>item.bottle.variantId))]);
  return first.flatMap(a=>second.map(b=>({a,b,kind:'brand' as const,status:'approved' as const,reviewedAt:pair.reviewedAt,note:pair.note,
   reports:[{author:pair.author,firsthand:true,rights:'approved',url:pair.url}]})));
 });
}
