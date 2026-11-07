import React,{useEffect,useState} from 'react';
import {Image,Pressable,Text,View} from 'react-native';
import {openBrowserAsync,WebBrowserPresentationStyle} from 'expo-web-browser';
import {ChevronDown,ChevronLeft,ChevronRight,ExternalLink,Images,Maximize2} from 'lucide-react-native';
import {api,sessionScope} from './api';
import {BottleArt,Btn,catalogPhotoUrl,IconButton,Section,Sheet,Spinner,useUi} from './ui';
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
 const [photoIndex,setPhotoIndex]=useState<number|null>(null);
 const [failedPhotos,setFailedPhotos]=useState<string[]>([]);
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
 const photos=profile?.photo?[profile.photo,...(profile.additionalPhotos??[])]:[];
 const featured=photos.find(photo=>!failedPhotos.includes(photo.path)&&catalogPhotoUrl(photo.path));
 const featuredUrl=catalogPhotoUrl(featured?.path);
 const jomashop=profile?.links?.find(link=>link.kind==='jomashop-listing');
 const jomashopLabel=jomashop?.bottleEdition?'Jomashop photos · '+jomashop.bottleEdition:'Jomashop photos';
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

 function markPhotoFailed(path:string) {
  setFailedPhotos(current=>current.includes(path)?current:[...current,path]);
 }

 if(photoIndex!==null&&photos[photoIndex]) {
  const photo=photos[photoIndex];
  const uri=failedPhotos.includes(photo.path)?undefined:catalogPhotoUrl(photo.path);
  return <Sheet title="Bottle photos" onClose={()=>setPhotoIndex(null)}>
   {uri?<Image key={photo.path} accessible accessibilityLabel={bottle.name+' · '+photo.caption}
    source={{uri}} resizeMode="contain" onError={()=>markPhotoFailed(photo.path)}
    style={[styles.image,{height:340}]}/>:
    <Text style={styles.notice}>Photo unavailable.</Text>}
   {photos.length>1&&<View style={[styles.spread,{alignSelf:'center',gap:16}]}>
    <IconButton label="Previous photo" icon={<ChevronLeft size={20} color={colors.ink}/>}
     disabled={photoIndex===0} onPress={()=>setPhotoIndex(photoIndex-1)}/>
    <Text accessibilityLiveRegion="polite" style={styles.small}>{photoIndex+1} / {photos.length}</Text>
    <IconButton label="Next photo" icon={<ChevronRight size={20} color={colors.ink}/>}
     disabled={photoIndex===photos.length-1} onPress={()=>setPhotoIndex(photoIndex+1)}/>
   </View>}
   {uri&&<Text style={[styles.small,{textAlign:'center'}]}>{photo.caption}</Text>}
  </Sheet>;
 }

 return <Sheet title="FragDex" onClose={onClose}>
  <View style={[styles.row,{alignItems:'center',gap:14}]}>
   <View style={{width:91,alignItems:'center',gap:4}}>
    {featured&&featuredUrl?<Pressable accessibilityRole="button" accessibilityLabel="Open bottle photos"
     onPress={()=>setPhotoIndex(photos.indexOf(featured))}>
     <Image key={featured.path} source={{uri:featuredUrl}} resizeMode="contain"
      onError={()=>markPhotoFailed(featured.path)}
      style={{width:88,height:114,borderRadius:5,backgroundColor:colors.wash}}/>
     <View pointerEvents="none" style={{position:'absolute',right:4,bottom:4,padding:4,
      borderRadius:4,backgroundColor:colors.surface}}>
      <Maximize2 size={12} color={colors.ink}/>
     </View>
    </Pressable>:
     <BottleArt bottle={{name:bottle.name,color:bottle.color,shape:bottle.shape}} size={94}/>}
    {!featuredUrl&&!jomashop&&official&&<FragDexLink url={official.url} visit={visit} hitSlop={6}>
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
  {jomashop&&<FragDexLink url={jomashop.url} visit={visit} accessibilityLabel={'See all '+jomashopLabel}
   style={[styles.row,{minHeight:44,paddingLeft:11,paddingRight:11,borderWidth:1,borderStyle:'solid',borderColor:colors.line,
    borderRadius:6,backgroundColor:colors.surface}]}>
   <Images size={16} color={colors.link}/>
   <Text style={[styles.link,{flex:1}]}>{jomashopLabel}</Text>
   <ExternalLink size={13} color={colors.link}/>
  </FragDexLink>}
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
     <Text style={styles.link}>{link.bottleEdition?link.label+' · '+link.bottleEdition:link.label}</Text>
     <ExternalLink size={11} color={colors.link}/>
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
