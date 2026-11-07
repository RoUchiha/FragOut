import React,{useCallback,useEffect,useState} from 'react';
import {Pressable,ScrollView,Text,View} from 'react-native';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {router,useLocalSearchParams} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {ArrowLeft,BookOpen,Home,Settings2,X} from 'lucide-react-native';
import {api,restoreSession,serverUrl,sessionScope,setServer,signIn,type AppState} from './src/api';
import {Btn,Field,IconButton,Spinner,UiProvider,useSeasonalUi} from './src/ui';
import Outfit from './src/Outfit';
import Collection from './src/Collection';
import Journal from './src/Journal';
import Settings from './src/Settings';
import Suggester from './src/Suggester';
import SuggesterIcon from './src/SuggesterIcon';
import type {Feedback} from './src/Results';
import {defaultIntent} from '../src/lib/intent';
import type {ScentIntent} from '../src/lib/types';

type ViewId = 'home'|'suggester'|'outfit'|'journal'|'settings';
const tabs = [['home','Home',Home],['suggester','Suggester',SuggesterIcon]] as const;

export default function App() {
 return <SafeAreaProvider><Workspace/></SafeAreaProvider>;
}

function Workspace() {
 const params = useLocalSearchParams<{view?:string}>();
 const requested = params.view;
 const view:ViewId = requested==='suggester'||requested==='outfit'||requested==='settings'||requested==='journal' ? requested : 'home';
 const activeTab = view==='suggester'||view==='outfit' ? 'suggester' : 'home';
 const navigate = useCallback((target:ViewId)=>router.setParams({view:target}),[]);
 const [state,setState] = useState<AppState|null>(null);
 const [loading,setLoading] = useState(true);
 const [toast,setToast] = useState('');
 const [error,setError] = useState('');
 const [address,setAddress] = useState(serverUrl());
 const [feedbackBusy,setFeedbackBusy] = useState(false);
 const [intent,setIntent] = useState<ScentIntent>(defaultIntent);
 const theme = useSeasonalUi(state?.context.latitude);
 const {styles,colors} = theme;
 const notify = useCallback((message:string)=>setToast(message),[]);

 const onSession = useCallback((next:AppState|null,resetView=true)=>{
  setIntent(defaultIntent);
  setState(next);
  setFeedbackBusy(false);
  setError(next?'':'Signed out. Reconnect to continue.');
  setToast('');
  if (resetView) navigate('home');
 },[navigate]);

 const initialize = useCallback(async ()=>{
  setLoading(true);
  setError('');
  try {
   setAddress(await restoreSession());
   let next:AppState;
   try { next=await api<AppState>('state'); }
   catch { next=await signIn('demo'); }
   onSession(next,false);
  } catch (problem) {
   setError((problem as Error).message);
  } finally {
   setLoading(false);
  }
 },[onSession]);

 useEffect(()=>{void initialize();},[initialize]);
 useEffect(()=>{
  if (!toast) return;
  const timer = setTimeout(()=>setToast(''),6000);
  return ()=>clearTimeout(timer);
 },[toast]);

 const refresh = useCallback(async ()=>{
  const next = await api<AppState>('state');
  setState(previous=>previous?.user.id===next.user.id?next:previous);
 },[]);

 const feedback:Feedback = async (ids,reaction,occasion,requestId)=>{
  const stillCurrent = sessionScope();
  setFeedbackBusy(true);
  try {
   await api('feedback','POST',{bottleIds:ids,reaction,occasion,requestId});
   if (!stillCurrent()) return;
   await refresh();
   if (stillCurrent()) notify(reaction==='saved'?'Pair saved.':reaction==='disliked'?'Feedback saved.':'Logged.');
  } catch (problem) {
   if (stillCurrent()) notify((problem as Error).message);
  } finally {
   if (stillCurrent()) setFeedbackBusy(false);
  }
 };

 return <UiProvider value={theme}>
  <SafeAreaView style={styles.screen} edges={['top','bottom']}>
   <StatusBar style={colors.isDark?'light':'dark'}/>
   {loading ? <Spinner label="Opening FragOut…"/> : !state ?
    <ScrollView contentContainerStyle={[styles.content,{paddingTop:42}]}>
     <Text style={styles.h1}>Connect FragOut</Text>
     <Text style={styles.muted}>{toast||error||'Enter your server address.'}</Text>
     <Field label="Server URL" value={address} onChangeText={setAddress} autoCapitalize="none" autoCorrect={false}/>
     <Btn label="Connect" onPress={()=>{void setServer(address).then(initialize).catch(problem=>setError(problem.message));}}/>
     <Btn label="Retry" kind="quiet" onPress={()=>void initialize()}/>
    </ScrollView> :
    <>
     <View style={styles.topbar}>
      <View style={styles.row}>
       {view!==activeTab&&<IconButton label={activeTab==='home'?'Back to Home':'Back to Suggester'}
        icon={<ArrowLeft size={19} color={colors.link}/>} onPress={()=>navigate(activeTab)}/>}
       <Text style={styles.brand}>FragOut.</Text>
      </View>
      <View style={[styles.row,{gap:2}]}>
       <IconButton label="Open journal" icon={<BookOpen size={18} color={colors.link}/>} onPress={()=>navigate('journal')}/>
       <IconButton label="Open settings" icon={<Settings2 size={19} color={colors.link}/>} onPress={()=>navigate('settings')}/>
      </View>
     </View>
     {state.user.demo&&<View style={styles.demo}>
      <Text style={styles.small}>Demo · fictional fragrances</Text>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={()=>navigate('settings')}>
       <Text style={styles.link}>Your account</Text>
      </Pressable>
     </View>}
     {toast&&<View style={styles.toast}>
      <Text accessibilityRole="alert" style={styles.toastText}>{toast}</Text>
      <IconButton label="Dismiss" icon={<X size={16} color={colors.paper}/>} onPress={()=>setToast('')}/>
     </View>}
     <ScrollView key={state.user.id+':'+view} style={{flex:1,minHeight:0}}
      contentContainerStyle={[styles.content,{width:'100%',maxWidth:620,alignSelf:'center'}]}
      keyboardShouldPersistTaps="handled">
      {view==='home'&&<Collection state={state} refresh={refresh} notify={notify}/>}
      {view==='suggester'&&<Suggester state={state} intent={intent} onIntentChange={setIntent}
       onOutfit={()=>navigate('outfit')} onFeedback={feedback} feedbackBusy={feedbackBusy}/>}
      {view==='outfit'&&<Outfit onError={notify} onFeedback={feedback} feedbackBusy={feedbackBusy}
       archiveEnabled={state.preferences.archiveOutfits} intent={intent} onIntentChange={setIntent}/>}
      {view==='settings'&&<Settings state={state} refresh={refresh} onSession={onSession} notify={notify}/>}
      {view==='journal'&&<Journal state={state} busy={feedbackBusy} refresh={refresh} notify={notify}/>}
     </ScrollView>
     <View style={styles.tabbar} accessibilityRole="tablist">
      {tabs.map(([id,label,Icon])=>{
       const selected = activeTab===id;
       return <Pressable key={id} accessibilityRole="tab" accessibilityLabel={label}
        accessibilityState={{selected}} onPress={()=>navigate(id)} style={[styles.tab,selected&&styles.activeTab]}>
        <Icon color={selected?colors.accentInk:colors.muted}/>
        <Text style={[styles.tabText,selected&&{color:colors.accentInk,fontWeight:'600'}]}>{label}</Text>
       </Pressable>;
      })}
     </View>
    </>}
  </SafeAreaView>
 </UiProvider>;
}
