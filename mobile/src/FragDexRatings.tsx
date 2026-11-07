import React from 'react';
import {Text,View} from 'react-native';
import {ExternalLink,Star} from 'lucide-react-native';
import {fragranceFacets} from '../../src/lib/catalog-ratings';
import type {CatalogProfile} from '../../src/lib/types';
import {Section,useUi} from './ui';
import FragDexLink from './FragDexLink';

const STAR_SIZE=12;

function Stars({score}:{score:number}) {
 const {colors}=useUi();
 return <View style={{flexDirection:'row',gap:2}} accessible={false}>
  {[0,1,2,3,4].map(index=>{
   const filled=Math.min(1,Math.max(0,score-index));
   return <View key={index} style={{width:STAR_SIZE,height:STAR_SIZE}}>
    <Star size={STAR_SIZE} color={colors.muted}/>
    {filled>0&&<View style={{position:'absolute',top:0,left:0,width:STAR_SIZE*filled,height:STAR_SIZE,overflow:'hidden'}}>
     <Star size={STAR_SIZE} color={colors.link} fill={colors.link}/>
    </View>}
   </View>;
  })}
 </View>;
}

export default function FragDexRatings({profile,visit}:{
 profile?:CatalogProfile|null;visit:(url:string)=>void;
}){
 const {styles,colors}=useUi();
 const sources=new Map(profile?.sources.map(source=>[source.id,source]));
 const overallLink=profile?.links?.find(link=>link.label==='View on Fragrantica')
  ??profile?.links?.find(link=>link.label==='View on Parfumo');
 return <View style={{gap:2}}>
  <Section title="Ratings"/>
  {fragranceFacets.map(([facet,label])=>{
   const ratings=(profile?.ratings??[]).filter(rating=>rating.facet===facet&&sources.has(rating.sourceId));
   return <View key={facet} style={[styles.spread,{alignItems:'flex-start',minHeight:29,borderBottomWidth:1,borderBottomColor:colors.line}]}>
    <Text style={[styles.text,{paddingTop:5}]}>{label}</Text>
    <View style={{flex:1,alignItems:'flex-end'}}>
     {ratings.length===0&&facet==='overall'&&overallLink&&
      <FragDexLink url={overallLink.url} visit={visit} accessibilityLabel={overallLink.label+' for the overall rating'}
       style={[styles.row,{minHeight:38,gap:6}]}>
       <Text style={styles.muted}>N/A</Text><ExternalLink size={12} color={colors.link}/>
      </FragDexLink>}
     {ratings.length===0&&!(facet==='overall'&&overallLink)&&<Text style={[styles.muted,{paddingTop:5}]}>N/A</Text>}
     {ratings.map(rating=>{
       const source=sources.get(rating.sourceId)!;
       const estimate=rating.kind==='estimate';
       return <FragDexLink key={source.id} url={source.url} visit={visit}
        accessibilityLabel={label+' '+rating.score+' out of 5 · '+source.publisher+(estimate?' estimate':'')}
        accessibilityHint="Opens the rating source"
        style={{minHeight:44,justifyContent:'center',alignItems:'flex-end',paddingVertical:3,gap:2}}>
        <View style={[styles.row,{gap:6}]}>
         <Stars score={rating.score}/>
         <Text style={styles.text}>{rating.score}/5</Text>
         <ExternalLink size={12} color={colors.link}/>
        </View>
        <Text style={[styles.small,{textAlign:'right'}]}>
         {source.publisher} · {rating.basis}{estimate?' · Est.':''}
        </Text>
       </FragDexLink>;
      })}
    </View>
   </View>;
  })}
 </View>;
}
