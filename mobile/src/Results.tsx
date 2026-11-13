import React,{useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {ChevronDown,Heart,Layers} from 'lucide-react-native';
import {BottleArt,Btn,Empty,useUi} from './ui';
import type {SoloResult,ComboResult,Tier,WearEvent} from '../../src/lib/types';
import {intentSummary} from '../../src/lib/intent';
import {openBrowserAsync} from 'expo-web-browser';
import FragDexLink from './FragDexLink';

export type Feedback = (ids:string[],reaction:'wore'|'loved'|'disliked'|'saved',occasion:string,requestId?:string)=>void;
export type ComboLikes = {
 items:readonly WearEvent[];
 set:(ids:string[],liked:boolean,occasion:string,requestId?:string)=>void;
};
const tiers:Record<Tier,string> = {
 model_hypothesis:'Experimental · untested',
 single_anecdote:'Single user report',
 dupe_adapted_hypothesis:'Dupe-adapted · experimental',
 brand_guidance:'Brand-suggested',
 community_corroborated:'Community corroborated',
};

function ComboHeart({title,liked,busy,onPress}:{
 title:string;liked:boolean;busy:boolean;onPress:()=>void;
}) {
 const {styles,colors} = useUi();
 return <Pressable accessibilityRole="button" accessibilityLabel={(liked?'Unlike ':'Like ')+title}
  accessibilityState={{selected:liked,disabled:busy}} disabled={busy} onPress={onPress}
  style={[styles.iconButton,{minHeight:44,minWidth:44},busy&&{opacity:.5}]}>
  <Heart size={18} color={colors.link} fill={liked?colors.link:'none'}/>
 </Pressable>;
}

function ResultRow({title,subtitle,art,action,open,onToggle,children}:{
 title:string;subtitle:string;art:React.ReactNode;action?:React.ReactNode;
 open:boolean;onToggle:()=>void;children:React.ReactNode;
}) {
 const {styles,colors} = useUi();
 return <View style={{borderBottomWidth:1,borderBottomColor:colors.line}}>
  <View style={[styles.row,{gap:2}]}>
   <Pressable accessibilityRole="button" accessibilityLabel={'View '+title} accessibilityState={{expanded:open}}
    onPress={onToggle} style={[styles.row,{flex:1,minWidth:0,minHeight:61,paddingVertical:6,paddingHorizontal:1}]}>
    <View style={[styles.row,{gap:1,justifyContent:'center',minWidth:38}]}>{art}</View>
    <View style={{flex:1,minWidth:0,gap:2}}>
     <Text style={styles.h3}>{title}</Text>
     <Text style={styles.small} numberOfLines={2}>{subtitle}</Text>
    </View>
    <ChevronDown size={16} color={colors.muted} style={{transform:[{rotate:open?'180deg':'0deg'}]}}/>
   </Pressable>
   {action}
  </View>
  {open&&<View style={{paddingBottom:10,paddingHorizontal:3,gap:8}}>{children}</View>}
 </View>;
}

export function Results({solo,combos,occasion,requestId,onFeedback,comboLikes,busy,showPairs=false,onArchive}:{
 solo:SoloResult[];combos:ComboResult[];occasion:string;requestId?:string;onFeedback:Feedback;
 comboLikes:ComboLikes;busy:boolean;showPairs?:boolean;onArchive?:(ids:string[],requestId?:string)=>void;
}) {
 const {styles} = useUi();
 const [expanded,setExpanded] = useState<string|null>(null);
 const [sourceError,setSourceError] = useState('');
 const visit=(url:string)=>{
  setSourceError('');
  void openBrowserAsync(url).catch(()=>setSourceError('Could not open this source.'));
 };
 const toggle = (id:string) => setExpanded(current=>current===id?null:id);
 return <View>
  {!!sourceError&&<Text accessibilityRole="alert" style={styles.muted}>{sourceError}</Text>}
  {solo.map(({bottle,reasons,caution})=>
   <ResultRow key={bottle.id} title={bottle.name}
    subtitle={[bottle.brand,bottle.concentration,bottle.family].filter(Boolean).join(' · ')}
    art={<BottleArt bottle={bottle} size={46}/>} open={expanded===bottle.id} onToggle={()=>toggle(bottle.id)}>
    {reasons.map(reason=><Text key={reason.ruleId} style={styles.muted}>{reason.text}</Text>)}
    {bottle.catalogSource&&<FragDexLink url={bottle.catalogSource.url} visit={visit}>
     <Text style={styles.link}>Notes source · {bottle.catalogSource.label}</Text>
    </FragDexLink>}
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
   const title = pair.a.name+' + '+pair.b.name;
   const liked = comboLikes.items.some(item=>ids.every(id=>item.bottleIds.includes(id)));
   return <ResultRow key={key} title={title} subtitle={tiers[pair.tier]}
    art={<><BottleArt bottle={pair.a} size={36}/><BottleArt bottle={pair.b} size={36}/></>}
    action={<ComboHeart title={title} liked={liked} busy={busy} onPress={()=>comboLikes.set(ids,!liked,occasion,requestId)}/>}
    open={expanded===key} onToggle={()=>toggle(key)}>
    <Text style={styles.small}>{pair.a.brand} {pair.a.concentration} · {pair.b.brand} {pair.b.concentration}</Text>
    <Text style={styles.muted}>{pair.reason}</Text>
    {pair.sources.map((url,index)=><FragDexLink key={url} url={url} visit={visit}>
     <Text style={styles.link}>{pair.sources.length===1?'View pairing source':'Pairing source '+(index+1)}</Text>
    </FragDexLink>)}
    <Text style={styles.small}>{pair.caution}</Text>
    <View style={[styles.row,{flexWrap:'wrap'}]}>
     <Btn label="Tried it" disabled={busy} onPress={()=>onFeedback(ids,'wore',occasion,requestId)}/>
     <Btn label="Avoid pair" kind="quiet" disabled={busy} onPress={()=>onFeedback(ids,'disliked',occasion,requestId)}/>
     {onArchive&&<Btn label="Archive look" kind="quiet" disabled={busy} onPress={()=>onArchive(ids,requestId)}/>}
    </View>
   </ResultRow>;
  })}
 </View>;
}

export function LikedCombos({comboLikes,busy}:{comboLikes:ComboLikes;busy:boolean}) {
 const {styles,colors} = useUi();
 return <View style={{gap:12}}>
  <Text accessibilityRole="header" style={styles.h1}>Liked combos</Text>
  {comboLikes.items.length===0 ? <Empty title="No liked combos yet" detail="Tap a heart on a layering suggestion in Find a scent."/> :
   <View>{comboLikes.items.map(combo=>{
    const title = combo.names.join(' + ');
    const occasion = combo.occasion==='GENERAL'?'Everyday':combo.occasion.charAt(0)+combo.occasion.slice(1).toLowerCase();
    return <View key={combo.id} style={[styles.row,{minHeight:61,borderBottomWidth:1,borderBottomColor:colors.line}]}>
     <Layers size={20} color={colors.link}/>
     <View style={{flex:1,minWidth:0,gap:2}}>
      <Text style={styles.h3}>{title}</Text>
      <Text style={styles.small}>{[occasion,intentSummary(combo.context)].filter(Boolean).join(' · ')}</Text>
     </View>
     <ComboHeart title={title} liked busy={busy} onPress={()=>comboLikes.set(combo.bottleIds,false,combo.occasion)}/>
    </View>;
   })}</View>}
 </View>;
}
