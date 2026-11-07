import {Platform} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
export interface Capture {uri:string;data:string;mime:'image/jpeg'}
export async function discardPhoto(photo:Capture|null){
 if(!photo||Platform.OS==='web')return;
 try{const {File,Paths}=await import('expo-file-system');if(photo.uri.startsWith(Paths.cache.uri)){const f=new File(photo.uri);if(f.exists)f.delete();}}catch{/* OS cache cleanup remains available. */}
}
export async function capturePhoto(source:'selfie'|'bottle'|'gallery'):Promise<Capture|null>{
 if(source!=='gallery'){const permission=await ImagePicker.requestCameraPermissionsAsync();if(!permission.granted)throw new Error('Camera access was denied. Choose a photo or type the details instead.');}
 const options:ImagePicker.ImagePickerOptions={mediaTypes:['images'],quality:0.75,exif:false,base64:false,allowsEditing:false};
 const result=source==='gallery'?await ImagePicker.launchImageLibraryAsync(options):await ImagePicker.launchCameraAsync({...options,cameraType:source==='selfie'?ImagePicker.CameraType.front:ImagePicker.CameraType.back});
 if(result.canceled)return null;const asset=result.assets[0];
 let converted:ImageManipulator.ImageResult|undefined;
 try{
  const resize=asset.width>=asset.height?{width:1024}:{height:1024};
  converted=await ImageManipulator.manipulateAsync(asset.uri,Math.max(asset.width,asset.height)>1024?[{resize}]:[],{compress:0.8,format:ImageManipulator.SaveFormat.JPEG,base64:true});
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
