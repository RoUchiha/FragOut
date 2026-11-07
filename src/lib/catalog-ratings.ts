export const fragranceFacets = [
 ['overall','Overall'],['longevity','Longevity'],['projection','Projection'],['sillage','Sillage'],
 ['scent','Scent'],['versatility','Versatility'],['value','Value'],['bottle','Bottle'],
] as const;

export type FragranceFacet = typeof fragranceFacets[number][0];

export interface CatalogRating {
 facet:FragranceFacet;
 sourceId:string;
 score:number;
 kind:'published'|'estimate';
 basis:string;
}

export function catalogReferenceUrl(value:string):string|null {
 try {
  const url=new URL(value);
  const publicHost=/\.[a-z][a-z\d-]+$/i.test(url.hostname)
   &&!/\.(?:local|localhost|internal|test|invalid)$/i.test(url.hostname);
  return url.protocol==='https:'&&publicHost&&!url.username&&!url.password&&!url.port?url.href:null;
 } catch {
  return null;
 }
}
