import React,{useEffect,useRef,useState} from 'react';
import {Image,Pressable,Text,View} from 'react-native';
import {openBrowserAsync} from 'expo-web-browser';
import {ChevronRight,ImageOff} from 'lucide-react-native';
import {isCatalogPhotoPath} from '../../src/lib/catalog-photos';
import {concentrationOptions} from '../../src/lib/concentrations';
import {scentSearchLimit} from '../../src/lib/scent-search';
import type {CatalogAdminEntry} from '../../src/lib/types';
import {api,serverUrl,sessionScope} from './api';
import {capturePhoto,discardPhoto,type Capture} from './capture';
import FragDexLink from './FragDexLink';
import {Btn,Empty,SearchBox,Sheet,Spinner,useUi} from './ui';

const photoStatuses:Record<CatalogAdminEntry['status'],string>={
 bundled:'Catalog default',automatic:'Automatically found',override:'Manual replacement',hidden:'Hidden',missing:'Missing photo',
};
const updates={
 replace:'Shared photo updated.',hide:'Shared photo hidden.',reset:'Catalog defaults restored.',retry:'Photo lookup refreshed.',
};
type PhotoAction=keyof typeof updates;

function edition(entry:CatalogAdminEntry){
 const format=concentrationOptions.find(([code])=>code===entry.concentration)?.[1]??entry.concentration;
 return entry.releaseYear===undefined?format:`${format} · ${entry.releaseYear}`;
}

export default function FragDexAdmin({onClose,onUpdated}:{onClose:()=>void;onUpdated?:()=>Promise<void>}){
 const {styles,colors}=useUi();
 const [stillCurrent]=useState(()=>sessionScope());
 const active=useRef(false);
 const running=useRef(false);
 const [query,setQuery]=useState('');
 const [searched,setSearched]=useState('');
 const [entries,setEntries]=useState<CatalogAdminEntry[]|null>(null);
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [busy,setBusy]=useState('');
 const [message,setMessage]=useState<{text:string;error:boolean}|null>(null);
 const selected=entries?.find(entry=>entry.id===selectedId);

 useEffect(()=>{
  active.current=true;
  return ()=>{active.current=false;};
 },[]);

 function current(){return active.current&&stillCurrent();}
 function close(){active.current=false;onClose();}

 async function run(label:string,work:()=>Promise<void>){
  if(running.current||!current())return;
  running.current=true;
  setBusy(label);
  setMessage(null);
  try{await work();}
  catch(error){
   if(current())setMessage({text:error instanceof Error?error.message:'FragDex could not finish the request.',error:true});
  }finally{
   running.current=false;
   if(current())setBusy('');
  }
 }

 function search(q:string){
  void run('Searching FragDex…',async()=>{
   setSearched(q);
   setEntries(null);
   const result=await api<{entries:CatalogAdminEntry[]}>('catalog-admin/search','POST',{q});
   if(current())setEntries(result.entries);
  });
 }

 function update(id:string,action:PhotoAction){
  void run(action==='retry'?'Looking for a photo…':'Updating photo…',async()=>{
   let photo:Capture|null=null;
   try{
    if(action==='replace'){
     photo=await capturePhoto('gallery');
     if(!photo||!current())return;
    }
    const {entry}=await api<{entry:CatalogAdminEntry}>('catalog-admin/photo','PUT',{
     id,action,...(photo?{image:{mime:photo.mime,data:photo.data}}:{}),
    });
    if(current()){
     setEntries(previous=>previous?.map(item=>item.id===id?entry:item)??null);
     setMessage({text:updates[action],error:false});
    }
   }finally{
    await discardPhoto(photo);
   }
   // Keep collection refreshes in update order and preserve the successful catalog result.
   if(current())await onUpdated?.().catch(()=>{});
  });
 }

 function visit(url:string){
  void openBrowserAsync(url).catch(()=>{
   if(current())setMessage({text:'Could not open the photo source.',error:true});
  });
 }

 const feedback=message&&<View style={styles.notice}>
  <Text accessibilityRole={message.error?'alert':undefined} accessibilityLiveRegion="polite" style={styles.text}>{message.text}</Text>
  {message.error&&!selected&&<Btn label="Retry search" kind="quiet" onPress={()=>search(searched)} style={{alignSelf:'flex-start'}}/>}
 </View>;

 return <Sheet title="FragDex photos" onClose={close}>
  {selected?<>
   <Btn label="Back to results" kind="quiet" disabled={!!busy} style={{alignSelf:'flex-start'}}
    onPress={()=>{setSelectedId(null);setMessage(null);}}/>
   <View style={{gap:3}}>
    <Text style={styles.small}>{selected.brand}</Text>
    <Text accessibilityRole="header" style={styles.h3}>{selected.name}</Text>
    <Text style={styles.text}>{edition(selected)} · {photoStatuses[selected.status]}</Text>
   </View>
   <PhotoPreview key={selected.photoPath??selected.status} entry={selected}/>
   {selected.source&&<FragDexLink url={selected.source.url} visit={visit} style={{alignSelf:'flex-start',minHeight:32,justifyContent:'center'}}>
    <Text style={styles.link}>Photo source · {selected.source.publisher}</Text>
   </FragDexLink>}
   <Text style={styles.small}>Choosing a photo publishes it to the shared FragDex catalog.</Text>
   <Btn label="Upload photo" disabled={!!busy} onPress={()=>update(selected.id,'replace')}/>
   <View style={[styles.row,{flexWrap:'wrap'}]}>
    {selected.photoPath&&<Btn label="Hide shared photo" kind="secondary" disabled={!!busy} onPress={()=>update(selected.id,'hide')}/>}
    {(selected.status==='hidden'||selected.status==='override')&&
     <Btn label="Restore default" kind="secondary" disabled={!!busy} onPress={()=>update(selected.id,'reset')}/>}
    {(selected.status==='automatic'||selected.status==='missing')&&
     <Btn label="Retry automatic lookup" kind="secondary" disabled={!!busy} onPress={()=>update(selected.id,'retry')}/>}
   </View>
   {busy&&<Spinner label={busy}/>}
   {feedback}
  </>:<>
   <Text style={styles.muted}>Find the exact fragrance edition to review or change its shared bottle photo.</Text>
   <SearchBox label="Search FragDex" placeholder="Brand, fragrance, or concentration" value={query}
    onChange={setQuery} onClear={()=>setQuery('')} onSubmit={query.trim()&&!busy?()=>search(query.trim()):undefined} maxLength={scentSearchLimit}/>
   <Btn label="Recent photo lookups" kind="secondary" disabled={!!busy} onPress={()=>{setQuery('');search('');}} style={{alignSelf:'flex-start'}}/>
   {busy&&<Spinner label={busy}/>}
   {feedback}
   {entries?.length===0&&<Empty title={searched?'No matching editions':'No recent photo lookups'} detail="Try searching by fragrance name or brand."/>}
   {!!entries?.length&&<Text style={styles.small}>{searched?
    `${entries.length===40?'First 40 matches':'Matches'} for “${searched}”`:'Recent photo lookups and catalog defaults'}
   </Text>}
   {entries?.map(entry=><Pressable key={entry.id} accessibilityRole="button"
    accessibilityLabel={`${entry.brand} ${entry.name}, ${edition(entry)}`} accessibilityHint={photoStatuses[entry.status]}
    onPress={()=>{setSelectedId(entry.id);setMessage(null);}}
    style={({pressed})=>[styles.card,styles.spread,{padding:12},pressed&&{opacity:.72}]}>
    <View style={{flex:1,minWidth:0,gap:3}}>
     <Text style={styles.small}>{entry.brand}</Text>
     <Text style={styles.h3}>{entry.name}</Text>
     <Text style={styles.small}>{edition(entry)} · {photoStatuses[entry.status]}</Text>
    </View>
    <ChevronRight size={17} color={colors.link}/>
   </Pressable>)}
  </>}
 </Sheet>;
}

function PhotoPreview({entry}:{entry:CatalogAdminEntry}){
 const {styles,colors}=useUi();
 const [failed,setFailed]=useState(false);
 if(isCatalogPhotoPath(entry.photoPath)&&!failed){
  return <Image accessible accessibilityLabel={'Current bottle photo for '+entry.name}
   source={{uri:serverUrl()+entry.photoPath}} resizeMode="contain" style={styles.image} onError={()=>setFailed(true)}/>;
 }
 return <View style={styles.empty}>
  <ImageOff size={19} color={colors.muted}/>
  <Text style={styles.muted}>{entry.status==='hidden'?'Shared photo is hidden.':failed?'Photo preview unavailable.':'No shared photo.'}</Text>
 </View>;
}
