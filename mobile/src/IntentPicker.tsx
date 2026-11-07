import React from 'react';
import {Pressable,ScrollView,Text,View} from 'react-native';
import {defaultIntent,moodOptions,vibeOptions} from '../../src/lib/intent';
import type {ScentIntent} from '../../src/lib/types';
import {styles} from './ui';
export default function IntentPicker({value=defaultIntent,onChange}:{value:ScentIntent;onChange:(value:ScentIntent)=>void}){
 return <View style={{gap:7}}>{([['mood','Mood',moodOptions],['vibe','Vibe',vibeOptions]] as const).map(([field,label,options])=><View key={field} style={[styles.row,{gap:9}]}><Text style={[styles.label,{width:37,marginBottom:0}]}>{label}</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex:1}} contentContainerStyle={{gap:6,paddingRight:3}}>{options.map(([id,title])=><Pressable key={id} accessibilityRole="button" accessibilityLabel={label+': '+title} accessibilityState={{selected:value[field]===id}} onPress={()=>onChange({...value,[field]:value[field]===id?'ANY':id})} style={[styles.choice,{minHeight:40,justifyContent:'center'},value[field]===id&&styles.choiceActive]}><Text style={styles.choiceText}>{title}</Text></Pressable>)}</ScrollView></View>)}</View>;
}
