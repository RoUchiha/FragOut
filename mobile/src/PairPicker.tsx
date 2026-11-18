import React,{useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {Check} from 'lucide-react-native';
import {matchesBottleSearch} from '../../src/lib/scent-search';
import type {Bottle} from '../../src/lib/types';
import {Btn,Empty,SearchBox,Sheet,useUi} from './ui';

export default function PairPicker({bottles,onClose,onCheck}:{bottles:Bottle[];onClose:()=>void;onCheck:(ids:[string,string])=>void}) {
 const {styles,colors}=useUi();
 const [query,setQuery]=useState(''),[selected,setSelected]=useState<string[]>([]);
 const owned=bottles.filter(bottle=>bottle.ownership==='OWNED');
 const visible=owned.filter(bottle=>matchesBottleSearch(bottle,query));
 function toggle(id:string){setSelected(current=>current.includes(id)?current.filter(value=>value!==id):current.length<2?[...current,id]:current);}
 return <Sheet title="Check a pair" onClose={onClose}>
  <SearchBox label="Find bottles to layer" placeholder="Search owned fragrances" value={query}
   onChange={setQuery} onClear={()=>setQuery('')} maxLength={120}/>
  <Text style={styles.small}>Choose two distinct fragrances · {selected.length}/2</Text>
  {selected.length>0&&<Text style={styles.text}>{selected.map(id=>owned.find(bottle=>bottle.id===id)?.name).join(' + ')}</Text>}
  {owned.length<2&&<Empty title="Add two owned fragrances" detail="Pair checks use the bottles in your collection."/>}
  {visible.map(bottle=>{
   const checked=selected.includes(bottle.id);
   const disabled=!checked&&(selected.length===2||owned.some(selectedBottle=>
    selected.includes(selectedBottle.id)&&selectedBottle.variantId===bottle.variantId));
   return <Pressable key={bottle.id} accessibilityRole="checkbox" accessibilityLabel={bottle.brand+' '+bottle.name+' '+bottle.concentration}
    accessibilityState={{checked,disabled}} disabled={disabled} onPress={()=>toggle(bottle.id)}
    style={[styles.spread,{minHeight:58,borderBottomWidth:1,borderBottomColor:colors.line,opacity:disabled?0.5:1}]}>
    <View style={{flex:1,gap:3}}><Text style={styles.h3}>{bottle.name}</Text><Text style={styles.small}>{bottle.brand} · {bottle.concentration}</Text></View>
    {checked&&<Check size={19} color={colors.link}/>}
   </Pressable>;
  })}
  {owned.length>=2&&visible.length===0&&<Text style={styles.small}>No bottles match this search.</Text>}
  <Text style={styles.small}>Includes experimental pairings. Your venue rules and exclusions still apply.</Text>
  <Btn label="Check selected pair" disabled={selected.length!==2} onPress={()=>onCheck([selected[0],selected[1]])}/>
 </Sheet>;
}
