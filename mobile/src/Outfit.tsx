import React,{useCallback,useEffect,useRef,useState} from 'react';

import {Image,Pressable,Switch,Text,View} from 'react-native';

import {Camera,ImagePlus,Mic,Square,X} from 'lucide-react-native';

import {api,sessionScope,type SavedLook,type AiStatus,type OutfitMatches,type OutfitProfile,type OutfitReceipt} from './api';

import {capturePhoto,discardPhoto,startDictation,type Capture} from './capture';

import {Btn,Choices,Empty,Field,Section,Spinner,useUi} from './ui';

import {Results,type Feedback} from './Results';
import IntentPicker from './IntentPicker';
import type {ScentIntent} from '../../src/lib/types';

const occasions=[['GENERAL','Everyday'],['GYM','Gym'],['DATE','Date'],['WORK','Work'],['PARTY','Party'],['ERRANDS','Errands']] as const;

const tags=['casual','tailored','minimal','sporty','evening','streetwear','romantic','outdoors'] as const;

export default function Outfit({onError,onFeedback,feedbackBusy,archiveEnabled=false,intent,onIntentChange}:{onError:(s:string)=>void;onFeedback:Feedback;feedbackBusy:boolean;archiveEnabled?:boolean;intent:ScentIntent;onIntentChange:(value:ScentIntent)=>void}){
 const {styles,colors} = useUi();

 const [text,setText]=useState(''),[photo,setPhoto]=useState<Capture|null>(null),[status,setStatus]=useState<AiStatus|null>(null),[busy,setBusy]=useState(false),[receipt,setReceipt]=useState<OutfitReceipt|null>(null),[profile,setProfile]=useState<OutfitProfile|null>(null),[matches,setMatches]=useState<OutfitMatches|null>(null),[confirmed,setConfirmed]=useState(false),[details,setDetails]=useState(false);

 const [occasion,setOccasion]=useState('GENERAL'),[mode,setMode]=useState<'solo'|'combo'|'both'>('both'),[experimental,setExperimental]=useState(false),[listening,setListening]=useState(false);

 const active=useRef(true),captureGeneration=useRef(0);

 const revision=useRef(0);const livePhoto=useRef<Capture|null>(null),stop=useRef<(()=>void)|null>(null);

 const invalidate=useCallback(()=>{revision.current++;setMatches(null);},[]);

 const take=useCallback(async(source:'selfie'|'gallery')=>{try{const generation=++captureGeneration.current;const image=await capturePhoto(source);if(image&&(!active.current||generation!==captureGeneration.current)){await discardPhoto(image);return;}if(image){await discardPhoto(livePhoto.current);if(!active.current||generation!==captureGeneration.current){await discardPhoto(image);return;}livePhoto.current=image;setPhoto(image);setReceipt(null);setProfile(null);invalidate();}}catch(e){onError((e as Error).message);}},[invalidate,onError]);
 useEffect(()=>{
  active.current=true;
  void api<AiStatus>('ai/status').then(status=>{if(active.current)setStatus(status);}).catch(error=>{if(active.current)onError(error.message);});
  return ()=>{
   active.current=false;
   void discardPhoto(livePhoto.current).catch(error=>onError(error.message));
   stop.current?.();
  };
 },[onError]);

 async function dictate(){if(listening){stop.current?.();return;}try{setListening(true);const before=text;const dispose=await startDictation(t=>{if(active.current)setText((before?before+' ':'')+t);},()=>{if(active.current)setListening(false);},onError);if(active.current)stop.current=dispose;else dispose();}catch(e){setListening(false);onError((e as Error).message);}}

 async function analyze(){
  setBusy(true);stop.current?.();const stillCurrent=sessionScope();
  const captured=livePhoto.current,image=captured?{mime:captured.mime,data:captured.data}:undefined;
  livePhoto.current=null;setPhoto(null);
  try{
   await discardPhoto(captured);
   if(!active.current||!stillCurrent())return;
   const value=await api<OutfitReceipt>('outfit/analyze','POST',{provider:status!.selected,archivePhoto:archiveEnabled,...(text.trim()?{text:text.trim()}:{}),...(image?{image}:{})});
   if(!active.current)return;
   setReceipt(value);setProfile(value.profile);setConfirmed(false);setDetails(false);invalidate();
  }catch(error){if(active.current)onError((error as Error).message);}finally{if(image)image.data='';if(active.current)setBusy(false);}
 }
 async function archive(ids:string[],requestId?:string){
  if(!requestId||!confirmed||!archiveEnabled)return;
  setBusy(true);try{const look=await api<SavedLook>('looks','POST',{requestId,bottleIds:ids,confirmedAccurate:true});if(active.current)onError(look.photoAvailable?'Look and photo archived privately.':'Look archived. No photo retained.');}
  catch(error){if(active.current)onError((error as Error).message);}finally{if(active.current)setBusy(false);}
 }

 async function recommend(){if(!profile||!receipt)return;const generation=revision.current;setBusy(true);try{const next=await api<OutfitMatches>('outfit/recommend','POST',{analysisId:receipt.id,profile,occasion,mode,evidenceMode:experimental?'experimental':'evidence',...intent});if(active.current&&generation===revision.current)setMatches(next);}catch(e){if(active.current&&generation===revision.current)onError((e as Error).message);}finally{if(active.current)setBusy(false);}}

 const provider=status?.selected??'qwen';

 return <View style={{gap:17}}><View style={styles.spread}><Text accessibilityRole="header" style={styles.h1}>Outfit</Text><Text style={styles.small}>{provider==='qwen'?'Qwen · Local / free':provider==='openai'?'OpenAI · Your API':'Claude · Your API'}</Text></View>

 {!profile&&<><View style={styles.row}><Btn label="Take selfie" disabled={busy||listening} icon={<Camera size={16} color={colors.accentInk}/>} onPress={()=>void take('selfie')} style={{flex:1}}/><Btn label="Choose photo" kind="secondary" disabled={busy||listening} icon={<ImagePlus size={16} color={colors.muted}/>} onPress={()=>void take('gallery')} style={{flex:1}}/></View>{photo&&<View><Image source={{uri:photo.uri}} style={styles.image} resizeMode="contain"/><Pressable accessibilityRole="button" accessibilityLabel="Remove photo" onPress={()=>{void discardPhoto(livePhoto.current);livePhoto.current=null;setPhoto(null);}} style={{position:'absolute',right:8,top:8,padding:8,backgroundColor:colors.paper,borderRadius:20}}><X size={18} color={colors.muted}/></Pressable></View>}<Field label="Or describe your outfit" multiline maxLength={1800} value={text} onChangeText={setText} placeholder="White shirt, navy trousers, brown loafers…"/><View style={styles.spread}><Btn label={listening?'Stop dictation':'Dictate'} kind="secondary" disabled={busy} icon={listening?<Square size={14} color={colors.accentInk}/>:<Mic size={15} color={colors.muted}/>} onPress={()=>void dictate()}/><Btn label={busy?'Reading outfit…':'Review outfit'} disabled={busy||listening||!status||!photo&&!text.trim()} onPress={()=>void analyze()}/></View><Text style={styles.small}>{!status?'Checking analysis destination…':provider==='qwen'?'Qwen on your server. Photos are deleted by default.':`Photo/description is sent to ${provider==='openai'?'OpenAI':'Claude'} using your API key. Provider retention rules apply; API usage may be billed.`}</Text></>}

 {busy&&<Spinner label={profile?'Finding matches…':'Reading clothing details…'}/>}

 {profile&&receipt&&<><Section title="Review outfit" action="Start over" onAction={()=>{setProfile(null);setReceipt(null);invalidate();}}/>{receipt.method==='offline_rules'&&<Text style={styles.small}>Offline description rules - Qwen unavailable</Text>}<Text style={styles.small}>{receipt.photoRetained?'Photo held privately for up to 15 minutes. Archive a selected look to keep it.':'Photo not retained.'}</Text><Field label="Description" multiline value={profile.summary} maxLength={300} onChangeText={summary=>{setProfile({...profile,summary,hasOutfit:summary.trim().length>3});setConfirmed(false);invalidate();}}/><View style={styles.spread}><Text style={styles.small}>{profile.styleTags.slice(0,3).join(' · ')} · {profile.formality}</Text><Btn label={details?'Less detail':'Edit details'} kind="quiet" onPress={()=>setDetails(!details)}/></View>{details&&<><Field label="Garments" value={profile.garments.join(', ')} onChangeText={v=>{setProfile({...profile,garments:v.split(',').map(x=>x.trim()).filter(Boolean).slice(0,10)});setConfirmed(false);invalidate();}}/><Field label="Colors" value={profile.colors.join(', ')} onChangeText={v=>{setProfile({...profile,colors:v.split(',').map(x=>x.trim()).filter(Boolean).slice(0,8)});setConfirmed(false);invalidate();}}/><Text style={styles.label}>Style</Text><View style={[styles.row,{flexWrap:'wrap',gap:7}]}>{tags.map(tag=><Pressable key={tag} accessibilityRole="button" accessibilityLabel={tag} accessibilityState={{selected:profile.styleTags.includes(tag)}} onPress={()=>{setProfile({...profile,styleTags:profile.styleTags.includes(tag)?profile.styleTags.filter(t=>t!==tag):[...profile.styleTags,tag]});setConfirmed(false);invalidate();}} style={[styles.choice,profile.styleTags.includes(tag)&&styles.choiceActive]}><Text style={[styles.choiceText,profile.styleTags.includes(tag)&&{color:colors.accentInk,fontWeight:'600'}]}>{tag}</Text></Pressable>)}</View><Choices label="Formality" value={profile.formality} items={[["casual","Casual"],["smart","Smart"],["formal","Formal"]]} onChange={formality=>{setProfile({...profile,formality});setConfirmed(false);invalidate();}}/><Choices label="Palette" value={profile.palette} items={[["light","Light"],["dark","Dark"],["bright","Bright"],["neutral","Neutral"],["mixed","Mixed"]]} onChange={palette=>{setProfile({...profile,palette});setConfirmed(false);invalidate();}}/>{profile.uncertainty.length>0&&<Text style={styles.small}>{profile.uncertainty.join(' ')}</Text>}</>}<View style={styles.spread}><Text style={[styles.text,{flex:1}]}>This describes my outfit</Text><Switch accessibilityLabel="Confirm outfit description" value={confirmed} onValueChange={v=>{setConfirmed(v);if(!v)invalidate();}} trackColor={{true:colors.accentLine,false:colors.line}}/></View><Choices label="Occasion" value={occasion} items={occasions} onChange={v=>{setOccasion(v);invalidate();}}/><IntentPicker value={intent} onChange={value=>{invalidate();onIntentChange(value);}}/><Choices label="Recommend" value={mode} items={[["solo","Fragrance"],["combo","Pair"],["both","Both"]]} onChange={v=>{setMode(v);invalidate();}}/>{mode!=='solo'&&<View style={styles.spread}><View style={{flex:1}}><Text style={styles.text}>Include experimental pairs</Text><Text style={styles.small}>Untested. Uses two owned bottles.</Text></View><Switch accessibilityLabel="Include experimental pairs" value={experimental} onValueChange={v=>{setExperimental(v);invalidate();}} trackColor={{true:colors.accentLine,false:colors.line}}/></View>}<Btn label="Find matches" disabled={!confirmed||!profile.hasOutfit||busy} onPress={()=>void recommend()}/>{!profile.hasOutfit&&<Text style={styles.muted}>No outfit was identified. Add a clothing description.</Text>}</>}

 {matches&&matches.context.mood===intent.mood&&matches.context.vibe===intent.vibe&&<><Section title="Your matches"/>{!matches.solo.length&&!matches.combos.length&&<Empty title={matches.context.policy==='NO_FRAGRANCE'?'No fragrance advised':'No matches'} detail="Your collection, profiles, venue rules or evidence mode limit these results."/>}<Results solo={matches.solo} combos={matches.combos} occasion={occasion} requestId={matches.requestId} onFeedback={onFeedback} busy={feedbackBusy||busy} onArchive={archiveEnabled?(ids,id)=>void archive(ids,id):undefined} showPairs={mode!=='solo'}/><Text style={styles.small}>{archiveEnabled?'Saved looks are private.':'Archiving is off. Enable it in Settings to save looks.'}</Text><Text style={styles.small}>Outfit fit is a style heuristic. Venue policy and your exclusions take priority.</Text></>}

 </View>;

}
