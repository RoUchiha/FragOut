import React,{useEffect,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {openBrowserAsync} from 'expo-web-browser';
import {ChevronDown} from 'lucide-react-native';
import {api} from './api';
import FragDexLink from './FragDexLink';
import {Btn,Choices,Empty,SearchBox,Sheet,Spinner,useUi} from './ui';
import type {LayeringLibraryEntry,LayeringLibrarySide} from '../../src/lib/types';

type Page={entries:LayeringLibraryEntry[];total:number;nextOffset:number|null};

function Fragrance({side,visit}:{side:LayeringLibrarySide;visit:(url:string)=>void}) {
 const {styles}=useUi();
 return <View style={{gap:5}}>
  <Text style={styles.h3}>{side.label}</Text>
  {side.editions.map(edition=><View key={edition.id} style={{gap:4}}>
   <Text style={styles.small}>{edition.concentration}{side.editions.length>1?' · Catalog edition':''}</Text>
   {edition.dupes.originals.map(original=><Text key={original.brand+original.name} style={styles.small}>
    Dupe of {original.brand} {original.name} · {original.concentration}
   </Text>)}
  </View>)}
  {side.alternatives.length>0&&<Text style={styles.small}>Dupe options</Text>}
  {side.alternatives.map(dupe=><View key={dupe.brand+dupe.name+dupe.concentration} style={{gap:2}}>
    <Text style={styles.text}>{dupe.brand} {dupe.name} · {dupe.concentration}</Text>
    {dupe.originalConcentration&&<Text style={styles.small}>For the {dupe.originalConcentration} edition</Text>}
    <FragDexLink url={dupe.sources[0].url} visit={visit}>
     <Text style={styles.link}>{dupe.evidence==='brand'?'Brand-stated inspiration':'Community comparison'} · Source</Text>
    </FragDexLink>
  </View>)}
  {side.alternatives.length===0&&<Text style={styles.small}>No sourced dupe in FragOut yet.</Text>}
 </View>;
}

export default function LayeringExplorer({onClose,onCheck}:{onClose:()=>void;onCheck:(ids:[string,string])=>void}) {
 const {styles,colors}=useUi();
 const [query,setQuery]=useState(''),[scope,setScope]=useState<'all'|'owned'>('all');
 const [offset,setOffset]=useState(0),[page,setPage]=useState<Page|null>(null),[error,setError]=useState('');
 const [expanded,setExpanded]=useState<string|null>(null);
 const [attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let active=true;
  const timer=setTimeout(()=>{
   void api<Page>('layering/search?q='+encodeURIComponent(query)+'&owned='+(scope==='owned')+'&offset='+offset)
    .then(result=>{if(active)setPage(result);}).catch(problem=>{if(active)setError(problem.message);});
  },250);
  return ()=>{active=false;clearTimeout(timer);};
 },[query,scope,offset,attempt]);
 const visit=(url:string)=>{void openBrowserAsync(url).catch(()=>setError('Could not open this source.'));};
 function reset(){setPage(null);setError('');setExpanded(null);}
 function search(value:string){if(value===query&&offset===0)return;reset();setQuery(value);setOffset(0);}
 return <Sheet title="Explore layers" onClose={onClose}>
  <SearchBox label="Search layering library" placeholder="Fragrance, brand, or note" value={query}
   onChange={search} onClear={()=>search('')} maxLength={120}/>
  <Choices value={scope} items={[['all','All pairings'],['owned','From my collection']]}
   onChange={value=>{if(value===scope)return;reset();setScope(value);setOffset(0);}}/>
  <Text style={styles.small}>Published AI predictions · Will It Layer?</Text>
  {error?<View><Text accessibilityRole="alert" style={styles.muted}>{error}</Text>
   <Btn label="Retry" kind="quiet" onPress={()=>{reset();setAttempt(value=>value+1);}}/>
  </View>:!page?<Spinner label="Loading pairings…"/>:
   page.entries.length===0?<Empty title="No matching layers" detail="Try another fragrance or browse all pairings."/>:
   <View style={{gap:12}}>
    <Text style={styles.small}>{page.total} pairings</Text>
    {page.entries.map(entry=>{
     const open=expanded===entry.id;
     const first=entry.a.owned.find(a=>entry.b.owned.some(b=>a.id!==b.id&&a.variantId!==b.variantId));
     const second=first?entry.b.owned.find(b=>b.id!==first.id&&b.variantId!==first.variantId):undefined;
     return <View key={entry.id} style={[styles.card,{gap:10}]}>
      <Pressable accessibilityRole="button" accessibilityLabel={'Pair details for '+entry.a.label+' and '+entry.b.label}
       accessibilityState={{expanded:open}} onPress={()=>setExpanded(open?null:entry.id)} style={styles.spread}>
       <View style={{flex:1,gap:3}}>
        <Text style={styles.h3}>{entry.a.label}</Text>
        <Text style={styles.text}>+ {entry.b.label}</Text>
        {entry.reference.score!==null&&<Text style={styles.small}>Source prediction {entry.reference.score}/{entry.reference.scale}</Text>}
       </View>
       <ChevronDown size={16} color={colors.link} style={{transform:[{rotate:open?'180deg':'0deg'}]}}/>
      </Pressable>
      {first&&second&&<Btn label="Check owned pair" kind="secondary" onPress={()=>onCheck([first.id,second.id])}/>}
      {open&&<>
       <View style={styles.separator}/>
       <Fragrance side={entry.a} visit={visit}/><Fragrance side={entry.b} visit={visit}/>
       {entry.reference.editionUnconfirmed&&<Text style={styles.small}>The source leaves a concentration unspecified. Catalog editions are shown separately.</Text>}
       <Text style={styles.small}>Dupe substitutions are experimental. The published score belongs to the source pair.</Text>
       <FragDexLink url={entry.reference.url} visit={visit}><Text style={styles.link}>View on Will It Layer?</Text></FragDexLink>
      </>}
     </View>;
    })}
    <View style={[styles.row,{justifyContent:'space-between'}]}>
     <Btn label="Previous" kind="quiet" disabled={offset===0} onPress={()=>{reset();setOffset(value=>Math.max(0,value-12));}}/>
     <Btn label="Next" kind="quiet" disabled={page.nextOffset===null} onPress={()=>{reset();setOffset(page.nextOffset!);}}/>
    </View>
   </View>}
 </Sheet>;
}
