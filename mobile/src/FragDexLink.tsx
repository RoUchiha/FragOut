import React from 'react';
import {Platform,Pressable,StyleSheet,type StyleProp,type ViewStyle} from 'react-native';
import {catalogReferenceUrl} from '../../src/lib/catalog-ratings';

export default function FragDexLink({url,visit,children,style,accessibilityLabel,accessibilityHint,hitSlop}:{
 url:string;visit:(url:string)=>void;children:React.ReactNode;style?:StyleProp<ViewStyle>;
 accessibilityLabel?:string;accessibilityHint?:string;hitSlop?:number;
}){
 const destination=catalogReferenceUrl(url);
 if(!destination) return null;
 if(Platform.OS==='web') {
  const anchorStyle={
   display:'flex',flexDirection:'column',color:'inherit',textDecoration:'none',...StyleSheet.flatten(style),
  } as React.CSSProperties;
  return <a href={destination} target="_blank" rel="noopener noreferrer" aria-label={accessibilityLabel}
   style={anchorStyle}>{children}</a>;
 }
 return <Pressable accessibilityRole="link" accessibilityLabel={accessibilityLabel}
  accessibilityHint={accessibilityHint} hitSlop={hitSlop} style={style}
  onPress={()=>visit(destination)}>{children}</Pressable>;
}
