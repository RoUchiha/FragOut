import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Image,Text,View} from 'react-native';
import {api,type SavedLook} from './api';
import {intentSummary} from '../../src/lib/intent';
import {BottleArt,Btn,Empty,Sheet,Spinner,styles} from './ui';

export default function SavedLooks({enabled,notify}:{enabled:boolean;notify:(message:string)=>void}){
 const [looks,setLooks]=useState<SavedLook[]>([]),[selected,setSelected]=useState<SavedLook|null>(null),[photo,setPhoto]=useState<string|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[confirmDelete,setConfirmDelete]=useState(false);
 const active=useRef(true),selection=useRef<string|null>(null);
 const load=useCallback(async()=>{const data=await api<SavedLook[]>('looks');if(active.current)setLooks(data);},[]);
 useEffect(()=>{active.current=true;if(enabled)void load().catch(e=>notify(e.message)).finally(()=>{if(active.current)setLoading(false);});return()=>{active.current=false;selection.current=null;};},[enabled,load,notify]);
 function close(){selection.current=null;setSelected(null);setPhoto(null);setConfirmDelete(false);}
 async function open(look:SavedLook){
  selection.current=look.id;setSelected(look);setPhoto(null);setConfirmDelete(false);
  if(!look.photoAvailable)return;
  setBusy(true);try{const image=await api<{mime:'image/jpeg';data:string}>('looks/'+look.id+'/photo');if(active.current&&selection.current===look.id)setPhoto('data:image/jpeg;base64,'+image.data);}
  catch(error){if(active.current&&selection.current===look.id)notify((error as Error).message);}finally{if(active.current)setBusy(false);}
 }
 async function remove(){if(!selected)return;setBusy(true);try{await api('looks/'+selected.id,'DELETE');if(!active.current)return;close();await load();notify('Look and photo deleted.');}catch(error){if(active.current)notify((error as Error).message);}finally{if(active.current)setBusy(false);}}
 if(!enabled)return <Empty title="Outfit archive is off" detail="Photos are deleted by default. Enable archiving in Settings to save private looks."/>;
 if(loading)return <Spinner label="Opening saved looks..."/>;
 return <View style={{gap:12}}>{looks.length?looks.map(look=><View key={look.id} style={styles.card}><Text style={styles.h3}>{look.bottles.map(b=>b.name).join(' + ')}</Text><Text style={styles.muted}>{look.profile.summary}</Text><Text style={styles.small}>{look.context.occasion} · {new Date(look.createdAt).toLocaleDateString()} · {look.photoAvailable?'Private photo':'No photo'}</Text><Btn label="View look" kind="secondary" onPress={()=>void open(look)}/></View>):<Empty title="No saved looks" detail="Review an outfit, find a fragrance or pair, then choose Archive look."/>}
 {selected&&<Sheet title="Saved look" onClose={close}>{photo?<Image accessibilityLabel="Your privately archived outfit" source={{uri:photo}} style={[styles.image,{height:300}]} resizeMode="contain"/>:busy?<Spinner label="Opening private photo..."/>:<Text style={styles.small}>No photo retained.</Text>}<Text style={styles.text}>{selected.profile.summary}</Text><View style={[styles.row,{justifyContent:'center'}]}>{selected.bottles.map(b=><View key={b.id} style={{alignItems:'center',flex:1}}><BottleArt bottle={b} size={110}/><Text style={styles.text}>{b.name}</Text><Text style={styles.small}>{b.brand} · {b.concentration}</Text></View>)}</View><Text style={styles.small}>{selected.context.occasion}{intentSummary(selected.context)?' · '+intentSummary(selected.context):''} · Private to your account</Text>{confirmDelete?<><Text style={styles.muted}>Delete this look and its photo permanently?</Text><Btn label="Delete permanently" kind="danger" disabled={busy} onPress={()=>void remove()}/><Btn label="Keep look" kind="quiet" onPress={()=>setConfirmDelete(false)}/></>:<Btn label="Delete look and photo" kind="quiet" onPress={()=>setConfirmDelete(true)}/>}</Sheet>}
 </View>;
}
