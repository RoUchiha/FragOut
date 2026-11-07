import React,{useCallback,useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,Text,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {router,useLocalSearchParams} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {BookOpen,Camera,Grid2X2,Home,Layers,Settings2,X} from 'lucide-react-native';
import {api,restoreSession,serverUrl,setServer,signIn,type AppState} from './src/api';
import {BottleArt,Btn,Choices,Empty,Field,Section,Sheet,Spinner,styles,colors} from './src/ui';
import Outfit from './src/Outfit';
import Collection from './src/Collection';
import Journal from './src/Journal';
import Settings from './src/Settings';
import {Results,type Feedback} from './src/Results';
import {rankSolo} from '../src/lib/engine';
import type {ComboResult,SoloResult,WearContext} from '../src/lib/types';
type Tab='today'|'outfit'|'collection'|'journal'|'settings';
const tabs=[['today','Today',Home],['outfit','Outfit',Camera],['collection','Collection',Grid2X2],['journal','Journal',BookOpen],['settings','Settings',Settings2]] as const;
type SoloSheet={kind:'solo';solo:SoloResult[];requestId:string;context:WearContext};
export default function App(){return <SafeAreaProvider><Workspace/></SafeAreaProvider>;}
function Workspace(){
 const params=useLocalSearchParams<{view?:string}>();
 const tab:Tab=tabs.some(([id])=>id===params.view)?params.view as Tab:'today';
 const setTab=useCallback((view:Tab)=>router.setParams({view}),[]);
 const [state,setState]=useState<AppState|null>(null),[loading,setLoading]=useState(true),[toast,setToast]=useState(''),[error,setError]=useState(''),[address,setAddress]=useState(serverUrl()),[sheet,setSheet]=useState<SoloSheet|{kind:'combo'}|null>(null),[busy,setBusy]=useState(false),[autoCamera,setAutoCamera]=useState(false);
 const userId=useRef<string|null>(null);
 const notify=useCallback((s:string)=>setToast(s),[]);
 function onSession(s:AppState|null){userId.current=s?.user.id??null;setState(s);setError(s?'':'Signed out. Reconnect to continue.');setTab('today');setSheet(null);setToast('');setAutoCamera(false);}
 async function initialize(){setLoading(true);setError('');try{setAddress(await restoreSession());let s:AppState;try{s=await api<AppState>('state');}catch{s=await signIn('demo');}onSession(s);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{void initialize();},[]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),6000);return()=>clearTimeout(timer);},[toast]);
 const refresh=useCallback(async()=>{const s=await api<AppState>('state');setState(old=>old?.user.id===s.user.id?s:old);},[]);
 async function recommend(occasion='GENERAL',shortcutId?:string){setBusy(true);const id=userId.current;try{const r=await api<{solo:SoloResult[];requestId:string;context:WearContext}>('recommend','POST',{occasion,mode:'solo',shortcutId});if(userId.current===id)setSheet({kind:'solo',...r});}catch(e){notify((e as Error).message);}finally{setBusy(false);}}
 const feedback:Feedback=async(ids,reaction,occasion,requestId)=>{setBusy(true);try{await api('feedback','POST',{bottleIds:ids,reaction,occasion,requestId});await refresh();notify(reaction==='saved'?'Pair saved.':reaction==='disliked'?'Feedback saved.':'Logged.');}catch(e){notify((e as Error).message);}finally{setBusy(false);}};
 if(loading)return <SafeAreaView style={styles.screen}><Spinner label="Opening FragOut…"/></SafeAreaView>;
 if(!state)return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={[styles.content,{paddingTop:55}]}><Text style={styles.h1}>Connect FragOut</Text><Text style={styles.muted}>{toast||error||'Enter your server address.'}</Text><Field label="Server URL" value={address} onChangeText={setAddress} autoCapitalize="none" autoCorrect={false}/><Text style={styles.small}>Use an HTTPS FragOut server you control. Local development also supports your computer’s private address.</Text><Btn label="Connect" onPress={()=>{void setServer(address).then(initialize).catch(e=>setError(e.message));}}/><Btn label="Retry" kind="quiet" onPress={()=>void initialize()}/></ScrollView></SafeAreaView>;
 const owned=state.bottles.filter(b=>b.ownership==='OWNED'),pick=rankSolo(state.bottles,state.context,state.preferences)[0];
 return <SafeAreaView style={styles.screen} edges={['top','bottom']}><StatusBar style="dark"/><View style={styles.topbar}><Text style={styles.brand}>FragOut.</Text><Pressable accessibilityRole="button" accessibilityLabel="Open pairing" hitSlop={12} onPress={()=>setSheet({kind:'combo'})}><Layers size={21} color={colors.muted}/></Pressable></View>{state.user.demo&&<View style={styles.demo}><Text style={styles.small}>Demo · fictional fragrances</Text><Pressable accessibilityRole="button" onPress={()=>setTab('settings')}><Text style={styles.small}>Your account →</Text></Pressable></View>}
 {toast&&<View style={styles.toast}><Text accessibilityRole="alert" style={styles.toastText}>{toast}</Text><Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={()=>setToast('')} hitSlop={8}><X size={17} color="#d8e5c5"/></Pressable></View>}
 <ScrollView key={state.user.id+tab} style={{flex:1}} contentContainerStyle={[styles.content,{width:'100%',maxWidth:620,alignSelf:'center'}]} keyboardShouldPersistTaps="handled">
 {tab==='today'&&<><View style={styles.spread}><Text accessibilityRole="header" style={styles.h1}>Today</Text><Text style={styles.small}>{owned.length} owned · {Math.round(state.preferences.units==='F'?state.context.tempC*9/5+32:state.context.tempC)}°{state.preferences.units} · Manual</Text></View><View style={[styles.card,{backgroundColor:'#edf2e4'}]}>{pick?<><View style={styles.row}><View style={{flex:1,gap:6}}><Text style={styles.small}>Today’s pick · {pick.bottle.provenance==='demo'?'Demo profile':'Your profile'}</Text><Text style={styles.h1}>{pick.bottle.name}</Text><Text style={styles.small}>{pick.bottle.brand} · {pick.bottle.concentration}</Text><Text style={styles.muted}>{pick.bottle.family}</Text></View><BottleArt bottle={pick.bottle} size={132}/></View><View style={styles.row}><Btn label="Wear this" disabled={busy} onPress={()=>feedback([pick.bottle.id],'wore','GENERAL')}/><Btn label="See picks" kind="quiet" disabled={busy} onPress={()=>void recommend()}/></View></>:<Empty title={state.context.policy==='NO_FRAGRANCE'?'No fragrance advised':owned.length?'No eligible scent profile':'No bottles yet'} detail={state.context.policy==='NO_FRAGRANCE'?'This venue is fragrance-free.':'Add owned bottles and personal scent profiles.'}/>}</View><View style={styles.row}><Btn label="Match outfit" icon={<Camera size={16} color={colors.dark}/>} onPress={()=>{setAutoCamera(false);setTab('outfit');}} style={{flex:1}}/><Btn label="Take selfie" kind="secondary" onPress={()=>{setAutoCamera(true);setTab('outfit');}} style={{flex:1}}/></View><Section title="Occasions"/><View style={[styles.row,{flexWrap:'wrap',gap:8}]}>{state.shortcuts.filter(s=>!s.hidden).map(s=><Btn key={s.id} label={s.title} kind="secondary" disabled={busy} onPress={()=>void recommend(s.occasion,s.id)}/>)}</View><Section title="Collection" action="View all" onAction={()=>setTab('collection')}/><View style={styles.grid}>{owned.slice(0,4).map(b=><Pressable key={b.id} accessibilityRole="button" accessibilityLabel={'View '+b.name} onPress={()=>setTab('collection')} style={styles.tile}><View style={[styles.bottleStage,{backgroundColor:b.color+'26'}]}><BottleArt bottle={b} size={130}/></View><Text style={[styles.h3,{marginTop:8}]}>{b.name}</Text><Text style={styles.small}>{b.concentration} · Owned</Text></Pressable>)}</View></>}
 {tab==='outfit'&&<Outfit onError={notify} onFeedback={feedback} feedbackBusy={busy} autoCamera={autoCamera} archiveEnabled={state.preferences.archiveOutfits}/>}
 {tab==='collection'&&<Collection state={state} refresh={refresh} notify={notify}/>}
 {tab==='settings'&&<Settings state={state} refresh={refresh} onSession={onSession} notify={notify}/>}
 {tab==='journal'&&<Journal state={state} busy={busy} refresh={refresh} notify={notify}/>}
 </ScrollView><View style={styles.tabbar}>{tabs.map(([id,label,Icon])=><Pressable key={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:tab===id}} onPress={()=>{setAutoCamera(false);setTab(id);}} style={styles.tab}><Icon size={20} color={tab===id?colors.dark:'#9baa8b'} strokeWidth={1.7}/><Text style={[styles.tabText,tab===id&&{color:colors.dark,fontWeight:'600'}]}>{label}</Text></Pressable>)}</View>
 {sheet?.kind==='solo'&&<Sheet title={'Picks · '+sheet.context.occasion.toLowerCase()} onClose={()=>setSheet(null)}>{sheet.solo.length?<Results solo={sheet.solo} combos={[]} occasion={sheet.context.occasion} requestId={sheet.requestId} onFeedback={feedback} busy={busy}/>:<Empty title={sheet.context.policy==='NO_FRAGRANCE'?'No fragrance advised':'No matches'} detail="Check owned bottles, profiles and venue rules."/>}</Sheet>}
 {sheet?.kind==='combo'&&<Pairing onClose={()=>setSheet(null)} onFeedback={feedback} feedbackBusy={busy} notify={notify}/>}
 </SafeAreaView>;
}
function Pairing({onClose,onFeedback,feedbackBusy,notify}:{onClose:()=>void;onFeedback:Feedback;feedbackBusy:boolean;notify:(s:string)=>void}){
 const revision=useRef(0);
 const [occasion,setOccasion]=useState(''),[experimental,setExperimental]=useState(false),[result,setResult]=useState<{combos:ComboResult[];requestId:string}|null>(null),[busy,setBusy]=useState(false);
 return <Sheet title="Pairing" onClose={onClose}><Choices label="Occasion" value={occasion} items={[["GENERAL","Everyday"],["DATE","Date"],["WORK","Work"],["PARTY","Party"],["GYM","Gym"],["ERRANDS","Errands"]]} onChange={v=>{revision.current++;setOccasion(v);setResult(null);}}/><Choices label="Evidence" value={experimental?'experimental':'evidence'} items={[["evidence","Evidence only"],["experimental","Include experiments"]]} onChange={v=>{revision.current++;setExperimental(v==='experimental');setResult(null);}}/>{experimental&&<Text style={styles.small}>Experimental pairs are untested. Apply separately; never mix liquids.</Text>}<Btn label={busy?'Finding…':'Find pair'} disabled={!occasion||busy} onPress={()=>{const generation=revision.current;setBusy(true);void api<{combos:ComboResult[];requestId:string}>('recommend','POST',{mode:'combo',occasion,evidenceMode:experimental?'experimental':'evidence'}).then(value=>{if(generation===revision.current)setResult(value);}).catch(e=>notify(e.message)).finally(()=>setBusy(false));}}/>{result&&<Results solo={[]} combos={result.combos} occasion={occasion} requestId={result.requestId} onFeedback={onFeedback} busy={feedbackBusy} showPairs/>}</Sheet>;
}
