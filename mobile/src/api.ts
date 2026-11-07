import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type {AppState,AiStatus,OutfitMatches,OutfitProfile,OutfitReceipt,BottleCandidate} from '../../src/lib/types';
export type {AppState,AiStatus,OutfitMatches,OutfitProfile,OutfitReceipt,BottleCandidate};
const web=Platform.OS==='web';
let base=(process.env.EXPO_PUBLIC_API_URL||(web?window.location.origin:Platform.OS==='android'?'http://10.0.2.2:3000':'http://localhost:3000')).replace(/\/$/,'');
let token:string|null=null;
export async function restoreSession(){if(!web){base=(await SecureStore.getItemAsync('fragout.server'))??base;token=await SecureStore.getItemAsync('fragout.session');}return base;}
export function serverUrl(){return base;}
export function supportsKeys(){const u=new URL(base);return u.protocol==='https:'||['localhost','127.0.0.1','[::1]'].includes(u.hostname);}
export async function setServer(url:string){
 const parsed=new URL(url.trim());if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/')throw new Error('Use a server origin, such as https://your-server.example.');
 if(parsed.protocol==='http:'&&!/^(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(parsed.hostname))throw new Error('Use HTTPS for a remote server. HTTP is only for local development.');
 base=parsed.origin;token=null;if(!web){await SecureStore.deleteItemAsync('fragout.session');await SecureStore.setItemAsync('fragout.server',base);}
}
export async function api<T=unknown>(path:string,method='GET',body?:unknown):Promise<T>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),175000);
 try{const r=await fetch(base+'/api/'+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,credentials:'omit',signal:controller.signal});
  const data=await r.json();if(!r.ok)throw new Error(data.error??'Request failed.');return data as T;
 }catch(error){if(error instanceof Error&&error.message!=='Network request failed'&&error.name!=='AbortError')throw error;throw new Error('Could not reach the server. Check the address in Settings.');}finally{clearTimeout(timer);}
}
export async function signIn(action:'demo'|'login'|'register',fields?:{name?:string;email:string;password:string}){
 const response=await api<AppState&{sessionToken:string}>('auth','POST',{action,client:'mobile',...fields});
 if(!response.sessionToken)throw new Error('Update the FragOut server to enable native sessions.');
 token=response.sessionToken;if(!web)await SecureStore.setItemAsync('fragout.session',token);
 const {sessionToken:_,...state}=response;return state;
}
export async function signOut(){try{await api('auth','POST',{action:'logout',client:'mobile'});}finally{token=null;if(!web)await SecureStore.deleteItemAsync('fragout.session');}}
export async function exportData(){return api<Record<string,unknown>>('export');}
