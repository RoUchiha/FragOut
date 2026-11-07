import React,{useEffect,useState} from 'react';
import {Image,Pressable,Text,View} from 'react-native';
import {openBrowserAsync,WebBrowserPresentationStyle} from 'expo-web-browser';
import {ChevronDown,ExternalLink} from 'lucide-react-native';
import {api,sessionScope} from './api';
import {BottleArt,Btn,catalogPhotoUrl,Section,Sheet,Spinner,useUi} from './ui';
import FragDexLink from './FragDexLink';
import FragDexRatings from './FragDexRatings';
import type {Bottle,CatalogProfile} from '../../src/lib/types';

const stages=[['top','Top'],['heart','Heart'],['base','Base'],['listed','Notes']] as const;
type ProfileReply={variantId:string;profile:CatalogProfile|null};
type Lookup=ProfileReply|{error:string};

export default function FragranceProfile({bottle,onClose,onEdit,onRefresh}:{
 bottle:Bottle;onClose:()=>void;onEdit:()=>void;onRefresh:()=>void;
}){
 const {styles,colors}=useUi();
 const [lookup,setLookup]=useState<Lookup|null>(null);
 const [attempt,setAttempt]=useState(0);
 const [photoFailed,setPhotoFailed]=useState(false);
 const [showSources,setShowSources]=useState(false);
 const [linkError,setLinkError]=useState('');

 useEffect(()=>{
  let active=true;
  const stillCurrent=sessionScope();
  void api<ProfileReply>('bottles/'+bottle.id+'/profile')
   .then(result=>{if(active&&stillCurrent())setLookup(result);})
   .catch((error:Error)=>{if(active&&stillCurrent())setLookup({error:error.message});});
  return ()=>{active=false;};
 },[bottle.id,bottle.variantId,attempt]);

 const reply=lookup&&'profile' in lookup?lookup:null;
 const changed=!!reply&&reply.variantId!==bottle.variantId;
 const profile=changed?null:reply?.profile;
 const photo=profile?.photo;
 const photoUrl=photoFailed?undefined:catalogPhotoUrl(photo?.path);
 const official=profile?.sources.find(source=>source.kind==='house');
 const noteGroups=stages.map(([stage,label])=>({
  label,names:profile?.notes.filter(note=>note.stage===stage).map(note=>note.name)??[],
 })).filter(group=>group.names.length>0);

 function visit(url:string) {
  setLinkError('');
  void openBrowserAsync(url,{
   presentationStyle:WebBrowserPresentationStyle.PAGE_SHEET,dismissButtonStyle:'close',
   showTitle:true,toolbarColor:colors.surface,
  }).catch(()=>setLinkError('Could not open this source.'));
 }

 return <Sheet title="FragDex" onClose={onClose}>
  <View style={[styles.row,{alignItems:'center',gap:14}]}>
   <View style={{width:91,alignItems:'center',gap:4}}>
    {photoUrl ? <Image accessible source={{uri:photoUrl}} resizeMode="contain"
     accessibilityLabel={'Reference bottle photo of '+bottle.name} onError={()=>setPhotoFailed(true)}
     style={{width:88,height:114,borderRadius:5,backgroundColor:colors.wash}}/> :
     <BottleArt bottle={{name:bottle.name,color:bottle.color,shape:bottle.shape}} size={94}/>}
    {photoUrl&&<Text style={[styles.small,{textAlign:'center'}]}>{photo?.caption}</Text>}
    {!photoUrl&&official&&<FragDexLink url={official.url} visit={visit} hitSlop={6}>
     <Text style={styles.link}>Official bottle</Text>
    </FragDexLink>}
   </View>
   <View style={{flex:1,minWidth:0,gap:4}}>
    <Text style={styles.small}>{profile?.brand??bottle.brand}</Text>
    <Text style={styles.h2}>{profile?.name??bottle.name}</Text>
    <Text style={styles.small}>{bottle.concentration==='UNKNOWN'?'Concentration unknown':bottle.concentration}</Text>
    <Btn label="Edit bottle" kind="secondary" disabled={!lookup||changed}
     onPress={onEdit} style={{alignSelf:'flex-start',marginTop:3}}/>
   </View>
  </View>
  {!lookup&&<Spinner label="Checking catalog…"/>}
  {lookup&&'error' in lookup&&<View style={styles.notice}>
   <Text style={styles.muted}>{lookup.error}</Text>
   <Btn label="Retry" kind="quiet" onPress={()=>{setLookup(null);setAttempt(current=>current+1);}}/>
  </View>}
  {changed&&<View style={styles.notice}>
   <Text style={styles.muted}>This bottle changed in another session.</Text>
   <Btn label="Refresh collection" kind="quiet" onPress={onRefresh}/>
  </View>}
  {reply&&!changed&&!profile&&<Text style={styles.muted}>
   {bottle.concentration==='UNKNOWN'?'Set the concentration to match a catalog profile.':'No cross-checked profile for this edition yet.'}
  </Text>}
  {profile&&<>
   <View style={styles.separator}/>
   <View style={{gap:5}}>
    <Section title="Cross-checked notes"/>
    {noteGroups.length===0&&<Text style={styles.muted}>Awaiting a second source.</Text>}
    {noteGroups.map(group=><View key={group.label} style={[styles.row,{alignItems:'flex-start'}]}>
     {noteGroups.length>1&&<Text style={[styles.label,{width:40,marginTop:3}]}>{group.label}</Text>}
     <Text style={[styles.text,{flex:1}]}>{group.names.join(' · ')}</Text>
    </View>)}
   </View>
  </>}
  {reply&&!changed&&<FragDexRatings profile={profile} visit={visit}/>}
  {profile&&<>
   {!!profile.links?.length&&<View style={[styles.row,{flexWrap:'wrap',gap:7}]}>
    {profile.links.map(link=><FragDexLink key={link.url} url={link.url} visit={visit}
     style={[styles.row,{minHeight:38,gap:4,paddingHorizontal:9,borderWidth:1,borderColor:colors.line,borderRadius:6}]}>
     <Text style={styles.link}>{link.label}</Text><ExternalLink size={11} color={colors.link}/>
    </FragDexLink>)}
   </View>}
   <View style={styles.separator}/>
   <Pressable accessibilityRole="button" accessibilityLabel="Sources and credits" accessibilityState={{expanded:showSources}}
    onPress={()=>setShowSources(current=>!current)} style={[styles.spread,{minHeight:44}]}>
    <Text style={styles.link}>Sources &amp; credits · {profile.sources.length}</Text>
    <ChevronDown size={16} color={colors.link} style={{transform:[{rotate:showSources?'180deg':'0deg'}]}}/>
   </Pressable>
   {showSources&&<View style={{gap:8}}>
    <Text style={styles.small}>Checked {profile.checkedAt}</Text>
    {profile.sources.map(source=><View key={source.id} style={{gap:2}}>
     <FragDexLink url={source.url} visit={visit} style={[styles.row,{minHeight:32}]}>
      <Text style={styles.link}>{source.publisher}{source.kind==='house'?' · Official':source.kind==='photo'?' · Photo':''}</Text>
      <ExternalLink size={12} color={colors.link}/>
     </FragDexLink>
     {source.credit&&<Text style={styles.small}>{source.credit}</Text>}
     {source.license&&<FragDexLink url={source.license.url} visit={visit} style={{minHeight:30,justifyContent:'center'}}>
      <Text style={styles.link}>{source.license.name}</Text>
     </FragDexLink>}
    </View>)}
   </View>}
  </>}
  {linkError&&<Text accessibilityRole="alert" style={styles.muted}>{linkError}</Text>}
 </Sheet>;
}
