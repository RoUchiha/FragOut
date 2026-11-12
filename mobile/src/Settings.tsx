import React,{useState} from 'react';
import {openURL} from 'expo-linking';
import {useAdPrivacy} from './ads';
import {Platform,Pressable,Switch,Text,View} from 'react-native';
import {api,serverUrl,setServer,signIn,signOut,sessionScope,validateServerUrl,type AppState} from './api';
import {shareAccountExport} from './export-data';
import Connections from './Connections';
import FragDexAdmin from './FragDexAdmin';
import {Btn,Choices,Field,Section,Sheet,useUi} from './ui';
export default function Settings({state,refresh,onSession,notify}:{state:AppState;refresh:()=>Promise<void>;onSession:(s:AppState|null)=>void;notify:(s:string)=>void}){
 const {styles} = useUi();
 const editAdPrivacy = useAdPrivacy();
 const [hemisphere,setHemisphere] = useState(state.context.latitude<0?'south':'north');
 const [dialog,setDialog]=useState<'auth'|'preferences'|'context'|'server'|'delete'|'archiveOff'|'catalogPhotos'|null>(null),[busy,setBusy]=useState(false),[deleteText,setDeleteText]=useState(''),[server,setServerValue]=useState(serverUrl());
 const [authMode,setAuthMode]=useState<'register'|'login'>('register'),[name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [liked,setLiked]=useState(state.preferences.likedNotes.join(', ')),[disliked,setDisliked]=useState(state.preferences.dislikedNotes.join(', ')),[maxStrength,setMaxStrength]=useState(String(state.preferences.maxStrength)),[sensitive,setSensitive]=useState(state.preferences.sensitivity),[units,setUnits]=useState(state.preferences.units);
 const [city,setCity]=useState(state.context.city),[temp,setTemp]=useState(String(state.context.tempC)),[indoor,setIndoor]=useState(String(state.context.indoorTempC)),[setting,setSetting]=useState(state.context.setting),[policy,setPolicy]=useState(state.context.policy);
 async function run(work:()=>Promise<void>){setBusy(true);try{await work();}catch(e){notify((e as Error).message);}finally{setBusy(false);}}
 async function exportAll(){await shareAccountExport();notify('Export ready.');}
 async function openPrivacyPolicy(){
  try{await openURL(new URL('/privacy',validateServerUrl(serverUrl())).href);}
  catch{notify('Could not open the privacy policy.');}
 }
 return <View style={{gap:18}}><Text accessibilityRole="header" style={styles.h1}>Settings</Text><View style={styles.card}><Text style={styles.h3}>{state.user.name}</Text><Text style={styles.small}>{state.user.email??'Demo · fictional fragrances'}</Text><Btn label={state.user.demo?'Create account / sign in':'Sign out'} kind="secondary" disabled={busy} onPress={()=>state.user.demo?setDialog('auth'):void run(async()=>{const leaving=signOut(),stillCurrent=sessionScope();onSession(null);await leaving;if(stillCurrent())onSession(await signIn('demo'));})}/>
  {state.user.catalogAdmin===true&&<Btn label="FragDex photos" kind="secondary" onPress={()=>setDialog('catalogPhotos')}/>}
 </View>
 <View style={styles.row}><Btn label="Preferences" kind="secondary" onPress={()=>setDialog('preferences')} style={{flex:1}}/><Btn label="Conditions" kind="secondary" onPress={()=>setDialog('context')} style={{flex:1}}/></View>
 <View style={styles.separator}/><Connections notify={notify}/><View style={styles.separator}/>
 <Section title="Photo privacy"/>
 <View style={styles.spread}><Text style={[styles.text,{flex:1}]}>Archive outfit-fragrance looks</Text><Switch accessibilityLabel="Archive outfit-fragrance looks" disabled={busy} value={state.preferences.archiveOutfits} onValueChange={value=>value?void run(async()=>{await api('settings','PUT',{preferences:{...state.preferences,archiveOutfits:true}});await refresh();notify('Archiving enabled. Save a selected look to keep its photo.');}):setDialog('archiveOff')}/></View>
 <Text style={styles.small}>FragOut sends photos to your server for analysis. The server processes bottle photos and outfit photos with archiving off in memory.</Text>
 <Text style={styles.small}>Archiving is off by default. When enabled, the server holds eligible outfit photos encrypted for up to 15 minutes. Choose Archive look to keep a photo. Turning off archiving deletes saved looks and photos. Your photo-library originals stay on your device.</Text>
 <Section title="Your data"/>
 <Btn label="Export data" kind="secondary" disabled={busy} onPress={()=>void run(exportAll)}/>
 <Btn label="Delete account" kind="quiet" onPress={()=>setDialog('delete')}/>
 <Pressable accessibilityRole="link" style={[styles.button,styles.quiet]} onPress={()=>void openPrivacyPolicy()}><Text style={styles.link}>Privacy policy</Text></Pressable>
 {editAdPrivacy&&<Btn label="Ad privacy" kind="quiet" disabled={busy} onPress={()=>void run(editAdPrivacy)}/>}
 <Section title="Server" action={Platform.OS==='web'?undefined:'Change'} onAction={()=>setDialog('server')}/><Text selectable style={styles.small}>{serverUrl()}</Text>
 {state.user.catalogAdmin===true&&dialog==='catalogPhotos'&&<FragDexAdmin onClose={()=>setDialog(null)} onUpdated={refresh}/>}
 {dialog==='auth'&&<Sheet title="Account" onClose={()=>setDialog(null)}>
  <Choices value={authMode} items={[["register","Create account"],["login","Sign in"]]} onChange={setAuthMode}/>
  {authMode==='register'&&<Field label="Name" value={name} onChangeText={setName} autoComplete="name"/>}
  <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"/>
  <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none"/>
  {authMode==='register'&&<Text style={styles.small}>12 characters minimum. Local account; no password recovery.</Text>}
  <Btn label={authMode==='register'?'Create account':'Sign in'}
   disabled={busy||!email||!password||authMode==='register'&&(!name||password.length<12)} onPress={()=>void run(async()=>{
    const fields=authMode==='register'?{name,email,password}:{email,password};
    const signing=signIn(authMode,fields);
    onSession(null);
    const next=await signing;
    setPassword('');setDialog(null);onSession(next);
   })}/>
 </Sheet>}
 {dialog==='preferences'&&<Sheet title="Preferences" onClose={()=>setDialog(null)}><Choices label="Temperature" value={units} items={[["F","Fahrenheit"],["C","Celsius"]]} onChange={setUnits}/><Field label="Liked notes" value={liked} onChangeText={setLiked}/><Field label="Avoided notes" value={disliked} onChangeText={setDisliked}/><Choices label="Maximum projection" value={maxStrength} items={[["1","Light"],["2","Moderate"],["3","Any"]]} onChange={setMaxStrength}/><View style={styles.spread}><Text style={styles.text}>Sensitivity: light only</Text><Switch accessibilityLabel="Sensitivity: light only" value={sensitive} onValueChange={setSensitive}/></View><Text style={styles.small}>Avoided notes exclude matching known profiles.</Text><Btn label="Save preferences" disabled={busy} onPress={()=>void run(async()=>{const words=(s:string)=>s.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);await api('settings','PUT',{preferences:{...state.preferences,likedNotes:words(liked),dislikedNotes:words(disliked),maxStrength:Number(maxStrength),sensitivity:sensitive,units}});await refresh();setDialog(null);})}/></Sheet>}
 {dialog==='context'&&<Sheet title="Conditions" onClose={()=>setDialog(null)}><Field label="City / place" value={city} onChangeText={setCity}/><Choices label="Hemisphere" value={hemisphere} items={[[ "north","Northern"],["south","Southern"]]} onChange={setHemisphere}/><Field label="Outside temperature (°C)" value={temp} onChangeText={setTemp} keyboardType="numbers-and-punctuation"/><Field label="Indoor temperature (°C)" value={indoor} onChangeText={setIndoor} keyboardType="numbers-and-punctuation"/><Choices label="Setting" value={setting} items={[["MIXED","Mixed"],["INDOOR","Indoors"],["OUTDOOR","Outdoors"]]} onChange={setSetting}/><Choices label="Venue policy" value={policy} items={[["FREE","Allowed"],["LOW_SCENT","Low scent"],["NO_FRAGRANCE","Fragrance-free"]]} onChange={setPolicy}/><Text style={styles.small}>Manual conditions. No live forecast.</Text><Btn label="Save conditions" disabled={busy} onPress={()=>void run(async()=>{await api('settings','PUT',{context:{...state.context,city,tempC:Number(temp),indoorTempC:Number(indoor),setting,policy,latitude:hemisphere==='south'?-Math.max(Math.abs(state.context.latitude),.01):Math.abs(state.context.latitude)}});await refresh();setDialog(null);})}/></Sheet>}
 {dialog==='server'&&<Sheet title="Connect server" onClose={()=>setDialog(null)}><Field label="Server URL" value={server} onChangeText={setServerValue} autoCapitalize="none" autoCorrect={false} placeholder="https://your-server.example"/><Text style={styles.muted}>Connect only to a FragOut server you control. HTTPS is required outside local development. Changing servers signs you out.</Text><Btn label="Connect" disabled={busy} onPress={()=>void run(async()=>{validateServerUrl(server);const changing=setServer(server);onSession(null);const stillCurrent=await changing;if(stillCurrent())onSession(await signIn('demo'));setDialog(null);})}/></Sheet>}
 {dialog==='archiveOff'&&<Sheet title="Turn off archiving" onClose={()=>setDialog(null)}><Text style={styles.muted}>This deletes all saved looks and their photos from this account. New selfies will not be retained.</Text><Btn label="Delete saved looks and turn off" kind="danger" disabled={busy} onPress={()=>void run(async()=>{await api('settings','PUT',{preferences:{...state.preferences,archiveOutfits:false}});await refresh();setDialog(null);notify('Archiving off. Saved looks and photos deleted.');})}/><Btn label="Keep archiving" kind="quiet" onPress={()=>setDialog(null)}/></Sheet>}
 {dialog==='delete'&&<Sheet title="Delete account" onClose={()=>setDialog(null)}><Text style={styles.muted}>Permanently removes your account, bottles, journal, outfit analyses and connected API keys from this server.</Text><Field label="Type DELETE" value={deleteText} onChangeText={setDeleteText} autoCapitalize="characters"/><Btn label="Permanently delete" kind="danger" disabled={busy||deleteText!=='DELETE'} onPress={()=>void run(async()=>{await api('account','DELETE');const leaving=signOut(),stillCurrent=sessionScope();onSession(null);await leaving;if(stillCurrent())onSession(await signIn('demo'));setDialog(null);})}/></Sheet>}
 </View>;
}
