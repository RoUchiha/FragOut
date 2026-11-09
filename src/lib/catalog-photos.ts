import {catalogReferenceUrl} from './catalog-ratings.ts';
import type {Bottle,CatalogPhoto,CatalogProfile} from './types.ts';

export function isCatalogPhotoPath(path?:string):path is string {
 return typeof path==='string'&&path===path.trim()&&/^\/catalog\/bottles\/[a-z0-9-]+\.jpg$/.test(path);
}

export function catalogGalleryPhotos(
 profile:Pick<CatalogProfile,'photo'|'additionalPhotos'>|null|undefined,
 unavailable:readonly string[]=[],
):CatalogPhoto[] {
 if(!profile?.photo) return [];
 const seen=new Set(unavailable);
 const gallery:CatalogPhoto[]=[];
 for(const photo of [profile.photo,...(profile.additionalPhotos??[])]) {
  if(!isCatalogPhotoPath(photo.path)||seen.has(photo.path)) continue;
  seen.add(photo.path);
  gallery.push(photo);
 }
 return gallery;
}

export function catalogPhotoSearchUrl({brand,name,concentration}:Pick<Bottle,'brand'|'name'|'concentration'>) {
 const url=new URL('https://www.google.com/search');
 url.searchParams.set('udm','2');
 const format=concentration==='UNKNOWN'?'':concentration;
 url.searchParams.set('q',[brand.trim(),name.trim(),format,'bottle'].filter(Boolean).join(' '));
 return url.href;
}

export function catalogPhotoReferences(profile:CatalogProfile):{label:string;url:string}[] {
 const candidates=[
  ...profile.links.filter(link=>link.kind==='jomashop-listing').map(link=>({
   label:link.bottleEdition?'Jomashop · '+link.bottleEdition:'Jomashop photos',url:link.url,
  })),
  ...profile.sources.filter(source=>source.kind==='house'||source.id==='retailer'||source.id==='scento')
   .map(source=>({label:source.kind==='house'?'Official bottle photos':source.publisher+' listing',url:source.url})),
 ];
 const references=new Map<string,string>();
 for(const {label,url} of candidates) {
  const destination=catalogReferenceUrl(url);
  if(destination&&!references.has(destination)) references.set(destination,label);
  if(references.size===2) break;
 }
 return [...Array.from(references,([url,label])=>({label,url})),
  {label:'Search bottle photos',url:catalogPhotoSearchUrl(profile)}];
}
