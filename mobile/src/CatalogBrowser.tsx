import React,{useEffect,useRef,useState} from 'react';
import {Image,Pressable,Text,View} from 'react-native';
import {openBrowserAsync,WebBrowserPresentationStyle} from 'expo-web-browser';
import {ChevronRight,SlidersHorizontal} from 'lucide-react-native';
import {api,serverUrl,sessionScope} from './api';
import {Btn,Choices,Empty,Field,SearchBox,Sheet,Spinner,useUi} from './ui';
import FragDexRatings from './FragDexRatings';
import FragDexDupes from './FragDexDupes';
import FragDexLink from './FragDexLink';
import {catalogThumbnailPhotos,isCatalogPhotoPath} from '../../src/lib/catalog-photos';
import type {Bottle,CatalogDetailReply,CatalogSearchReply,CatalogTarget} from '../../src/lib/types';

const words=(value:string)=>value.split(',').map(word=>word.trim()).filter(Boolean);
export default function CatalogBrowser({onClose,onAdded,onSelect,onCompare,notify}:{
 onClose:()=>void;onAdded?:(bottle:Bottle,open?:boolean)=>void;onSelect?:(target:CatalogTarget)=>void;
 onCompare?:(target:CatalogTarget)=>void;notify:(message:string)=>void;
}){
 const {styles,colors}=useUi();
 const [query,setQuery]=useState(''),[include,setInclude]=useState(''),[exclude,setExclude]=useState('');
 const [stage,setStage]=useState('any'),[match,setMatch]=useState('all'),[filters,setFilters]=useState(false);
 const [offset,setOffset]=useState(0),[lookup,setLookup]=useState<{key:string;page?:CatalogSearchReply;error?:string}|null>(null);
 const [selected,setSelected]=useState(''),[attempt,setAttempt]=useState(0);
 const request=JSON.stringify({query,include:words(include),exclude:words(exclude),stage,match,offset});
 const key=request+':'+attempt,page=lookup?.key===key?lookup.page:null,error=lookup?.key===key?lookup.error:'';
 useEffect(()=>{
  let active=true;const current=sessionScope();
  const timer=setTimeout(()=>{void api<CatalogSearchReply>('catalog/search','POST',JSON.parse(request))
   .then(page=>{if(active&&current())setLookup({key,page});}).catch(error=>{if(active&&current())setLookup({key,error:error.message});});},220);
  return ()=>{active=false;clearTimeout(timer);};
 },[request,key]);
 const resetPage=()=>setOffset(0);
 if(selected)return <CatalogEntry key={selected} id={selected} onClose={()=>setSelected('')}
  onAdded={onAdded} onCompare={onCompare} notify={notify}/>;
 return <Sheet title={onSelect?'Choose from FragDex':'Browse FragDex'} onClose={onClose}>
  <SearchBox label="Search FragDex" placeholder="Fragrance or house" value={query} maxLength={120}
   onChange={value=>{setQuery(value);resetPage();}} onClear={()=>{setQuery('');resetPage();}}/>
  <View style={styles.spread}>
   <Text style={styles.small}>{page?`${page.total} editions`:error?'Search unavailable':'Searching…'}</Text>
   <Btn label={include||exclude?'Note filters · On':'Note filters'} kind="quiet" icon={<SlidersHorizontal size={14} color={colors.link}/>}
    onPress={()=>setFilters(value=>!value)}/>
  </View>
  {filters&&<View style={styles.card}>
   <Field label="Include notes" placeholder="bergamot, cedar" value={include} maxLength={500} onChangeText={value=>{setInclude(value);resetPage();}}/>
   <Field label="Exclude notes" placeholder="vanilla, oud" value={exclude} maxLength={500} onChangeText={value=>{setExclude(value);resetPage();}}/>
   <Choices label="Include" value={match} items={[[ 'all','All notes'],['any','Any note']]} onChange={value=>{setMatch(value);resetPage();}}/>
   <Choices label="Note position" value={stage} items={[[ 'any','Anywhere'],['top','Top'],['heart','Heart'],['base','Base'],['listed','Unstaged']]}
    onChange={value=>{setStage(value);resetPage();}}/>
   <Text style={styles.small}>Uses recorded note names. Missing notes are excluded from these filters. A note pyramid is not an ingredient or allergy list.</Text>
   <Btn label="Clear note filters" kind="quiet" onPress={()=>{setInclude('');setExclude('');setStage('any');setMatch('all');resetPage();}}/>
  </View>}
  {error?<View style={styles.notice}><Text accessibilityRole="alert" style={styles.muted}>{error}</Text><Btn label="Retry" kind="quiet" onPress={()=>setAttempt(value=>value+1)}/></View>:!page?<Spinner label="Searching catalog…"/>:
   page.entries.length?page.entries.map(entry=><Pressable key={entry.id} accessibilityRole="button"
    accessibilityLabel={entry.brand+' '+entry.name+' '+entry.concentration} onPress={()=>onSelect?onSelect({kind:'catalog',id:entry.id}):setSelected(entry.id)}
    style={[styles.row,{paddingVertical:9,borderBottomWidth:1,borderBottomColor:colors.line}]}>
    <CatalogThumbnail path={entry.photo} name={entry.name}/>
    <View style={{flex:1,gap:3}}><Text style={styles.small}>{entry.brand}</Text><Text style={styles.h3}>{entry.name}</Text>
     <Text style={styles.small}>{entry.concentration}{entry.releaseYear?' · '+entry.releaseYear:''}{!entry.hasNotes?' · Notes pending':''}</Text></View>
    <ChevronRight size={16} color={colors.muted}/>
   </Pressable>):<Empty title="No matching editions" detail="Try fewer notes or another spelling."/>}
  {page&&page.total>12&&<View style={styles.spread}>
   <Btn label="Previous" kind="quiet" disabled={!offset} onPress={()=>setOffset(value=>Math.max(0,value-12))}/>
   <Text style={styles.small}>{offset+1}–{Math.min(offset+12,page.total)} / {page.total}</Text>
   <Btn label="Next" kind="quiet" disabled={offset+12>=page.total} onPress={()=>setOffset(value=>value+12)}/>
  </View>}
 </Sheet>;
}

export function CatalogThumbnail({path,name,size=54}:{path?:string;name:string;size?:number}){
 const [failed,setFailed]=useState(false);
 return isCatalogPhotoPath(path)&&!failed?<Image source={{uri:serverUrl()+path}} resizeMode="contain" accessibilityLabel={name+' bottle'}
  style={{width:size,height:size*1.15}} onError={()=>setFailed(true)}/>:null;
}

function CatalogEntry({id,onClose,onAdded,onCompare,notify}:{id:string;onClose:()=>void;onAdded?:(bottle:Bottle,open?:boolean)=>void;onCompare?:(target:CatalogTarget)=>void;notify:(message:string)=>void}){
 const {styles,colors}=useUi();
 const [reply,setReply]=useState<CatalogDetailReply|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0);
 const [enlarged,setEnlarged]=useState(false),[failed,setFailed]=useState<string[]>([]),[credits,setCredits]=useState(false);
 const [next,setNext]=useState('');
 const [size,setSize]=useState('100'),[format,setFormat]=useState('Bottle');
 const saving=useRef(false),active=useRef(true);
 useEffect(()=>{active.current=true;return ()=>{active.current=false;};},[]);
 useEffect(()=>{
  let active=true;const current=sessionScope();
  void api<CatalogDetailReply>('catalog/detail','POST',{id}).then(result=>{if(active&&current())setReply(result);})
   .catch(error=>{if(active&&current())setError(error.message);});
  return ()=>{active=false;};
 },[id,attempt]);
 const profile=reply?.profile,photo=catalogThumbnailPhotos(profile,failed)[0];
 const visit=(url:string)=>{void openBrowserAsync(url,{presentationStyle:WebBrowserPresentationStyle.PAGE_SHEET,toolbarColor:colors.surface,showTitle:true}).catch(()=>notify('Could not open this source.'));};
 async function add(ownership:'OWNED'|'WISHLIST'){
  if(!reply||saving.current)return;const current=sessionScope();saving.current=true;setBusy(true);
  try{
   const {brand,name,concentration}=reply.edition;
   const bottle=await api<Bottle>('bottles','POST',{brand,name,concentration,ownership,family:'',notes:[],strength:1,climate:'UNKNOWN',
    profileKnown:false,provenance:'unknown',color:'#b8c986',shape:'square',sizeMl:Number(size),fillPct:100,rating:0,favorite:false,memo:'',shelves:format==='Bottle'?[]:[format==='Sample'?'Samples':'Decants']});
   if(current()){if(active.current)notify(ownership==='OWNED'?'Added to collection.':'Added to wishlist.');onAdded?.(bottle,active.current);}
  }catch(error){if(active.current&&current())notify((error as Error).message);}finally{saving.current=false;if(active.current&&current())setBusy(false);}
 }
 if(next)return <CatalogEntry key={next} id={next} onClose={()=>setNext('')} onAdded={onAdded} onCompare={onCompare} notify={notify}/>;
 if(enlarged&&photo)return <Sheet title={reply?.edition.name??'Bottle'} onClose={()=>setEnlarged(false)}>
  <Image source={{uri:serverUrl()+photo.path}} resizeMode="contain" accessibilityLabel={photo.caption} style={{width:'100%',height:420}}
   onError={()=>{setFailed(value=>[...value,photo.path]);setEnlarged(false);}}/>
 </Sheet>;
 return <Sheet title="FragDex" onClose={onClose}>
  {!reply&&!error&&<Spinner label="Opening edition…"/>}
  {error&&<View style={styles.notice}><Text accessibilityRole="alert" style={styles.muted}>{error}</Text><Btn label="Retry" kind="quiet" onPress={()=>{setError('');setAttempt(value=>value+1);}}/></View>}
  {reply&&<>
   <View style={styles.row}>
    {photo&&<Pressable accessibilityRole="button" accessibilityLabel="Enlarge bottle thumbnail" onPress={()=>setEnlarged(true)}>
     <Image source={{uri:serverUrl()+photo.path}} resizeMode="contain" accessibilityLabel={photo.caption} style={{width:90,height:115}}
      onError={()=>setFailed(value=>[...value,photo.path])}/></Pressable>}
    <View style={{flex:1,gap:5}}><Text style={styles.small}>{reply.edition.brand}</Text><Text style={styles.h2}>{reply.edition.name}</Text>
     <Text style={styles.small}>{reply.edition.concentration}{reply.edition.releaseYear?' · '+reply.edition.releaseYear:''}</Text></View>
   </View>
   {onAdded&&<>
    <View style={[styles.row,{alignItems:'flex-end'}]}><View style={{flex:1}}><Choices value={format} items={[[ 'Bottle','Bottle'],['Sample','Sample'],['Decant','Decant']]}
     onChange={value=>{setFormat(value);setSize(value==='Sample'?'2':value==='Decant'?'10':'100');}}/></View>
     <View style={{width:85}}><Field label="Volume · ml" keyboardType="decimal-pad" value={size} onChangeText={setSize}/></View></View>
    <View style={styles.row}><Btn label={busy?'Adding…':'I own this'} disabled={busy||!Number.isFinite(Number(size))||Number(size)<0.1||Number(size)>2000} onPress={()=>void add('OWNED')}/>
     <Btn label="Wishlist" kind="secondary" disabled={busy||!Number.isFinite(Number(size))||Number(size)<0.1||Number(size)>2000} onPress={()=>void add('WISHLIST')}/></View>
   </>}
   {onCompare&&<Btn label="Compare fragrances" kind="quiet" onPress={()=>onCompare({kind:'catalog',id})}/>}
   <View style={{gap:6}}><Text style={styles.h3}>Cross-checked notes</Text>
    {!profile?.notes.length&&<Text style={styles.muted}>No cross-checked note pyramid for this edition yet.</Text>}
    {(['top','heart','base','listed'] as const).map(stage=>{
     const notes=profile?.notes.filter(note=>note.stage===stage)??[];
     return notes.length?<View key={stage} style={styles.row}><Text style={[styles.label,{width:40}]}>{stage==='listed'?'Notes':stage[0].toUpperCase()+stage.slice(1)}</Text>
      <Text style={[styles.text,{flex:1}]}>{notes.map(note=>note.name).join(' · ')}</Text></View>:null;
    })}
   </View>
   <FragDexRatings profile={profile} visit={visit}/><FragDexDupes dupes={reply.dupes} visit={visit}/>
   {!!reply.similar.length&&<View style={{gap:5}}><Text style={styles.h3}>Similar listed notes</Text><Text style={styles.small}>Shared notes suggest a place to explore; they do not prove scents smell alike.</Text>
    {reply.similar.map(match=><Pressable key={match.edition.id} accessibilityRole="button" accessibilityLabel={'Explore '+match.edition.name}
     onPress={()=>setNext(match.edition.id)} style={{paddingVertical:8,borderBottomWidth:1,borderBottomColor:colors.line}}>
     <Text style={styles.link}>{match.edition.brand} · {match.edition.name} · {match.edition.concentration}</Text>
     <Text style={styles.small}>{match.sharedNotes.length} shared · {match.sharedNotes.slice(0,4).join(', ')}</Text></Pressable>)}
   </View>}
   {profile?.links.map(link=><FragDexLink key={link.url} url={link.url} visit={visit} style={{minHeight:38,justifyContent:'center'}}><Text style={styles.link}>{link.label}</Text></FragDexLink>)}
   {!!profile?.sources.length&&<><Btn label={credits?'Hide sources & credits':'Sources & credits'} kind="quiet" onPress={()=>setCredits(value=>!value)}/>
    {credits&&<><Text style={styles.small}>Checked {profile.checkedAt}</Text>{profile.sources.map(source=><View key={source.id}>
     <FragDexLink url={source.url} visit={visit} style={{minHeight:36,justifyContent:'center'}}><Text style={styles.link}>{source.publisher}</Text></FragDexLink>
     {source.credit&&<Text style={styles.small}>{source.credit}</Text>}
     {source.license&&<FragDexLink url={source.license.url} visit={visit}><Text style={styles.link}>{source.license.name}</Text></FragDexLink>}
    </View>)}</>}
   </>}
  </>}
 </Sheet>;
}
