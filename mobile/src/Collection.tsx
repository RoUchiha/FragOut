import React,{useEffect,useRef,useState} from 'react';
import {Pressable,Switch,Text,View} from 'react-native';
import {Camera,Heart,Plus} from 'lucide-react-native';
import {api,sessionScope,type AiStatus,type AppState,type BottleCandidate} from './api';
import {capturePhoto,discardPhoto,type Capture} from './capture';
import {BottleArt,Btn,Choices,Empty,Field,IconButton,SearchBox,Sheet,Spinner,useUi} from './ui';
import {matchesBottleSearch,scentSearchLimit} from '../../src/lib/scent-search';
import type {Bottle} from '../../src/lib/types';

export default function Collection({state,refresh,notify}:{
 state:AppState; refresh:()=>Promise<void>; notify:(message:string)=>void;
}) {
 const {styles,colors} = useUi();
 const [query,setQuery] = useState('');
 const [filter,setFilter] = useState('OWNED');
 const [editing,setEditing] = useState<Bottle|null|undefined>(undefined);
 const [candidate,setCandidate] = useState<BottleCandidate|null>(null);
 const [candidates,setCandidates] = useState<BottleCandidate[]|null>(null);
 const [busy,setBusy] = useState(false);
 const [status,setStatus] = useState<AiStatus|null>(null);
 const active = useRef(true);

 useEffect(()=>{
  active.current=true;
  void api<AiStatus>('ai/status').then(value=>{if(active.current)setStatus(value);})
   .catch(error=>{if(active.current)notify(error.message);});
  return ()=>{active.current=false;};
 },[notify]);

 const ownedCount = state.bottles.filter(bottle=>bottle.ownership==='OWNED').length;
 const visible = state.bottles.filter(bottle=>(filter==='ALL'||bottle.ownership===filter)&&matchesBottleSearch(bottle,query));
 const openForm = (bottle:Bottle|null) => {setCandidate(null);setEditing(bottle);};

 async function scan() {
  const provider = status?.selected;
  if (!provider||busy) return;
  const stillCurrent = sessionScope();
  setBusy(true);
  let photo:Capture|null = null;
  try {
   photo=await capturePhoto('bottle');
   if (!photo||!active.current||!stillCurrent()) return;
   const reply=await api<{candidates:BottleCandidate[];message:string}>('vision/bottle','POST',{
    provider,image:{data:photo.data,mime:photo.mime},
   });
   await discardPhoto(photo);
   photo=null;
   if (!active.current||!stillCurrent()) return;
   setCandidates(reply.candidates);
   if (!reply.candidates.length) notify(reply.message||'No readable label. Try again or enter details manually.');
  } catch (error) {
   if (active.current&&stillCurrent()) notify((error as Error).message);
  } finally {
   try {
    await discardPhoto(photo);
   } catch (error) {
    if (active.current&&stillCurrent()) notify((error as Error).message);
   }
   if (active.current&&stillCurrent()) setBusy(false);
  }
 }

 async function favorite(bottle:Bottle) {
  try {
   await api('bottles/'+bottle.id,'PATCH',{favorite:!bottle.favorite});
   await refresh();
  } catch (error) {
   if (active.current) notify((error as Error).message);
  }
 }

 return <View style={{gap:13}}>
  <View style={styles.spread}>
   <View>
    <Text accessibilityRole="header" style={styles.h1}>Collection</Text>
    <Text style={styles.small}>{ownedCount} owned</Text>
   </View>
   <View style={[styles.row,{gap:4}]}>
    <IconButton label="Scan bottle" icon={<Camera size={18} color={colors.link}/>}
     disabled={busy||!status} onPress={()=>void scan()}/>
    <Btn label="Add" icon={<Plus size={15} color={colors.accentInk}/>} onPress={()=>openForm(null)}/>
   </View>
  </View>
  {status&&status.selected!=='qwen'&&<Text style={styles.small}>
   {status.selected==='openai'?'OpenAI':'Claude'} processes scans using your API key.
  </Text>}
  <SearchBox label="Search collection" placeholder="Name, brand, or note" value={query}
   onChange={setQuery} onClear={()=>setQuery('')} maxLength={scentSearchLimit}/>
  <Choices value={filter} items={[[ 'OWNED','Owned'],['WISHLIST','Wishlist'],['REMOVED','Not owned'],['ALL','All']]}
   onChange={setFilter}/>
  {busy&&<Spinner label="Reading bottle label…"/>}
  {visible.length ? <View style={styles.grid}>
   {visible.map(bottle=><View key={bottle.id} style={styles.tile}>
    <View style={[styles.bottleStage,{backgroundColor:bottle.color+'28'}]}>
     <Pressable accessibilityRole="button" accessibilityLabel={'Edit '+bottle.name}
      onPress={()=>openForm(bottle)} style={{width:'100%',height:'100%',alignItems:'center',justifyContent:'center'}}>
      <BottleArt bottle={bottle} size={114}/>
     </Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel={(bottle.favorite?'Unfavorite ':'Favorite ')+bottle.name}
      accessibilityState={{selected:bottle.favorite}} onPress={()=>void favorite(bottle)}
      style={{position:'absolute',right:4,top:4,padding:9}}>
      <Heart size={17} color={colors.link} fill={bottle.favorite?colors.link:'transparent'}/>
     </Pressable>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={'Details for '+bottle.name}
     onPress={()=>openForm(bottle)} style={{paddingVertical:7,gap:2}}>
     <Text style={styles.h3} numberOfLines={2}>{bottle.name}</Text>
     <Text style={styles.small} numberOfLines={1}>{bottle.brand} · {bottle.concentration}</Text>
     <Text style={styles.small} numberOfLines={1}>{bottle.family||'Profile unknown'}</Text>
    </Pressable>
   </View>)}
  </View> : <Empty title={query.trim()?'No matches':'No bottles here'}
   detail={query.trim()?'Try a different name, brand, or note.':'Add a fragrance by name or scan the label.'}/>}

  {candidates!==null&&<Sheet title="Confirm the label" onClose={()=>setCandidates(null)}>
   <Text style={styles.muted}>Check the exact bottle before adding. The scan photo has already been deleted.</Text>
   {candidates.map((item,index)=><View key={index} style={styles.card}>
    <Text style={styles.h3}>{item.brand} {item.name}</Text>
    <Text style={styles.small}>{item.concentration} · {item.confidence==='likely'?'Likely match':'Uncertain'}</Text>
    <Text style={styles.muted}>{item.clue}</Text>
    <Btn label="Use these details" onPress={()=>{setCandidate(item);setEditing(null);setCandidates(null);}}/>
   </View>)}
   {!candidates.length&&<Empty title="Label not clear" detail="Retake a front-facing photo or enter the name."/>}
   <Btn label="Enter manually" kind="secondary" onPress={()=>{setCandidates(null);openForm(null);}}/>
  </Sheet>}
  {editing!==undefined&&<BottleForm key={editing?.id??candidate?.name??'new'} bottle={editing??undefined}
   candidate={candidate} onClose={()=>setEditing(undefined)} refresh={refresh} notify={notify}/>}
 </View>;
}

function BottleForm({bottle,candidate,onClose,refresh,notify}:{bottle?:Bottle;candidate:BottleCandidate|null;onClose:()=>void;refresh:()=>Promise<void>;notify:(s:string)=>void}){
 const {styles} = useUi();
 const [name,setName]=useState(bottle?.name??candidate?.name??''),[brand,setBrand]=useState(bottle?.brand??candidate?.brand??''),[concentration,setConc]=useState(bottle?.concentration??candidate?.concentration??'UNKNOWN'),[ownership,setOwnership]=useState(bottle?.ownership??'OWNED'),[known,setKnown]=useState(bottle?.profileKnown??false),[family,setFamily]=useState(bottle?.family??''),[notes,setNotes]=useState(bottle?.notes.join(', ')??''),[strength,setStrength]=useState(String(bottle?.strength??1)),[climate,setClimate]=useState(bottle?.climate??'UNKNOWN'),[memo,setMemo]=useState(bottle?.memo??''),[busy,setBusy]=useState(false),[deleteConfirm,setDeleteConfirm]=useState(false),[verified,setVerified]=useState(!candidate);
 const changed=!!bottle&&[name,brand,concentration].map(s=>s.trim().toLowerCase()).join('|')!==[bottle.name,bottle.brand,bottle.concentration].map(s=>s.trim().toLowerCase()).join('|');
 async function save(){setBusy(true);try{await api(bottle?'bottles/'+bottle.id:'bottles',bottle?'PATCH':'POST',{name:name.trim(),brand:brand.trim(),concentration,ownership,family,notes:notes.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean),strength:Number(strength),climate,profileKnown:known&&!changed,provenance:known&&!changed?'personal':'unknown',color:bottle?.color??'#b8c986',shape:bottle?.shape??'square',sizeMl:bottle?.sizeMl??100,fillPct:bottle?.fillPct??100,rating:bottle?.rating??0,favorite:bottle?.favorite??false,memo});await refresh();notify('Saved.');onClose();}catch(e){notify((e as Error).message);}finally{setBusy(false);}}
 async function remove(){if(!bottle)return;setBusy(true);try{await api('bottles/'+bottle.id,'DELETE');await refresh();notify('Bottle removed.');onClose();}catch(e){notify((e as Error).message);}finally{setBusy(false);}}
 return <Sheet title={bottle?'Edit fragrance':'Add fragrance'} onClose={onClose}><Field label="Brand / house" value={brand} onChangeText={v=>{setBrand(v);if(candidate)setVerified(false);}} maxLength={120}/><Field label="Exact fragrance name" value={name} onChangeText={v=>{setName(v);if(candidate)setVerified(false);}} maxLength={120}/><Choices label="Concentration" value={concentration} items={[["UNKNOWN","Unknown"],["EDT","EDT"],["EDP","EDP"],["PARFUM","Parfum"],["ELIXIR","Elixir"],["OIL","Oil"],["OTHER","Other"]]} onChange={v=>{setConc(v);if(candidate)setVerified(false);}}/><Choices label="Status" value={ownership} items={[["OWNED","Owned"],["WISHLIST","Wishlist"],["REMOVED","Not owned"]]} onChange={setOwnership}/>{changed&&<View style={styles.warm}><Text style={styles.small}>Identity changed. Saving clears the previous scent profile.</Text></View>}<View style={styles.spread}><Text style={[styles.text,{flex:1}]}>Use my scent observations</Text><Switch accessibilityLabel="Use my scent observations" disabled={changed} value={known&&!changed} onValueChange={setKnown}/></View>{known&&!changed&&<><Field label="Scent family" value={family} onChangeText={setFamily} maxLength={60}/><Field label="Notes I perceive" value={notes} onChangeText={setNotes} placeholder="cedar, musk, bergamot"/><Choices label="Projection" value={strength} items={[["1","Light"],["2","Moderate"],["3","Strong"]]} onChange={setStrength}/><Choices label="Character" value={climate} items={[["UNKNOWN","Unknown"],["FRESH","Fresh"],["BALANCED","Balanced"],["WARM","Warm"]]} onChange={setClimate}/></>}<Field label="Private notes" multiline maxLength={2000} value={memo} onChangeText={setMemo}/><Text style={styles.small}>{candidate?'Confirmed label suggestion. Scent traits stay unknown until you enter your own observations.':'Unknown scent profiles stay out of recommendations.'}</Text>{candidate&&<View style={styles.spread}><Text style={[styles.text,{flex:1}]}>I checked the exact fragrance and concentration</Text><Switch accessibilityLabel="Confirm accurate fragrance label" value={verified} onValueChange={setVerified}/></View>}<Btn label={busy?'Saving…':'Save fragrance'} disabled={busy||!name.trim()||!brand.trim()||!verified} onPress={()=>void save()}/>{bottle&&(deleteConfirm?<View style={styles.warm}><Text style={styles.small}>Remove this bottle from your collection? Existing wear logs remain.</Text><View style={styles.row}><Btn label="Remove bottle" kind="danger" disabled={busy} onPress={()=>void remove()}/><Btn label="Cancel" kind="quiet" onPress={()=>setDeleteConfirm(false)}/></View></View>:<Btn label="Remove bottle" kind="quiet" onPress={()=>setDeleteConfirm(true)}/>)}</Sheet>;
}
