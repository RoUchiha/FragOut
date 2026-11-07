import React,{useState} from 'react';
import {Text,View} from 'react-native';
import {api,type AppState} from './api';
import SavedLooks from './SavedLooks';
import {intentSummary} from '../../src/lib/intent';
import {Btn,Choices,Empty,styles} from './ui';
export default function Journal({state,busy,refresh,notify}:{state:AppState;busy:boolean;refresh:()=>Promise<void>;notify:(message:string)=>void}){
 const [view,setView]=useState('log');
 return <View style={{gap:16}}><Text accessibilityRole="header" style={styles.h1}>Journal</Text><Choices value={view} items={[["log","Wear log"],["looks","Saved looks"]]} onChange={setView}/>{view==='looks'?<SavedLooks key={String(state.preferences.archiveOutfits)} enabled={state.preferences.archiveOutfits} notify={notify}/>:state.history.length?state.history.map(h=><View key={h.id} style={styles.card}><Text style={styles.small}>{h.occasion} · {h.reaction==='saved'?'Saved pair':h.reaction==='disliked'?'Not for me':h.reaction==='loved'?'Loved':'Wore'}</Text><Text style={styles.h3}>{h.names.join(' + ')}</Text><Text style={styles.small}>{new Date(h.at).toLocaleString(undefined,{timeZone:h.context.timezone})} · {h.context.setting.toLowerCase()}{intentSummary(h.context)?' · '+intentSummary(h.context):''} · Manual</Text><Btn label="Remove entry" kind="quiet" disabled={busy} onPress={()=>{void api('feedback/'+h.id,'DELETE').then(refresh).catch(e=>notify(e.message));}}/></View>):<Empty title="No logs yet" detail="Wear a pick or save a pairing."/>}</View>;
}
