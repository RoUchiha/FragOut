import React,{useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {ChevronDown,ExternalLink} from 'lucide-react-native';
import {concentrationOptions} from '../../src/lib/concentrations';
import type {CatalogDupe,CatalogDupeLinks} from '../../src/lib/types';
import FragDexLink from './FragDexLink';
import {Section,useUi} from './ui';

export default function FragDexDupes({dupes,visit}:{
 dupes:CatalogDupeLinks;
 visit:(url:string)=>void;
}){
 const {styles,colors}=useUi();
 const [expanded,setExpanded]=useState(false);
 const {alternatives,originals}=dupes;
 if(!alternatives.length&&!originals.length) return null;

 return <View style={{gap:7}}>
  <View style={styles.separator}/>
  {originals.length>0&&<>
   <Section title="Dupe of"/>
   <Matches items={originals} visit={visit}/>
  </>}
  {alternatives.length>0&&<>
   <Pressable accessibilityRole="button" accessibilityLabel={'Affordable dupes, '+alternatives.length}
    accessibilityState={{expanded}} onPress={()=>setExpanded(current=>!current)}
    style={[styles.spread,{minHeight:44}]}>
    <Text style={styles.link}>Affordable dupes · {alternatives.length}</Text>
    <ChevronDown size={16} color={colors.link} style={{transform:[{rotate:expanded?'180deg':'0deg'}]}}/>
   </Pressable>
   {expanded&&<Matches items={alternatives} visit={visit}/>}
  </>}
 </View>;
}

function Matches({items,visit}:{items:CatalogDupe[];visit:(url:string)=>void}){
 const {styles,colors}=useUi();
 return <View style={{gap:8}}>
  {items.map(match=>{
   const format=concentrationOptions.find(([code])=>code===match.concentration)?.[1]??match.concentration;
   return <View key={JSON.stringify([match.brand,match.name,match.concentration])}
    style={{borderBottomWidth:1,borderBottomColor:colors.line,paddingBottom:6}}>
    <Text style={styles.text}>{match.name}</Text>
    <Text style={styles.small}>{match.brand} · {format} · {match.evidence==='brand'?'Brand-stated inspiration':'Community comparison'}</Text>
    <View style={[styles.row,{flexWrap:'wrap',gap:12}]}>
     {match.sources.map(source=><FragDexLink key={source.url} url={source.url} visit={visit}
      accessibilityLabel={source.publisher+' source for '+match.name}
      style={[styles.row,{gap:4,minHeight:32}]}>
      <Text style={styles.link}>{source.publisher}</Text>
      <ExternalLink size={10} color={colors.link}/>
     </FragDexLink>)}
    </View>
   </View>;
  })}
 </View>;
}
