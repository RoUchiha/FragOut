import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {clearTemporaryPhotos} from './capture';
import type {AppState,AiStatus,OutfitMatches,OutfitProfile,OutfitReceipt,BottleCandidate,SavedLook} from '../../src/lib/types';
export type {AppState,AiStatus,OutfitMatches,OutfitProfile,OutfitReceipt,BottleCandidate,SavedLook};

const web=Platform.OS==='web';
const development=typeof __DEV__!=='undefined'&&__DEV__;
const initial=web&&typeof window!=='undefined'?window.location.origin:process.env.EXPO_PUBLIC_API_URL||(development?(Platform.OS==='android'?'http://10.0.2.2:3000':'http://localhost:3000'):'');
let base=initial.replace(/\/$/,'');
let token:string|null=null;
let generation=0;
let storageQueue:Promise<unknown>=Promise.resolve();
const controllers=new Set<AbortController>();
const SESSION='fragout.session.v2';
type Context={origin:string;generation:number;credential:string|null};
class SessionChangedError extends Error {constructor(){super('Session or server changed. Please try again.');this.name='SessionChangedError';}}

export function validateServerUrl(value:string){
 let parsed:URL;try{parsed=new URL(value.trim());}catch{throw new Error('Enter a valid HTTPS server address.');}
 if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password||parsed.search||parsed.hash||parsed.pathname!=='/')throw new Error('Use a server origin without credentials or a path.');
 const loopback=['localhost','127.0.0.1','[::1]'].includes(parsed.hostname);
 const privateNetwork=/^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(parsed.hostname);
 if(parsed.protocol!=='https:'&&!loopback&&!(development&&privateNetwork))throw new Error('Use HTTPS. Plaintext LAN connections are only available in development builds.');
 return parsed.origin;
}
function current():Context{return {origin:base,generation,credential:token};}
function assertCurrent(context:Context){if(context.generation!==generation||context.origin!==base)throw new SessionChangedError();}
function invalidate(nextOrigin=base){
 generation++;token=null;base=nextOrigin;
 for(const controller of controllers)controller.abort();controllers.clear();
 return current();
}
function persist(context:Context,work:()=>Promise<void>){
 const pending=storageQueue.catch(()=>{}).then(async()=>{assertCurrent(context);await work();assertCurrent(context);});
 storageQueue=pending.catch(()=>{});return pending;
}
async function removeCredential(){if(!web){await SecureStore.deleteItemAsync(SESSION);await SecureStore.deleteItemAsync('fragout.session');}}
export function serverUrl(){return base;}
export function supportsKeys(){try{const u=new URL(base);return u.protocol==='https:'||['localhost','127.0.0.1','[::1]'].includes(u.hostname);}catch{return false;}}
export function sessionScope(){const context=current();return ()=>context.generation===generation&&context.origin===base;}

export async function restoreSession(){
 const context=invalidate();await clearTemporaryPhotos();await storageQueue;assertCurrent(context);
 if(web)return base;
 const [savedOrigin,envelope]=await Promise.all([SecureStore.getItemAsync('fragout.server'),SecureStore.getItemAsync(SESSION)]);assertCurrent(context);
 if(savedOrigin){try{base=validateServerUrl(savedOrigin);}catch{base='';}}
 const bound=current();let restored:string|null=null;
 try{const saved=JSON.parse(envelope??'null');if(saved?.origin===base&&/^[a-f0-9]{64}$/.test(saved?.token??''))restored=saved.token;}catch{/* Ambiguous or corrupt credentials are never adopted. */}
 await persist(bound,async()=>{await SecureStore.deleteItemAsync('fragout.session');if(!restored)await SecureStore.deleteItemAsync(SESSION);});
 assertCurrent(bound);token=restored;return base;
}
export async function setServer(value:string){
 const origin=validateServerUrl(value);
 if(web&&typeof window!=='undefined'&&origin!==window.location.origin)throw new Error('The browser preview stays on its own origin. Open the other server\'s mobile preview directly.');
 const context=invalidate(origin);
 await persist(context,async()=>{await removeCredential();if(!web)await SecureStore.setItemAsync('fragout.server',origin);});await clearTemporaryPhotos();assertCurrent(context);
 return ()=>context.generation===generation&&context.origin===base;
}
async function request<T>(context:Context,path:string,method='GET',body?:unknown):Promise<T>{
 assertCurrent(context);const origin=validateServerUrl(context.origin);
 if(!/^[A-Za-z0-9_/-]+$/.test(path)||path.includes('..')||path.startsWith('/'))throw new Error('Invalid API path.');
 const controller=new AbortController();controllers.add(controller);const timer=setTimeout(()=>controller.abort(),175000);
 try{
  const response=await fetch(origin+'/api/'+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(context.credential?{Authorization:'Bearer '+context.credential}:{})},body:body?JSON.stringify(body):undefined,credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal});
  assertCurrent(context);
  if(response.redirected||(response.url&&new URL(response.url).origin!==origin))throw new Error('Unexpected server redirect. No session was accepted.');
  const data=await response.json();assertCurrent(context);if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Request failed.');return data as T;
 }catch(error){assertCurrent(context);if(error instanceof Error&&error.name!=='AbortError'&&error.message!=='Network request failed')throw error;throw new Error('Could not reach the server. Check the address in Settings.');}
 finally{clearTimeout(timer);controllers.delete(controller);}
}
export async function api<T=unknown>(path:string,method='GET',body?:unknown):Promise<T>{return request<T>(current(),path,method,body);}
export async function signIn(action:'demo'|'login'|'register',fields?:{name?:string;email:string;password:string}){
 const old=current(),context=invalidate();context.credential=old.credential;
 await persist(context,removeCredential);await clearTemporaryPhotos();assertCurrent(context);
 const response=await request<AppState&{sessionToken:string}>(context,'auth','POST',{action,client:'mobile',...fields});
 if(!/^[a-f0-9]{64}$/.test(response.sessionToken??''))throw new Error('The server did not return a valid native session.');
 try{
  await persist(context,async()=>{if(!web)await SecureStore.setItemAsync(SESSION,JSON.stringify({origin:context.origin,token:response.sessionToken}),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});});
  assertCurrent(context);token=response.sessionToken;
 }catch(error){if(context.generation===generation){token=null;try{await persist(context,removeCredential);}catch{/* Persistence error is reported; no credential is active in this process. */}}throw error;}
 const {sessionToken:_,...state}=response;return state;
}
export async function signOut(){
 const previous=current(),context=invalidate();context.credential=previous.credential;
 const remote=previous.credential?request(context,'auth','POST',{action:'logout',client:'mobile'}):Promise.resolve();
 const results=await Promise.allSettled([remote,clearTemporaryPhotos(),persist(context,removeCredential)]);for(const result of results)if(result.status==='rejected')throw result.reason;
}
export async function exportData(){return api<Record<string,unknown>>('export');}
