import type {CatalogPhoto,CatalogProfile} from './types.ts';

export function isCatalogPhotoPath(path?:string):path is string {
 return typeof path==='string'&&path===path.trim()&&/^\/catalog\/bottles\/[a-z0-9-]+\.jpg$/.test(path);
}

export function isCatalogThumbnailDataUri(uri:unknown):uri is string {
 const prefix='data:image/jpeg;base64,';
 if(typeof uri!=='string'||uri.length>1_000_000||!uri.startsWith(prefix)) return false;
 const bytes=uri.slice(prefix.length);
 return bytes.length%4===0&&/^\/9j\/[a-zA-Z0-9+/]+={0,2}$/.test(bytes)&&bytes===bytes.trim();
}

export function catalogThumbnailPhotos(
 profile:Pick<CatalogProfile,'photo'|'additionalPhotos'>|null|undefined,
 unavailable:readonly string[]=[],
):CatalogPhoto[] {
 if(!profile?.photo) return [];
 const seen=new Set(unavailable);
 const photos:CatalogPhoto[]=[];
 for(const photo of [profile.photo,...(profile.additionalPhotos??[])]) {
  if(!isCatalogPhotoPath(photo.path)||seen.has(photo.path)) continue;
  seen.add(photo.path);
  photos.push(photo);
 }
 return photos;
}
