import type {CatalogPhoto,CatalogProfile} from './types.ts';

export function isCatalogPhotoPath(path?:string):path is string {
 return typeof path==='string'&&path===path.trim()&&(
  /^\/catalog\/bottles\/[a-z0-9-]+\.jpg$/.test(path)||/^\/api\/catalog-image\/[a-f0-9]{64}$/.test(path)
 );
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
