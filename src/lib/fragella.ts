import {z} from 'zod';
import {catalogIdentityKey,findCatalogProfile} from './catalog.ts';
import {readLimitedBody} from './catalog-http.ts';
import type {CatalogRating,FragranceFacet} from './catalog-ratings.ts';
import type {CatalogEdition,CatalogProfile,CatalogSource} from './types.ts';

const concentrations = new Map([
 ['eau de toilette','EDT'],['edt','EDT'],['eau de parfum','EDP'],['edp','EDP'],
 ['eau de cologne','EDC'],['cologne','EDC'],['edc','EDC'],['parfum','PARFUM'],
 ['extrait de parfum','EXTRAIT'],['extrait','EXTRAIT'],['elixir','ELIXIR'],
 ['perfume mist','MIST'],['fragrance mist','MIST'],['perfume oil','OIL'],
]);
const voted = new Set(['medium','high','very high']);
const editionSchema=z.object({
 _id:z.string().regex(/^[a-z\d][a-z\d_-]{0,119}$/i),Name:z.string().min(1).max(160),Brand:z.string().min(1).max(160),
 OilType:z.string().max(60),Year:z.string().regex(/^\d{4}$/).or(z.literal('')).optional(),
});
const rowSchema=editionSchema.extend({
 rating:z.string().max(8).optional(),Confidence:z.string().max(25),Popularity:z.string().max(25),
 Longevity:z.string().max(40).optional(),Sillage:z.string().max(40).optional(),
 'Price Value':z.string().max(30).optional(),
});
type LiveRatings={ratings:CatalogRating[];source:CatalogSource};
const maxRatingResponseBytes=1024*1024;
const longevityBands=['poor','weak','moderate','long lasting','very long lasting'];
const projectionBands=['intimate','soft','moderate','strong','enormous'];
const valueBands=['overpriced','okay','good_value'];

export function pickFragellaEdition(edition:CatalogEdition,payload:unknown) {
 if(!Array.isArray(payload)||payload.length>10) return null;
 const yearSuffix=' ('+edition.releaseYear+')';
 const bareName=edition.name.endsWith(yearSuffix)?edition.name.slice(0,-yearSuffix.length):edition.name;
 const expected=catalogIdentityKey({...edition,name:bareName});
 const candidates=payload.filter(raw=>{
  const parsed=editionSchema.safeParse(raw);
  if(!parsed.success) return false;
  const row=parsed.data;
  const concentration=concentrations.get(row.OilType.trim().toLowerCase());
  if(!concentration||concentration!==edition.concentration||
   edition.releaseYear&&Number(row.Year)!==edition.releaseYear) return false;
  const label={name:row.Name,brand:row.Brand,concentration};
  const known=findCatalogProfile(label);
  return known?known.id===edition.id:catalogIdentityKey(label)===expected;
 });
 if(candidates.length!==1||payload.filter(row=>row?._id===candidates[0]._id).length!==1) return null;
 return candidates[0] as z.infer<typeof editionSchema> & Record<string,unknown>;
}

export function pickFragellaRatings(profile:CatalogProfile,payload:unknown):LiveRatings|null {
 if(!profile.releaseYear) return null;
 const parsed=rowSchema.safeParse(pickFragellaEdition(profile,payload));
 if(!parsed.success) return null;
 const row=parsed.data;
 if(!['high','medium'].includes(row.Confidence.trim().toLowerCase())||!voted.has(row.Popularity.trim().toLowerCase())) return null;
 const sourceId='fragella';
 const ratings:CatalogRating[]=[];
 const score=Number(row.rating);
 if(row.rating&&/^[0-5](?:\.\d{1,2})?$/.test(row.rating)&&score>0&&score<=5)
  ratings.push({facet:'overall',sourceId,score,kind:'published',basis:'Weighted community rating'});
 const bands:[FragranceFacet,string|undefined,string[],number][]=[
  ['longevity',row.Longevity,longevityBands,1],
  // Fragella defines its Sillage scale by projection distance from the wearer.
  ['projection',row.Sillage,projectionBands,1],
  ['value',row['Price Value'],valueBands,2],
 ];
 for(const [facet,value,labels,minimum] of bands) {
  if(!value) continue;
  const rank=labels.indexOf(value.trim().toLowerCase());
  if(rank>=0) ratings.push({facet,sourceId,score:rank+minimum,kind:'estimate',basis:value.trim().replace(/_/g,' ')});
 }
 if(!ratings.length) return null;
 return {
  ratings,
  source:{id:sourceId,publisher:'Fragella',kind:'community',url:'https://app.fragella.com/fragrance/'+row._id},
 };
}

export async function fetchFragellaPayload(edition:CatalogEdition,key:string,request:typeof fetch):Promise<unknown> {
 const url=new URL('https://api.fragella.com/api/v1/fragrances');
 url.searchParams.set('search',[edition.brand,edition.name,edition.concentration].join(' '));
 url.searchParams.set('limit','10');
 const response=await request(url,{
  headers:{'x-api-key':key,accept:'application/json'},redirect:'error',cache:'no-store',
  signal:AbortSignal.timeout(2400),
 });
 if(!response.ok) {
  await response.body?.cancel();
  throw new Error('Fragella data is unavailable.');
 }
 const bytes=await readLimitedBody(response,maxRatingResponseBytes);
 return bytes?JSON.parse(bytes.toString('utf8')):null;
}

export function createFragellaLookup(request:typeof fetch=fetch) {
 const pending=new Map<string,Promise<LiveRatings|null>>();
 let retryAt=0;
 async function load(profile:CatalogProfile,key:string) {
  try {
   return pickFragellaRatings(profile,await fetchFragellaPayload(profile,key,request));
  } catch {
   retryAt=Date.now()+60_000;
   return null;
  }
 }
 return async (profile:CatalogProfile,key:string,admit:()=>boolean=()=>true):Promise<LiveRatings|null>=>{
  if(!key||Date.now()<retryAt) return null;
  const existing=pending.get(profile.id);
  if(existing) return existing;
  if(!admit()) return null;
  const lookup=load(profile,key).finally(()=>pending.delete(profile.id));
  pending.set(profile.id,lookup);
  return lookup;
 };
}

export const lookupFragellaRatings=createFragellaLookup();
