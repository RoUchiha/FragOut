import {Platform} from 'react-native';
import {File,Paths} from 'expo-file-system';
import {api,exportData,sessionScope} from './api';
let operation=0;
export async function shareAccountExport(){
 const stillCurrent=sessionScope();
 const check=()=>{if(!stillCurrent())throw new Error('Account or server changed. Export again from your current account.');};
 const data=JSON.stringify(await exportData(),null,2);check();
 return shareText(data,'fragout-export.json','application/json','public.json',check);
}
export async function shareWearJournal(){
 const stillCurrent=sessionScope();
 const check=()=>{if(!stillCurrent())throw new Error('Account or server changed. Export again from your current account.');};
 const {csv}=await api<{csv:string}>('journal/export');check();
 return shareText(csv,'fragout-wear-journal.csv','text/csv','public.comma-separated-values-text',check);
}
async function shareText(data:string,filename:string,mimeType:string,uti:string,check:()=>void){
 if(Platform.OS==='web'){
  const url=URL.createObjectURL(new Blob([data],{type:mimeType}));
  const link=document.createElement('a');
  try{
   check();
   link.href=url;
   link.download=filename;
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
 const file=new File(Paths.cache,`fragout-${Date.now()}-${++operation}-${filename}`);
 try{check();await file.write(data);check();await shareAsync(file.uri,{mimeType,dialogTitle:'Export FragOut data',UTI:uti});check();}
 finally{if(file.exists)file.delete();}
}
