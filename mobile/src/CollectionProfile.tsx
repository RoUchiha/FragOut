import React,{useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {collectionProfile} from '../../src/lib/collection-browse';
import type {Bottle} from '../../src/lib/types';
import {Choices,Sheet,useUi} from './ui';

export default function CollectionProfile({bottles,ownership,onClose,onFilter}:{
 bottles:Bottle[];ownership:string;onClose:()=>void;onFilter:(type:'note'|'brand'|'family'|'shelf',value:string)=>void;
}){
 const {styles,colors}=useUi();const [stage,setStage]=useState('any');
 const profile=collectionProfile(bottles,ownership,stage);
 return <Sheet title="Collection profile" onClose={onClose}>
  <View style={styles.row}>{[[profile.total,'fragrances'],[profile.remainingMl+' ml','remaining'],[profile.averageRating===null?'—':profile.averageRating+'/5','my average']].map(([value,label])=><View key={label} style={{flex:1,gap:3}}>
   <Text style={styles.h2}>{value}</Text><Text style={styles.small}>{label}</Text></View>)}</View>
  <Text style={styles.small}>{profile.catalogCoverage}/{profile.total} with catalog notes · {profile.ratedBottles} personally rated</Text>
  <Choices label="Notes" value={stage} items={[[ 'any','All notes'],['top','Top'],['heart','Heart'],['base','Base']]} onChange={setStage}/>
  <Text style={styles.small}>{stage==='any'?'Catalog notes and your observations.':'Recorded catalog note positions only.'} Counts show bottles, not strength or ingredients.</Text>
  {([['note','Notes',profile.notes],['brand','Houses',profile.brands],['family','My scent families',profile.families],['shelf','Shelves',profile.shelves]] as const).map(([type,title,items])=><View key={type} style={{gap:5}}>
   <Text style={styles.h3}>{title}</Text>{!items.length&&<Text style={styles.muted}>No data yet.</Text>}
   {items.slice(0,12).map(item=><Pressable key={item.name} accessibilityRole="button" accessibilityLabel={'Filter '+type+' '+item.name}
    onPress={()=>onFilter(type,item.name)} style={[styles.spread,{minHeight:39,borderBottomWidth:1,borderBottomColor:colors.line}]}>
    <View style={{flex:1,gap:5}}><Text style={styles.link}>{item.name}</Text><View style={{height:3,width:Math.max(2,item.count/Math.max(1,profile.total)*100)+'%',backgroundColor:colors.accentLine}}/></View>
    <Text style={styles.small}>{item.count}</Text>
   </Pressable>)}
  </View>)}
 </Sheet>;
}
