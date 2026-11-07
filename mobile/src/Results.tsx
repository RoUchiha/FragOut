import React,{useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {ChevronDown} from 'lucide-react-native';
import {BottleArt,Btn,useUi} from './ui';
import type {SoloResult,ComboResult,Tier} from '../../src/lib/types';

export type Feedback = (ids:string[],reaction:'wore'|'loved'|'disliked'|'saved',occasion:string,requestId?:string)=>void;
const tiers:Record<Tier,string> = {
 model_hypothesis:'Experimental · untested',
 single_anecdote:'Single user report',
 dupe_adapted_hypothesis:'Dupe-adapted · experimental',
 brand_guidance:'Brand-suggested',
 community_corroborated:'Community corroborated',
};

function ResultRow({title,subtitle,art,open,onToggle,children}:{
 title:string;subtitle:string;art:React.ReactNode;open:boolean;onToggle:()=>void;children:React.ReactNode;
}) {
 const {styles,colors} = useUi();
 return <View style={{borderBottomWidth:1,borderBottomColor:colors.line}}>
  <Pressable accessibilityRole="button" accessibilityLabel={'View '+title} accessibilityState={{expanded:open}}
   onPress={onToggle} style={[styles.row,{minHeight:61,paddingVertical:6,paddingHorizontal:1}]}>
   <View style={[styles.row,{gap:1,justifyContent:'center',minWidth:38}]}>{art}</View>
   <View style={{flex:1,minWidth:0,gap:2}}>
    <Text style={styles.h3}>{title}</Text>
    <Text style={styles.small} numberOfLines={2}>{subtitle}</Text>
   </View>
   <ChevronDown size={16} color={colors.muted} style={{transform:[{rotate:open?'180deg':'0deg'}]}}/>
  </Pressable>
  {open&&<View style={{paddingBottom:10,paddingHorizontal:3,gap:8}}>{children}</View>}
 </View>;
}

export function Results({solo,combos,occasion,requestId,onFeedback,busy,showPairs=false,onArchive}:{
 solo:SoloResult[];combos:ComboResult[];occasion:string;requestId?:string;onFeedback:Feedback;
 busy:boolean;showPairs?:boolean;onArchive?:(ids:string[],requestId?:string)=>void;
}) {
 const {styles} = useUi();
 const [expanded,setExpanded] = useState<string|null>(null);
 const toggle = (id:string) => setExpanded(current=>current===id?null:id);
 return <View>
  {solo.map(({bottle,reasons,caution})=>
   <ResultRow key={bottle.id} title={bottle.name}
    subtitle={[bottle.brand,bottle.concentration,bottle.family].filter(Boolean).join(' · ')}
    art={<BottleArt bottle={bottle} size={46}/>} open={expanded===bottle.id} onToggle={()=>toggle(bottle.id)}>
    {reasons.map(reason=><Text key={reason.ruleId} style={styles.muted}>{reason.text}</Text>)}
    <Text style={styles.small}>{caution}</Text>
    <View style={[styles.row,{flexWrap:'wrap'}]}>
     <Btn label="Wear this" disabled={busy} onPress={()=>onFeedback([bottle.id],'wore',occasion,requestId)}/>
     <Btn label="Not my style" kind="quiet" disabled={busy} onPress={()=>onFeedback([bottle.id],'disliked',occasion,requestId)}/>
     {onArchive&&<Btn label="Archive look" kind="quiet" disabled={busy} onPress={()=>onArchive([bottle.id],requestId)}/>}
    </View>
   </ResultRow>)}
  {showPairs&&combos.length===0&&<Text style={styles.muted}>No eligible pairs for these choices.</Text>}
  {combos.map(pair=>{
   const key = pair.a.id+':'+pair.b.id;
   const ids = [pair.a.id,pair.b.id];
   return <ResultRow key={key} title={pair.a.name+' + '+pair.b.name} subtitle={tiers[pair.tier]}
    art={<><BottleArt bottle={pair.a} size={36}/><BottleArt bottle={pair.b} size={36}/></>}
    open={expanded===key} onToggle={()=>toggle(key)}>
    <Text style={styles.small}>{pair.a.brand} {pair.a.concentration} · {pair.b.brand} {pair.b.concentration}</Text>
    <Text style={styles.muted}>{pair.reason}</Text>
    <Text style={styles.small}>{pair.caution}</Text>
    <View style={[styles.row,{flexWrap:'wrap'}]}>
     <Btn label="Tried it" disabled={busy} onPress={()=>onFeedback(ids,'wore',occasion,requestId)}/>
     <Btn label="Save pair" kind="secondary" disabled={busy} onPress={()=>onFeedback(ids,'saved',occasion,requestId)}/>
     <Btn label="Avoid pair" kind="quiet" disabled={busy} onPress={()=>onFeedback(ids,'disliked',occasion,requestId)}/>
     {onArchive&&<Btn label="Archive look" kind="quiet" disabled={busy} onPress={()=>onArchive(ids,requestId)}/>}
    </View>
   </ResultRow>;
  })}
 </View>;
}
