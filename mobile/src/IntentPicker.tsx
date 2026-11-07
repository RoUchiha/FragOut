import React from 'react';
import {Pressable,ScrollView,Text,View} from 'react-native';
import {defaultIntent,moodOptions,vibeOptions} from '../../src/lib/intent';
import type {ScentIntent} from '../../src/lib/types';
import {useUi} from './ui';
export default function IntentPicker({value=defaultIntent,onChange}:{value:ScentIntent;onChange:(value:ScentIntent)=>void}){
 const {styles,colors} = useUi();
 return <View style={{gap:7}}>
  {([['mood','Mood',moodOptions],['vibe','Vibe',vibeOptions]] as const).map(([field,label,options])=>
   <View key={field} style={styles.row}>
    <Text style={[styles.label,{width:37}]}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled"
     style={{flex:1,minWidth:0}} contentContainerStyle={{gap:6,paddingRight:3}}>
     {options.map(([id,title])=>{
      const selected = value[field]===id;
      return <Pressable key={id} accessibilityRole="button" accessibilityLabel={label+': '+title}
       accessibilityState={{selected}} onPress={()=>onChange({...value,[field]:selected?'ANY':id})}
       style={[styles.choice,selected&&styles.choiceActive]}>
       <Text style={[styles.choiceText,selected&&{color:colors.accentInk}]}>{title}</Text>
      </Pressable>;
     })}
    </ScrollView>
   </View>)}
 </View>;
}
