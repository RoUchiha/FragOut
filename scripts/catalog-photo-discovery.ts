import {readLimitedBody} from '../src/lib/catalog-http.ts';
import {catalogReferenceUrl} from '../src/lib/catalog-ratings.ts';
import type {CatalogEdition} from '../src/lib/types.ts';

const formats:Record<string,string>={EDP:'Eau de Parfum',EDT:'Eau de Toilette',EDC:'Eau de Cologne',
 EXTRAIT:'Extrait de Parfum',MIST:'Fragrance Mist'};

export function bottleImageSearchUrl(edition:CatalogEdition) {
 const format=formats[edition.concentration]??edition.concentration;
 const name=edition.name.toLowerCase().endsWith(format.toLowerCase())?edition.name:edition.name+' '+format;
 const url=new URL('https://www.google.com/search');
 url.search=new URLSearchParams({udm:'2',q:edition.brand+' '+name+' perfume bottle front product photo'}).toString();
 return url.href;
}

export async function discoverProductPhotos(page:string,request:typeof fetch=fetch) {
 const source=catalogReferenceUrl(page);
 if(!source) return [];
 const response=await request(source,{redirect:'error',credentials:'omit',cache:'no-store',
  headers:{Accept:'text/html'},signal:AbortSignal.timeout(8000)});
 if(!response.ok||response.redirected||!response.headers.get('content-type')?.startsWith('text/html')) {
  await response.body?.cancel();
  return [];
 }
 const html=(await readLimitedBody(response,3*1024*1024))?.toString('utf8')??'';
 const urls=new Set<string>();
 for(const [tag] of html.matchAll(/<meta\s+[^>]*>/gi)) {
  const attrs=new Map([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
   .map(([,name,double,single,unquoted])=>[name.toLowerCase(),double??single??unquoted]));
  const kind=(attrs.get('property')??attrs.get('name'))?.toLowerCase();
  const value=attrs.get('content')?.replaceAll('&amp;','&').trim();
  if(!value||!kind||!['og:image','og:image:url','og:image:secure_url','twitter:image'].includes(kind)) continue;
  try {
   const url=catalogReferenceUrl(new URL(value,source).href);
   if(url) urls.add(url);
  } catch { /* The page may contain an invalid metadata URL. */ }
  if(urls.size>=6) break;
 }
 return [...urls].map(imageUrl=>({source,imageUrl}));
}
