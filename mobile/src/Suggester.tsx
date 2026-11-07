import React,{useEffect,useState} from 'react';
import {Keyboard,Pressable,Text,View} from 'react-native';
import {ChevronDown,Shirt,SlidersHorizontal} from 'lucide-react-native';
import {resolveScentSearch,scentSearchLimit} from '../../src/lib/scent-search';
import {intentSummary} from '../../src/lib/intent';
import type {ComboResult,ScentIntent,SoloResult,WearContext} from '../../src/lib/types';
import {api,type AppState} from './api';
import IntentPicker from './IntentPicker';
import {Results,type ComboLikes,type Feedback} from './Results';
import {Btn,Choices,SearchBox,Section,Spinner,useUi} from './ui';

type Options = {
 occasion:string;
 shortcutId?:string;
 mode:'solo'|'combo';
 evidenceMode:'evidence'|'experimental';
};
type Request = Options & ScentIntent & {search?:string};
type Picks = {solo:SoloResult[];combos:ComboResult[];context:WearContext;requestId:string};
type Reply = {request:Request;value:Picks} | {request:Request;error:string};

export default function Suggester({state,intent,onIntentChange,onOutfit,onFeedback,comboLikes,feedbackBusy}:{
 state:AppState;
 intent:ScentIntent;
 onIntentChange:(value:ScentIntent)=>void;
 onOutfit:()=>void;
 onFeedback:Feedback;
 comboLikes:ComboLikes;
 feedbackBusy:boolean;
}) {
 const {styles,colors} = useUi();
 const [query,setQuery] = useState('');
 const [filtersOpen,setFiltersOpen] = useState(false);
 const [options,setOptions] = useState<Options>({occasion:'GENERAL',mode:'solo',evidenceMode:'evidence'});
 const [request,setRequest] = useState<Request|null>(()=>({...options,...intent}));
 const [reply,setReply] = useState<Reply|null>(null);

 useEffect(() => {
  if (!request) return;
  let active = true;
  api<Picks>('recommend','POST',request).then(
   value => { if (active) setReply({request,value}); },
   error => { if (active) setReply({request,error:(error as Error).message}); },
  );
  return () => {active=false;};
 },[request]);

 const shortcuts = state.shortcuts.filter(shortcut => !shortcut.hidden);
 const selectedShortcut = shortcuts.find(shortcut => shortcut.id===options.shortcutId);
 const directOccasion = !selectedShortcut && options.occasion!=='GENERAL' ? options.occasion : '';
 const occasionLabel = selectedShortcut?.title ?? (directOccasion ? directOccasion[0]+directOccasion.slice(1).toLowerCase() : '');
 const occasionItems = [['','Everyday'] as const,...shortcuts.map(shortcut=>[shortcut.id,shortcut.title] as const)];
 if (directOccasion) occasionItems.push(['direct:'+directOccasion,occasionLabel]);
 const intentLabel = intentSummary(intent);
 const filterLabel = [intentLabel,occasionLabel,options.mode==='combo'?'Pair':''].filter(Boolean).join(' · ');
 const current = reply?.request===request ? reply : null;
 const result = current && 'value' in current ? current.value : null;
 const error = current && 'error' in current ? current.error : null;

 function editQuery(text:string) {
  setQuery(text);
  setRequest(null);
  setReply(null);
 }

 function changeOptions(next:Partial<Options>) {
  setOptions(previous=>({...previous,...next}));
  setRequest(null);
  setReply(null);
 }

 function submit(text=query,useSearchCues=true) {
  const parsed = resolveScentSearch(text,state.bottles);
  const nextIntent = useSearchCues ? {mood:parsed.mood??intent.mood,vibe:parsed.vibe??intent.vibe} : intent;
  const nextOptions = {...options};
  if (useSearchCues&&parsed.occasion) {
   nextOptions.occasion = parsed.occasion;
   nextOptions.shortcutId = shortcuts.find(shortcut=>shortcut.occasion===parsed.occasion)?.id;
   setOptions(nextOptions);
  }
  onIntentChange(nextIntent);
  setQuery(parsed.search??'');
  setReply(null);
  setRequest({...nextOptions,...nextIntent,search:parsed.search});
  Keyboard.dismiss();
 }

 return <View style={{gap:11}}>
  <Text accessibilityRole="header" style={styles.h1}>Find a scent</Text>
  <SearchBox label="Search fragrance suggestions" placeholder="Clean, tired, or a fragrance" value={query}
   onChange={editQuery} onSubmit={()=>submit()} onClear={()=>submit('')} maxLength={scentSearchLimit}/>
  <View style={[styles.row,{justifyContent:'space-between',gap:6}]}>
   <Pressable accessibilityRole="button" accessibilityLabel="Filters" accessibilityState={{expanded:filtersOpen}}
    style={[styles.row,{minHeight:37,flex:1}]} onPress={()=>setFiltersOpen(open=>!open)}>
    <SlidersHorizontal size={15} color={colors.link}/>
    <Text numberOfLines={1} style={[styles.link,{flexShrink:1}]}>{filterLabel ? 'Filters · '+filterLabel : 'Filters'}</Text>
    <ChevronDown size={13} color={colors.muted} style={{transform:[{rotate:filtersOpen?'180deg':'0deg'}]}}/>
   </Pressable>
   <Btn label="Match outfit" kind="quiet" icon={<Shirt size={15} color={colors.link}/>} onPress={onOutfit}/>
  </View>

  {filtersOpen&&<View style={styles.card}>
   <IntentPicker value={intent} onChange={value=>{onIntentChange(value);setRequest(null);setReply(null);}}/>
   <Choices label="Occasion" value={selectedShortcut?.id??(directOccasion?'direct:'+directOccasion:'')}
    items={occasionItems}
    onChange={id=>{
     const shortcut = shortcuts.find(item=>item.id===id);
     changeOptions({shortcutId:shortcut?.id,occasion:shortcut?.occasion??(directOccasion&&id==='direct:'+directOccasion?directOccasion:'GENERAL')});
    }}/>
   <Choices label="Pick" value={options.mode} items={[[ 'solo','Fragrance'],['combo','Pair']]}
    onChange={mode=>changeOptions({mode})}/>
   {options.mode==='combo'&&<Choices label="Pair evidence" value={options.evidenceMode}
    items={[[ 'evidence','Evidence only'],['experimental','Include experiments']]}
    onChange={evidenceMode=>changeOptions({evidenceMode})}/>}
   <Btn label="Apply filters" onPress={()=>{submit(query,false);setFiltersOpen(false);}} style={{alignSelf:'flex-end'}}/>
  </View>}

  <Section title="Suggestions"/>
  {request&&!current&&<Spinner label="Finding picks…"/>}
  {!request&&<Text style={styles.small}>Search or apply filters to see picks.</Text>}
  {error&&<Text accessibilityRole="alert" style={styles.muted}>{error}</Text>}
  {result&&result.context.policy==='NO_FRAGRANCE'&&<Text style={styles.muted}>This venue is fragrance-free.</Text>}
  {result&&result.context.policy!=='NO_FRAGRANCE'&&<>
   {request?.mode==='solo'&&!result.solo.length&&<Text style={styles.muted}>
    {request.search ? 'No eligible bottles match this search.' : 'No eligible fragrances fit these choices.'}
   </Text>}
   {request?.mode==='combo'&&!result.combos.length&&<Text style={styles.muted}>
    {request.evidenceMode==='evidence' ? 'No reviewed pairs match. Include experiments in Filters to try untested options.' : 'No eligible pairs fit these choices.'}
   </Text>}
   <Results key={result.requestId} solo={result.solo} combos={result.combos}
    occasion={result.context.occasion} requestId={result.requestId}
    onFeedback={onFeedback} comboLikes={comboLikes} busy={feedbackBusy}/>
  </>}
 </View>;
}
