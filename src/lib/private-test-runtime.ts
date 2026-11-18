import {lstatSync} from 'node:fs';
import {join} from 'node:path';

const operatingSystemSettings=new Set(['path','systemroot','windir','temp','tmp','userprofile','appdata','localappdata','pathext','comspec','processor_architecture','number_of_processors']);
export function privateTestEnvironment(directory:string,inherited:Readonly<Record<string,string|undefined>>){
 // Next reads these files itself. Refuse their presence before loading Next,
 // rather than clearing credentials only to let its loader read them again.
 for(const name of ['.env.production.local','.env.local','.env.production','.env']){
  try{lstatSync(join(directory,name));}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}
  throw new Error('Keep repository environment files outside the private test runtime.');
 }
 return Object.fromEntries(Object.entries(inherited).filter(([key])=>operatingSystemSettings.has(key.toLowerCase())));
}
