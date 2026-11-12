import {Platform} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import {imageCacheFolders,isDisposablePhoto,revokeAllPhotoUrls,revokePhotoUrl,trackPhotoUrl} from './photo-lifetime';
export interface Capture {uri:string;data:string;mime:'image/jpeg'}
export async function discardPhoto(photo:Capture|null){
 if(!photo)return;
 photo.data='';
 if(Platform.OS==='web'){revokePhotoUrl(photo.uri);return;}
 const {File,Paths}=await import('expo-file-system');
 if(isDisposablePhoto(photo.uri,Paths.cache.uri)){const f=new File(photo.uri);if(f.exists)f.delete();}
}
export async function clearTemporaryPhotos(){
 if(Platform.OS==='web'){revokeAllPhotoUrls();return;}
 const {Directory,File,Paths}=await import('expo-file-system');
 for(const folder of imageCacheFolders){const directory=new Directory(Paths.cache,folder);if(directory.exists)directory.delete();}
 for(const file of new Directory(Paths.cache).list())if(file instanceof File&&isDisposablePhoto(file.uri,Paths.cache.uri))file.delete();
 for(const file of new Directory(Paths.cache).list())if(file instanceof File&&/^fragout-export-\d+-\d+\.json$/.test(file.uri.slice(Paths.cache.uri.length)))file.delete();
 const exported=new File(Paths.cache,'fragout-export.json');if(exported.exists)exported.delete();
}
type PhotoSource='selfie'|'bottle'|'gallery';

async function pickWebPhoto(source:PhotoSource){
 const file=await new Promise<globalThis.File|null>(resolve=>{
  const input=document.createElement('input');
  input.type='file';
  input.accept='image/*';
  input.hidden=true;
  if(source!=='gallery')input.setAttribute('capture',source==='selfie'?'user':'environment');
  const finish=()=>{
   const file=input.files?.[0]??null;
   input.removeEventListener('change',finish);
   input.removeEventListener('cancel',finish);
   input.remove();
   resolve(file);
  };
  input.addEventListener('change',finish);
  input.addEventListener('cancel',finish);
  document.body.append(input);
  input.click();
 });
 if(!file)return null;
 const uri=trackPhotoUrl(URL.createObjectURL(file));
 try{
  const image=new Image();
  image.src=uri;
  await image.decode();
  return {uri,width:image.naturalWidth,height:image.naturalHeight};
 }catch{
  revokePhotoUrl(uri);
  throw new Error('Photo could not be read. Choose a JPG or PNG image.');
 }
}

async function pickNativePhoto(source:PhotoSource){
 if(source!=='gallery'){const permission=await ImagePicker.requestCameraPermissionsAsync();if(!permission.granted)throw new Error('Camera access was denied. Choose a photo or type the details instead.');}
 const options:ImagePicker.ImagePickerOptions={mediaTypes:['images'],quality:0.75,exif:false,base64:false,allowsEditing:false};
 const result=source==='gallery'?await ImagePicker.launchImageLibraryAsync(options):await ImagePicker.launchCameraAsync({...options,cameraType:source==='selfie'?ImagePicker.CameraType.front:ImagePicker.CameraType.back});
 return result.canceled?null:result.assets[0];
}

export async function capturePhoto(source:PhotoSource):Promise<Capture|null>{
 const asset=Platform.OS==='web'?await pickWebPhoto(source):await pickNativePhoto(source);
 if(!asset)return null;
 let converted:ImageManipulator.ImageResult|undefined;
 try{
  const resize=asset.width>=asset.height?{width:1024}:{height:1024};
  converted=await ImageManipulator.manipulateAsync(asset.uri,Math.max(asset.width,asset.height)>1024?[{resize}]:[],{compress:0.8,format:ImageManipulator.SaveFormat.JPEG,base64:true});
  trackPhotoUrl(converted.uri);
  if(!converted.base64)throw new Error('Photo could not be processed.');
  if(converted.base64.length>4*1024*1024)throw new Error('Photo is too large. Try a smaller image.');
  return {uri:converted.uri,data:converted.base64,mime:'image/jpeg'};
 }catch(error){
  if(converted)await discardPhoto({uri:converted.uri,data:'',mime:'image/jpeg'});
  throw error;
 }finally{
  if(asset.uri!==converted?.uri)await discardPhoto({uri:asset.uri,data:'',mime:'image/jpeg'});
 }
}
export async function startDictation(onText:(text:string)=>void,onEnd:()=>void,onError:(message:string)=>void){
 try{
  const {ExpoSpeechRecognitionModule:speech}=await import('expo-speech-recognition');
  if(!speech.isRecognitionAvailable())throw new Error('Speech recognition is unavailable on this device.');
  const permission=await speech.requestPermissionsAsync();if(!permission.granted)throw new Error('Microphone or speech permission was denied. You can still type.');
  const result=speech.addListener('result',event=>{const text=event.results[0]?.transcript;if(text)onText(text);});
  const end=speech.addListener('end',()=>{onEnd();cleanup();});
  const error=speech.addListener('error',()=>{onError('Dictation stopped. Try again or use the keyboard microphone.');onEnd();cleanup();});
  const cleanup=()=>{result.remove();end.remove();error.remove();};
  speech.start({lang:'en-US',interimResults:true,continuous:false,maxAlternatives:1});
  return ()=>{speech.stop();cleanup();onEnd();};
 }catch(error){onEnd();const message=error instanceof Error?error.message:'';throw new Error(message.includes('native module')||message.includes('ExpoSpeechRecognition')?'Tap the keyboard microphone to dictate in Expo Go. The dedicated Dictate button needs a development/production build.':message||'Dictation is unavailable. Use the keyboard microphone or type.');}
}
