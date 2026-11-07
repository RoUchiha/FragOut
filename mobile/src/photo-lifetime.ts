const objectUrls=new Set<string>();
export const imageCacheFolders=['ImagePicker','ImageManipulator','fragout-capture'] as const;
export function trackPhotoUrl(uri:string){if(uri.startsWith('blob:'))objectUrls.add(uri);return uri;}
export function revokePhotoUrl(uri:string){if(uri.startsWith('blob:')){URL.revokeObjectURL(uri);objectUrls.delete(uri);}}
export function revokeAllPhotoUrls(){for(const uri of objectUrls)URL.revokeObjectURL(uri);objectUrls.clear();}

// Expo picker/manipulator copies live here. A library original is never eligible.
export function isDisposablePhoto(uri:string,cacheUri:string){
 try{
  const file=new URL(uri),cache=new URL(cacheUri);
  if(file.protocol!=='file:'||cache.protocol!=='file:'||file.host!==cache.host)return false;
  const root=decodeURIComponent(cache.pathname).replace(/\/$/,'')+'/';
  const path=decodeURIComponent(file.pathname);
  if(path.includes('..')||!path.startsWith(root))return false;
  const relative=path.slice(root.length),parts=relative.split('/');
  if(parts.length>1)return imageCacheFolders.some(folder=>parts[0]===folder);
  // Some SDK 58 iOS picker paths use the cache root rather than ImagePicker/.
  return /^[0-9a-f-]{36}\.(jpe?g|png|webp|heic|heif|gif|bmp|tiff?|avif)$/i.test(relative);
 }catch{return false;}
}
