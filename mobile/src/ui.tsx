import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {
 ActivityIndicator, AppState as NativeAppState, Image, KeyboardAvoidingView, Modal, Platform,
 Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {ArrowRight,Search,X} from 'lucide-react-native';
import Svg,{Rect,Ellipse,Text as SvgText} from 'react-native-svg';
import {paletteFor,themePeriod,type Palette} from '../../src/lib/palette';
import type {Bottle} from '../../src/lib/types';
import {serverUrl} from './api';

function createUi(colors:Palette) {
 const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:colors.paper},
  content:{padding:18,paddingBottom:26,gap:14},
  row:{flexDirection:'row',alignItems:'center',gap:9},
  spread:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  h1:{fontSize:25,fontWeight:'600',letterSpacing:-0.8,color:colors.ink},
  h2:{fontSize:20,fontWeight:'600',letterSpacing:-0.4,color:colors.ink},
  h3:{fontSize:16,fontWeight:'600',color:colors.ink},
  text:{fontSize:13,color:colors.ink,lineHeight:20},
  muted:{fontSize:12,color:colors.muted,lineHeight:18},
  small:{fontSize:11,color:colors.muted,lineHeight:16},
  label:{fontSize:11,fontWeight:'500',color:colors.muted},
  field:{gap:7},
  input:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.inputLine,borderRadius:6,padding:11,fontSize:14,color:colors.ink,minHeight:43},
  search:{flexDirection:'row',alignItems:'center',gap:8,minHeight:45,borderWidth:1,borderColor:colors.inputLine,borderRadius:8,backgroundColor:colors.surface,paddingLeft:12,paddingRight:4},
  searchInput:{flex:1,minWidth:0,minHeight:43,paddingVertical:8,fontSize:14,color:colors.ink},
  iconButton:{alignItems:'center',justifyContent:'center',minWidth:38,minHeight:38,borderRadius:6},
  button:{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:7,minHeight:40,paddingVertical:10,paddingHorizontal:12,borderRadius:6},
  primary:{backgroundColor:colors.accent,borderWidth:1,borderColor:colors.accentLine},
  secondary:{borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface},
  quiet:{backgroundColor:'transparent',paddingHorizontal:5},
  danger:{backgroundColor:colors.dangerSurface},
  buttonText:{color:colors.ink,fontSize:12,fontWeight:'500'},
  choice:{borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface,borderRadius:6,paddingVertical:9,paddingHorizontal:12,minHeight:38,justifyContent:'center'},
  choiceActive:{backgroundColor:colors.accent,borderColor:colors.accentLine},
  choiceText:{fontSize:11,color:colors.muted},
  card:{backgroundColor:colors.surface,borderColor:colors.line,borderWidth:1,borderRadius:8,padding:15,gap:10},
  section:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:2},
  sectionTitle:{fontSize:14,fontWeight:'600',color:colors.ink},
  link:{fontSize:12,color:colors.link},
  empty:{borderWidth:1,borderStyle:'dashed',borderColor:colors.line,borderRadius:7,minHeight:118,alignItems:'center',justifyContent:'center',padding:18,gap:6},
  emptyTitle:{fontSize:16,color:colors.ink,fontWeight:'500',textAlign:'center'},
  loading:{padding:20,gap:9,alignItems:'center'},
  notice:{padding:11,backgroundColor:colors.wash,borderWidth:1,borderColor:colors.line,borderRadius:6},
  warm:{padding:11,backgroundColor:colors.warning,borderWidth:1,borderColor:colors.line,borderRadius:6},
  backdrop:{flex:1,backgroundColor:colors.scrim,justifyContent:'flex-end'},
  sheet:{maxHeight:'94%',minHeight:250,width:'100%',maxWidth:640,alignSelf:'center',backgroundColor:colors.paper,borderTopLeftRadius:14,borderTopRightRadius:14},
  sheetTitle:{paddingHorizontal:18,paddingTop:15,paddingBottom:9,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  sheetBody:{padding:18,paddingTop:5,gap:14,paddingBottom:27},
  separator:{height:1,backgroundColor:colors.line},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:12},
  tile:{width:'48%',minWidth:130,flexGrow:1,maxWidth:'49%'},
  bottleStage:{height:136,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.line,borderRadius:7},
  image:{height:190,width:'100%',borderRadius:6,backgroundColor:colors.wash},
  tabbar:{flexShrink:0,flexDirection:'row',borderTopWidth:1,borderTopColor:colors.line,backgroundColor:colors.surface,paddingHorizontal:10,paddingVertical:5,gap:8},
  tab:{flex:1,minHeight:44,alignItems:'center',justifyContent:'center',borderRadius:7},
  activeTab:{backgroundColor:colors.accent},
  topbar:{paddingHorizontal:18,paddingVertical:5,minHeight:49,borderBottomWidth:1,borderBottomColor:colors.line,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  brand:{fontSize:20,fontWeight:'700',letterSpacing:-0.7,color:colors.ink},
  demo:{backgroundColor:colors.wash,paddingVertical:5,paddingHorizontal:18,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  toast:{padding:10,margin:12,marginBottom:0,backgroundColor:colors.ink,borderRadius:6,flexDirection:'row',alignItems:'center',gap:8},
  toastText:{color:colors.paper,fontSize:12,flex:1,lineHeight:18},
 });
 return {colors,styles};
}

const UiContext = createContext(createUi(paletteFor(themePeriod(new Date()))));
export const UiProvider = UiContext.Provider;
export const useUi = () => useContext(UiContext);

export function useSeasonalUi(latitude?:number) {
 const [clock,setClock] = useState(() => new Date());

 useEffect(() => {
  const refresh = () => setClock(new Date());
  const timer = setInterval(refresh,30_000);
  const subscription = NativeAppState.addEventListener('change', state => {
   if (state==='active') refresh();
  });
  return () => {
   clearInterval(timer);
   subscription.remove();
  };
 }, []);

 const {season,part} = themePeriod(clock,latitude);
 return useMemo(() => createUi(paletteFor({season,part})),[season,part]);
}

export function IconButton({label,icon,onPress,disabled}:{
 label:string; icon:React.ReactNode; onPress:()=>void; disabled?:boolean;
}) {
 const {styles} = useUi();
 return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
  disabled={disabled} style={({pressed})=>[styles.iconButton,pressed&&{opacity:.68},disabled&&{opacity:.5}]}>
  {icon}
 </Pressable>;
}

export function Btn({label,onPress,kind='primary',disabled=false,icon,style}:{
 label:string; onPress:()=>void; kind?:'primary'|'secondary'|'quiet'|'danger';
 disabled?:boolean; icon?:React.ReactNode; style?:ViewStyle;
}) {
 const {styles,colors} = useUi();
 const ink = {primary:colors.accentInk,secondary:colors.ink,quiet:colors.link,danger:colors.danger}[kind];
 return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
  style={({pressed})=>[styles.button,styles[kind],pressed&&{opacity:.72},disabled&&{opacity:.5},style]}>
  {icon}<Text style={[styles.buttonText,{color:ink}]}>{label}</Text>
 </Pressable>;
}

export function Field({label,...props}:TextInputProps&{label:string}) {
 const {styles,colors} = useUi();
 return <View style={styles.field}>
  <Text style={styles.label}>{label}</Text>
  <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} keyboardAppearance={colors.isDark?'dark':'light'}
   style={[styles.input,props.multiline&&{height:100,textAlignVertical:'top'}]} {...props}/>
 </View>;
}

export function SearchBox({label,placeholder,value,onChange,onSubmit,onClear,maxLength}:{
 label:string; placeholder:string; value:string; onChange:(text:string)=>void;
 onSubmit?:()=>void; onClear:()=>void; maxLength:number;
}) {
 const {styles,colors} = useUi();
 return <View style={styles.search}>
  <Search size={17} color={colors.muted}/>
  <TextInput accessibilityLabel={label} placeholder={placeholder} placeholderTextColor={colors.muted}
   value={value} onChangeText={onChange} maxLength={maxLength} autoCorrect={false}
   keyboardAppearance={colors.isDark?'dark':'light'} returnKeyType={onSubmit?'search':'done'}
   onSubmitEditing={onSubmit} style={styles.searchInput}/>
  {value.length>0&&<IconButton label="Clear search" onPress={onClear} icon={<X size={16} color={colors.muted}/>}/>}
  {onSubmit&&<IconButton label="Find fragrances" onPress={onSubmit} icon={<ArrowRight size={19} color={colors.link}/>}/>}
 </View>;
}

export function Choices<T extends string>({label,value,items,onChange}:{
 label?:string; value:T; items:readonly (readonly [T,string])[]; onChange:(value:T)=>void;
}) {
 const {styles,colors} = useUi();
 return <View style={styles.field}>
  {label&&<Text style={styles.label}>{label}</Text>}
  <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:7,paddingVertical:2}}>
   {items.map(([id,title])=><Pressable key={id} accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{selected:value===id}} onPress={()=>onChange(id)} style={[styles.choice,value===id&&styles.choiceActive]}>
    <Text style={[styles.choiceText,value===id&&{color:colors.accentInk,fontWeight:'600'}]}>{title}</Text>
   </Pressable>)}
  </ScrollView>
 </View>;
}

export function Empty({title,detail}:{title:string;detail:string}) {
 const {styles} = useUi();
 return <View style={styles.empty}><Text style={styles.emptyTitle}>{title}</Text><Text style={[styles.muted,{textAlign:'center'}]}>{detail}</Text></View>;
}

export function Section({title,action,onAction}:{title:string;action?:string;onAction?:()=>void}) {
 const {styles} = useUi();
 return <View style={styles.section}>
  <Text style={styles.sectionTitle}>{title}</Text>
  {action&&<Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}><Text style={styles.link}>{action}</Text></Pressable>}
 </View>;
}

export function Sheet({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}) {
 const {styles,colors} = useUi();
 return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
  <View style={styles.backdrop}>
   <SafeAreaView style={styles.sheet} edges={['bottom']}>
    <View style={styles.sheetTitle}>
     <Text accessibilityRole="header" style={styles.h2}>{title}</Text>
     <IconButton label="Close" onPress={onClose} icon={<X size={21} color={colors.muted}/>}/>
    </View>
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{flex:1}}>
     <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>{children}</ScrollView>
    </KeyboardAvoidingView>
   </SafeAreaView>
  </View>
 </Modal>;
}

export function catalogPhotoUrl(path?:string) {
 return path&&/^\/catalog\/bottles\/[a-z0-9-]+\.jpg$/.test(path)?serverUrl()+path:undefined;
}

export function BottleArt({bottle,size=125}:{bottle:Pick<Bottle,'name'|'color'|'shape'|'catalogPhoto'>;size?:number}) {
 const {colors} = useUi();
 const [failedPhoto,setFailedPhoto]=useState<string>();
 const uri=catalogPhotoUrl(bottle.catalogPhoto);
 if(uri&&uri!==failedPhoto) return <Image accessible accessibilityLabel={'Reference bottle photo of '+bottle.name}
  source={{uri}} resizeMode="contain" style={{width:size*.88,height:size,borderRadius:4}}
  onError={()=>setFailedPhoto(uri)}/>;
 const round = bottle.shape==='round';
 const tall = bottle.shape==='tall';
 const cap = colors.isDark ? colors.muted : colors.ink;
 return <Svg width={size*.74} height={size} viewBox="0 0 160 215" accessibilityLabel={'Illustration of '+bottle.name}>
  <Ellipse cx={80} cy={202} rx={44} ry={6} fill={colors.ink} opacity={.1}/>
  <Rect x={54} y={13} width={52} height={29} rx={round?12:3} fill={cap}/>
  <Rect x={69} y={42} width={22} height={17} fill={bottle.color}/>
  <Rect x={tall?44:round?25:34} y={58} width={tall?72:round?110:92} height={136} rx={round?34:6}
   fill={bottle.color} fillOpacity={.67} stroke={bottle.color}/>
  <Rect x={tall?49:39} y={106} width={tall?62:82} height={56} fill="#f7f6ee"/>
  <SvgText x={80} y={121} textAnchor="middle" fontSize={6} fill="#33402f" letterSpacing={1}>FRAGOUT</SvgText>
  {bottle.name.split(' ').slice(0,3).map((word,index)=>
   <SvgText key={index} x={80} y={136+index*10} textAnchor="middle" fontSize={8} fill="#33402f">{word.toUpperCase()}</SvgText>)}
 </Svg>;
}

export function Spinner({label='Loading…'}:{label?:string}) {
 const {styles,colors} = useUi();
 return <View style={styles.loading}><ActivityIndicator color={colors.link}/><Text style={styles.muted}>{label}</Text></View>;
}
