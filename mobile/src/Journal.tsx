import React,{useEffect,useRef,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {ChevronLeft,ChevronRight,Plus} from 'lucide-react-native';
import {api,sessionScope,type AppState} from './api';
import SavedLooks from './SavedLooks';
import {shareWearJournal} from './export-data';
import {intentSummary} from '../../src/lib/intent';
import {calendarCells,dayInZone,shiftMonth} from '../../src/lib/journal';
import type {JournalReply,WearEvent} from '../../src/lib/types';
import {Btn,Choices,Empty,Field,IconButton,SearchBox,Sheet,Spinner,useUi} from './ui';

export default function Journal({state,busy,refresh,notify}:{state:AppState;busy:boolean;refresh:()=>Promise<void>;notify:(message:string)=>void}){
 const {styles,colors}=useUi();
 const today=dayInZone(new Date().toISOString(),state.context.timezone);
 const [view,setView]=useState('log'),[month,setMonth]=useState(today.slice(0,7)),[day,setDay]=useState('');
 const [lookup,setLookup]=useState<{key:string;history:WearEvent[];data?:JournalReply;error?:string}|null>(null),[revision,setRevision]=useState(0),[working,setWorking]=useState(false);
 const [editing,setEditing]=useState<WearEvent|null|undefined>(undefined);
 const key=[month,revision,state.context.timezone,view].join('|'),history=state.history;
 const currentLookup=lookup?.key===key&&lookup.history===history?lookup:null,data=currentLookup?.data,error=currentLookup?.error;
 const active=useRef(true);
 useEffect(()=>{active.current=true;return ()=>{active.current=false;};},[]);
 useEffect(()=>{
  if(view!=='log')return;let mounted=true;const current=sessionScope();
  void api<JournalReply>('journal/'+month).then(data=>{if(mounted&&current())setLookup({key,history,data});}).catch(error=>{if(mounted&&current())setLookup({key,history,error:error.message});});
  return ()=>{mounted=false;};
 },[month,key,history,view]);
 async function remove(id:string){
  if(working||busy)return;const current=sessionScope();setWorking(true);
  try{await api('feedback/'+id,'DELETE');if(current()){await refresh();setRevision(value=>value+1);}}
  catch(error){if(active.current&&current())notify((error as Error).message);}finally{if(active.current&&current())setWorking(false);}
 }
 async function exportCsv(){
  const current=sessionScope();setWorking(true);
  try{await shareWearJournal();}catch(error){if(active.current&&current())notify((error as Error).message);}finally{if(active.current&&current())setWorking(false);}
 }
 const displayed=data?.entries.filter(event=>!day||dayInZone(event.at,data.timezone)===day)??[];
 const feedback=state.history.filter(event=>event.reaction!=='wore');
 return <View style={{gap:14}}>
  <View style={styles.spread}><Text accessibilityRole="header" style={styles.h1}>Journal</Text>
   <Btn label="Log wear" icon={<Plus size={14} color={colors.accentInk}/>} onPress={()=>setEditing(null)} disabled={busy||working}/></View>
  <Choices value={view} items={[[ 'log','Calendar'],['feedback','Feedback'],['looks','Saved looks']]} onChange={setView}/>
  {view==='looks'?<SavedLooks key={String(state.preferences.archiveOutfits)} enabled={state.preferences.archiveOutfits} notify={notify}/>:view==='feedback'?<>
   <Text style={styles.small}>Recent 200 activities · likes and feedback do not count as wears.</Text>
   {!feedback.length&&<Empty title="No feedback yet" detail="Like a pair or rate a recommendation."/>}
   {feedback.map(event=><View key={event.id} style={styles.card}><Text style={styles.small}>{event.reaction==='saved'?'Saved pair':event.reaction==='loved'?'Loved':'Not for me'}</Text>
    <Text style={styles.h3}>{event.names.join(' + ')}</Text><Text style={styles.small}>{new Date(event.at).toLocaleString(undefined,{timeZone:state.context.timezone})}{intentSummary(event.context)?' · '+intentSummary(event.context):''}</Text>
    <Btn label="Remove entry" kind="quiet" disabled={busy||working} onPress={()=>void remove(event.id)}/></View>)}
  </>:<>
   <View style={styles.spread}><IconButton label="Previous month" icon={<ChevronLeft color={colors.link} size={19}/>} disabled={month<='1900-01'} onPress={()=>{setMonth(value=>shiftMonth(value,-1));setDay('');}}/>
    <Text style={styles.h3}>{new Date(month+'-15T12:00:00Z').toLocaleDateString(undefined,{month:'long',year:'numeric',timeZone:'UTC'})}</Text>
    <IconButton label="Next month" icon={<ChevronRight color={colors.link} size={19}/>} disabled={month>=today.slice(0,7)} onPress={()=>{setMonth(value=>shiftMonth(value,1));setDay('');}}/></View>
   {error?<View style={styles.notice}><Text accessibilityRole="alert" style={styles.muted}>{error}</Text><Btn label="Retry" kind="quiet" onPress={()=>setRevision(value=>value+1)}/></View>:!data?<Spinner label="Loading wear journal…"/>:<>
    <View style={{flexDirection:'row',flexWrap:'wrap'}}>
     {['S','M','T','W','T','F','S'].map((label,index)=><View key={'head-'+index} style={{width:'14.2857%',alignItems:'center',paddingBottom:6}}><Text style={styles.label}>{label}</Text></View>)}
     {calendarCells(month).map((date,index)=><View key={date??'blank-'+index} style={{width:'14.2857%',padding:2}}>
      {date&&<Pressable accessibilityRole="button" accessibilityLabel={date+' · '+(data.days[date]??0)+' wears'} accessibilityState={{selected:day===date,disabled:date>today}}
       disabled={date>today} onPress={()=>setDay(value=>value===date?'':date)} style={{minHeight:46,borderRadius:6,alignItems:'center',justifyContent:'center',gap:4,
        borderWidth:1,borderColor:date===today?colors.accentLine:colors.line,backgroundColor:day===date?colors.accent:colors.surface,opacity:date>today?.4:1}}>
       <Text style={styles.text}>{Number(date.slice(-2))}</Text><View style={{width:4,height:4,borderRadius:2,backgroundColor:data.days[date]?colors.link:'transparent'}}/>
      </Pressable>}
     </View>)}
    </View>
    <View style={styles.spread}><Text style={styles.small}>{data.monthWears} wears this month · {data.timezone}</Text>
     {day&&<Btn label="All days" kind="quiet" onPress={()=>setDay('')}/>}</View>
    {day&&<View style={styles.spread}><Text style={styles.h3}>{day}</Text><Btn label="Add for this day" kind="quiet" onPress={()=>setEditing(null)}/></View>}
    {!displayed.length&&<Empty title={day?'No wears this day':'No wears this month'} detail="Log a fragrance or a layer you wore."/>}
    {displayed.map(event=><View key={event.id} style={[styles.card,{gap:6}]}>
     <Text style={styles.small}>{dayInZone(event.at,data.timezone)} · {event.occasion.toLowerCase()}</Text><Text style={styles.h3}>{event.names.join(' + ')}</Text>
     {!!event.note&&<Text style={styles.text}>{event.note}</Text>}
     <View style={styles.row}><Btn label="Edit entry" kind="quiet" disabled={working||busy} onPress={()=>setEditing(event)}/>
      <Btn label="Remove entry" kind="quiet" disabled={working||busy} onPress={()=>void remove(event.id)}/></View>
    </View>)}
    <View style={styles.separator}/><Text style={styles.h3}>All-time wear stats</Text>
    <Text style={styles.text}>{data.totalWears} wears · {data.distinctBottles} fragrances · {data.layeredWears} layers</Text>
    {data.mostWorn.map(item=><View key={item.id} style={styles.spread}><Text style={[styles.text,{flex:1}]}>{item.name}</Text><Text style={styles.small}>{item.count} wears</Text></View>)}
    <Btn label={working?'Exporting…':'Export wear journal · CSV'} kind="quiet" disabled={working||busy} onPress={()=>void exportCsv()}/>
   </>}
  </>}
  {editing!==undefined&&<WearEditor key={editing?.id??day??'new'} state={state} event={editing} initialDate={day||today} onClose={()=>setEditing(undefined)}
   onSaved={event=>{setEditing(undefined);setMonth(dayInZone(event.at,state.context.timezone).slice(0,7));setDay('');setRevision(value=>value+1);void refresh().catch(error=>notify(error.message));notify('Wear saved.');}} notify={notify}/>}
 </View>;
}

function WearEditor({state,event,initialDate,onClose,onSaved,notify}:{state:AppState;event:WearEvent|null;initialDate:string;onClose:()=>void;onSaved:(event:WearEvent)=>void;notify:(message:string)=>void}){
 const {styles,colors}=useUi();
 const [date,setDate]=useState(event?dayInZone(event.at,state.context.timezone):initialDate),[note,setNote]=useState(event?.note??''),[query,setQuery]=useState('');
 const [ids,setIds]=useState<string[]>([]),[busy,setBusy]=useState(false);const saving=useRef(false),active=useRef(true);
 useEffect(()=>{active.current=true;return ()=>{active.current=false;};},[]);
 const bottles=state.bottles.filter(bottle=>bottle.ownership==='OWNED');
 async function save(){
  if(saving.current)return;saving.current=true;setBusy(true);const current=sessionScope();
  try{const saved=await api<WearEvent>(event?'journal/'+event.id:'journal',event?'PATCH':'POST',{date,note,...(!event?{bottleIds:ids}:{})});
   if(active.current&&current())onSaved(saved);
  }catch(error){if(active.current&&current())notify((error as Error).message);}finally{saving.current=false;if(active.current&&current())setBusy(false);}
 }
 return <Sheet title={event?'Edit wear':'Log wear'} onClose={onClose}>
  <Field label="Date · YYYY-MM-DD" value={date} onChangeText={setDate} maxLength={10} autoCapitalize="none"/>
  <Text style={styles.small}>{state.context.timezone} · Date-only logs use local noon.</Text>
  {event?<Text style={styles.h3}>{event.names.join(' + ')}</Text>:<>
   <Text style={styles.text}>{ids.length?bottles.filter(bottle=>ids.includes(bottle.id)).map(bottle=>bottle.name).join(' + '):'Choose one fragrance or two to log a layer.'}</Text>
   <SearchBox label="Search fragrances to log" placeholder="Your owned fragrances" value={query} maxLength={120} onChange={setQuery} onClear={()=>setQuery('')}/>
   {bottles.filter(bottle=>`${bottle.brand} ${bottle.name}`.toLowerCase().includes(query.toLowerCase())).map(bottle=><Pressable key={bottle.id} accessibilityRole="checkbox"
    accessibilityState={{checked:ids.includes(bottle.id),disabled:busy||ids.length===2&&!ids.includes(bottle.id)}} accessibilityLabel={bottle.name+' '+bottle.concentration}
    disabled={busy||ids.length===2&&!ids.includes(bottle.id)} onPress={()=>setIds(current=>current.includes(bottle.id)?current.filter(id=>id!==bottle.id):[...current,bottle.id])}
    style={[styles.spread,{minHeight:48,borderBottomWidth:1,borderBottomColor:colors.line}]}>
    <View style={{flex:1}}><Text style={styles.text}>{bottle.name}</Text><Text style={styles.small}>{bottle.brand} · {bottle.concentration}</Text></View>
    <Text style={styles.link}>{ids.includes(bottle.id)?'✓':'+'}</Text>
   </Pressable>)}
   {!bottles.length&&<Text style={styles.muted}>Add an owned fragrance first.</Text>}
  </>}
  <Field label="Private wear note" value={note} onChangeText={setNote} multiline maxLength={2000} placeholder="How it wore, reactions, spray order…"/>
  <Btn label={busy?'Saving…':'Save wear'} disabled={busy||(!event&&!ids.length)||!/^\d{4}-\d{2}-\d{2}$/.test(date)} onPress={()=>void save()}/>
 </Sheet>;
}
