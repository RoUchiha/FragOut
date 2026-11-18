import React,{useEffect,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {openBrowserAsync,WebBrowserPresentationStyle} from 'expo-web-browser';
import {api,sessionScope} from './api';
import {Btn,SearchBox,Sheet,Spinner,useUi} from './ui';
import CatalogBrowser,{CatalogThumbnail} from './CatalogBrowser';
import FragDexLink from './FragDexLink';
import {catalogThumbnailPhotos} from '../../src/lib/catalog-photos';
import {fragranceFacets} from '../../src/lib/catalog-ratings';
import type {AppState,CatalogTarget,ComparisonReply} from '../../src/lib/types';

export default function CompareFragrances({left,state,onClose,notify}:{left:CatalogTarget;state:AppState;onClose:()=>void;notify:(message:string)=>void}){
 const {styles,colors}=useUi();
 const [query,setQuery]=useState(''),[right,setRight]=useState<CatalogTarget|null>(null),[catalog,setCatalog]=useState(false);
 const [lookup,setLookup]=useState<{key:string;reply?:ComparisonReply;error?:string}|null>(null),[attempt,setAttempt]=useState(0);
 const request=JSON.stringify({left,right}),key=request+':'+attempt;
 const reply=lookup?.key===key?lookup.reply:null,error=lookup?.key===key?lookup.error:'';
 useEffect(()=>{
  const body=JSON.parse(request);if(!body.right)return;let active=true;const current=sessionScope();
  void api<ComparisonReply>('compare','POST',body).then(reply=>{if(active&&current())setLookup({key,reply});})
   .catch(error=>{if(active&&current())setLookup({key,error:error.message});});
  return ()=>{active=false;};
 },[request,key]);
 if(catalog)return <CatalogBrowser onClose={()=>setCatalog(false)} onSelect={target=>{setRight(target);setCatalog(false);}} notify={notify}/>;
 const visit=(url:string)=>{void openBrowserAsync(url,{presentationStyle:WebBrowserPresentationStyle.PAGE_SHEET,toolbarColor:colors.surface,showTitle:true}).catch(()=>notify('Could not open this source.'));};
 const options=state.bottles.filter(bottle=>!(left.kind==='bottle'&&bottle.id===left.id)&&`${bottle.brand} ${bottle.name} ${bottle.concentration}`.toLowerCase().includes(query.toLowerCase()));
 return <Sheet title="Compare fragrances" onClose={onClose}>
  {!right?<>
   <Btn label="Choose from FragDex" kind="secondary" onPress={()=>setCatalog(true)}/>
   <SearchBox label="Find a bottle to compare" placeholder="Or search your collection" value={query} maxLength={120} onChange={setQuery} onClear={()=>setQuery('')}/>
   {options.map(bottle=><Pressable key={bottle.id} accessibilityRole="button" accessibilityLabel={'Compare with '+bottle.name}
    onPress={()=>setRight({kind:'bottle',id:bottle.id})} style={[styles.row,{minHeight:64,borderBottomWidth:1,borderBottomColor:colors.line}]}>
    <CatalogThumbnail path={bottle.catalogPhoto} name={bottle.name}/><View style={{flex:1}}><Text style={styles.h3}>{bottle.name}</Text>
     <Text style={styles.small}>{bottle.brand} · {bottle.concentration}</Text></View>
   </Pressable>)}
  </>:<Btn label="Change comparison" kind="quiet" onPress={()=>setRight(null)}/>}
  {right&&!reply&&!error&&<Spinner label="Comparing sourced profiles…"/>}
  {error&&<View style={styles.notice}><Text accessibilityRole="alert" style={styles.muted}>{error}</Text><Btn label="Retry" kind="quiet" onPress={()=>setAttempt(value=>value+1)}/></View>}
  {reply&&<>
   <View style={[styles.row,{alignItems:'flex-start'}]}>
    {[reply.left,reply.right].map((side,index)=><View key={index} style={{flex:1,gap:4,alignItems:'center'}}>
     <CatalogThumbnail path={catalogThumbnailPhotos(side.profile)[0]?.path} name={side.edition.name} size={80}/>
     <Text style={[styles.small,{textAlign:'center'}]}>{side.edition.brand}</Text><Text style={[styles.h3,{textAlign:'center'}]}>{side.edition.name}</Text>
     <Text style={styles.small}>{side.edition.concentration} · {side.profile?.releaseYear??'Year N/A'}</Text>
    </View>)}
   </View>
   <View style={styles.notice}><Text style={styles.h3}>{reply.noteOverlap===null?'Listed-note overlap · N/A':reply.noteOverlap+'% listed-note overlap'}</Text>
    <Text style={styles.small}>Recorded note names only. Missing facts remain unknown; this is not a smell-match or performance score.</Text></View>
   <Text style={styles.h3}>Shared notes</Text><Text style={styles.text}>{reply.sharedNotes.join(' · ')||(reply.noteOverlap===null?'Unknown':'None listed in common')}</Text>
   <View style={[styles.row,{alignItems:'flex-start'}]}>{[reply.left,reply.right].map((side,index)=><View key={index} style={{flex:1,gap:4}}>
    <Text style={styles.label}>{side.edition.name} · Distinct notes</Text>
    <Text style={styles.text}>{!reply.left.profile?.notes.length||!reply.right.profile?.notes.length?'N/A':(index?reply.rightOnly:reply.leftOnly).join(' · ')||'None'}</Text>
    {(['top','heart','base','listed'] as const).map(stage=>{
     const notes=side.profile?.notes.filter(note=>note.stage===stage)??[];
     return notes.length?<View key={stage}><Text style={styles.label}>{stage.toUpperCase()}</Text><Text style={styles.small}>{notes.map(note=>note.name).join(' · ')}</Text></View>:null;
    })}
   </View>)}</View>
   {fragranceFacets.map(([facet,label])=><View key={facet} style={{gap:5,paddingVertical:7,borderBottomWidth:1,borderBottomColor:colors.line}}>
    <Text style={styles.label}>{label}</Text><View style={[styles.row,{alignItems:'flex-start'}]}>{[reply.left,reply.right].map((side,index)=>{
     const ratings=side.profile?.ratings.filter(rating=>rating.facet===facet)??[];
     return <View key={index} style={{flex:1,gap:5}}>{!ratings.length&&<Text style={styles.muted}>N/A</Text>}
      {ratings.map(rating=>{const source=side.profile?.sources.find(source=>source.id===rating.sourceId);return source?<FragDexLink key={source.id} url={source.url} visit={visit} style={{minHeight:38}}>
       <Text style={styles.link}>{rating.score}/5{rating.kind==='estimate'?' · Est.':''}</Text><Text style={styles.small}>{source.publisher}</Text>
      </FragDexLink>:null;})}</View>;
    })}</View>
   </View>)}
  </>}
 </Sheet>;
}
