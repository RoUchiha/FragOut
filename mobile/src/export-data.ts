import {Platform} from 'react-native';
import {File,Paths} from 'expo-file-system';
import {exportData,sessionScope} from './api';
let operation=0;
export async function shareAccountExport(){
 const stillCurrent=sessionScope();
 const check=()=>{if(!stillCurrent())throw new Error('Account or server changed. Export again from your current account.');};
 const data=JSON.stringify(await exportData(),null,2);check();
 if(Platform.OS==='web'){
  const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
  const link=document.createElement('a');
  try{
   check();
   link.href=url;
   link.download='fragout-export.json';
   link.hidden=true;
   document.body.append(link);
   link.click();
   // The browser reads the blob asynchronously after dispatching the click.
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(error){
   URL.revokeObjectURL(url);
   throw error;
  }finally{link.remove();}
  return;
 }
 const {isAvailableAsync,shareAsync}=await import('expo-sharing');check();
 const available=await isAvailableAsync();check();
 if(!available)throw new Error('Sharing is unavailable on this device. Export through the companion web app.');
 const file=new File(Paths.cache,`fragout-export-${Date.now()}-${++operation}.json`);
 try{check();await file.write(data);check();await shareAsync(file.uri,{mimeType:'application/json',dialogTitle:'Export FragOut data',UTI:'public.json'});check();}
 finally{if(file.exists)file.delete();}
}
