import type {Bottle,ComboResult,Mood,Reason,ScentIntent,SoloResult,Vibe,WearContext} from './types.ts';
export const moodOptions=[['ANY','Any'],['HAPPY','Happy'],['TIRED','Tired'],['SAD','Sad'],['CALM','Calm'],['STRESSED','Stressed'],['CONFIDENT','Confident']] as const;
export const vibeOptions=[['ANY','Any'],['CLEAN','Clean'],['MYSTERIOUS','Mysterious'],['WARM','Warm'],['FRESH','Fresh'],['COZY','Cozy'],['BOLD','Bold'],['ROMANTIC','Romantic']] as const;
export const defaultIntent:ScentIntent={mood:'ANY',vibe:'ANY'};
type Direction={notes:RegExp;description:string};
const moodDirections:Partial<Record<Mood,Direction>>={
 HAPPY:{notes:/\b(citrus|bergamot|grapefruit|lemon|orange|neroli|fruity|peony)\b/i,description:'a bright, lively direction'},
 TIRED:{notes:/\b(citrus|bergamot|grapefruit|lemon|mint|peppermint|fresh|green|rosemary)\b/i,description:'a crisp, fresh direction'},
 SAD:{notes:/\b(vanilla|tonka|musk|sandalwood|iris|amber)\b/i,description:'a soft, comforting direction'},
 CALM:{notes:/\b(tea|sage|lavender|vetiver|cedar|sandalwood|woody)\b/i,description:'a quiet, grounded direction'},
 STRESSED:{notes:/\b(musk|iris|tea|lavender|sandalwood)\b/i,description:'a soft, understated direction'},
 CONFIDENT:{notes:/\b(woody|wood|cedar|vetiver|leather|oud|spicy|cardamom)\b/i,description:'a structured, expressive direction'}
};
type VibeDirection={primary:RegExp;supporting:RegExp;description:string};
// Product scent-direction heuristics, not measured blend compatibility. Only
// supplied notes/families count; names, brands and model descriptions never do.
const vibeDirections:Partial<Record<Vibe,VibeDirection>>={
 CLEAN:{primary:/\b(musk|neroli|cotton|linen|aldehydes?|soap|soapy|iris|ambrette|cetalox|ambroxan|ambroxide)\b/i,supporting:/\b(aquatic|fresh|ozonic|salt|clean)\b/i,description:'a clean, freshly washed direction'},
 MYSTERIOUS:{primary:/\b(incense|smoke|smoky|oud|leather|patchouli|resins?|tobacco|guaiac)\b/i,supporting:/\b(woody|wood|cedar|vetiver|sandalwood|moss)\b/i,description:'a darker, woody or smoky direction'},
 WARM:{primary:/\b(amber|vanilla|tonka|benzoin|cinnamon|cardamom|sandalwood)\b/i,supporting:/\b(honey|saffron|spicy|warm)\b/i,description:'a warm, ambery direction'},
 FRESH:{primary:/\b(citrus|bergamot|lemon|grapefruit|mint|peppermint|green|neroli|salt)\b/i,supporting:/\b(fresh|aquatic|ozonic|fruity|peach|pear|blackcurrant|cetalox|ambrette)\b/i,description:'a crisp, fresh direction'},
 COZY:{primary:/\b(vanilla|tonka|musk|sandalwood|suede|cashmere|cashmeran|benzoin|honey|chestnut)\b/i,supporting:/\b(amber|iris|cetalox|ambrette|soft)\b/i,description:'a soft, cozy direction'},
 BOLD:{primary:/\b(oud|leather|smoke|smoky|spicy|pepper|patchouli|amber|tobacco|clove|saffron)\b/i,supporting:/\b(cardamom|resins?|woody|wood)\b/i,description:'a bold, expressive direction'},
 ROMANTIC:{primary:/\b(rose|floral|jasmine|peony|iris|musk|vanilla|honey|peach)\b/i,supporting:/\b(cetalox|soft)\b/i,description:'a soft, floral direction'}
};
const normal=(text:string)=>text.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
type Cue={text:string;kind:'note'|'family';level:1|2};
const notesFor=(b:Bottle)=>[...new Map([...b.notes,...(b.catalogNotes??[])].map(note=>[normal(note),note])).values()];
function vibeCue(b:Bottle,direction:VibeDirection|undefined):Cue|undefined{
 if(!direction||!b.profileKnown)return;
 const notes=notesFor(b),primary=notes.find(note=>direction.primary.test(normal(note)));
 if(primary)return {text:primary,kind:'note',level:2};
 const supporting=notes.find(note=>direction.supporting.test(normal(note)));
 if(supporting)return {text:supporting,kind:'note',level:1};
 if(direction.primary.test(normal(b.family))||direction.supporting.test(normal(b.family)))return {text:b.family,kind:'family',level:1};
}
export function intentSummary(context:Pick<WearContext,'mood'|'vibe'>){return [moodOptions.find(([id])=>id===context.mood&&id!=='ANY')?.[1],vibeOptions.find(([id])=>id===context.vibe&&id!=='ANY')?.[1]].filter(Boolean).join(' · ');}
export function intentFit(bottle:Bottle,context:Pick<WearContext,'mood'|'vibe'>){
 const reasons:Reason[]=[];let score=0;
 if(!bottle.profileKnown)return {score,reasons,vibeLevel:0,cue:undefined as Cue|undefined};
 const mood=moodDirections[context.mood??'ANY'],vibe=vibeDirections[context.vibe??'ANY'];
 // Preserve the existing mood-only scoring and reason precedence.
 const moodMatch=mood&&(bottle.family+' '+bottle.notes.join(' ')).match(mood.notes)?.[0];
 const cue=vibeCue(bottle,vibe);
 if(mood&&moodMatch){score+=6;reasons.push({ruleId:'v1.mood',text:`${moodOptions.find(([id])=>id===context.mood)![1]} mood: ${moodMatch.toLowerCase()} for ${mood.description}.`});}
 if(vibe&&cue){score+=cue.level===2?18:9;reasons.push({ruleId:'v1.vibe',text:`${vibeOptions.find(([id])=>id===context.vibe)![1]} vibe: ${cue.text.toLowerCase()}${cue.kind==='family'?' profile':''} for ${vibe.description}.`});}
 return {score,reasons,vibeLevel:cue?.level??0,cue};
}

export function createIntentRanking(context:Pick<WearContext,'mood'|'vibe'>){
 // Request-scoped cache: no profile data or ranking functions survive the call.
 const cache=new WeakMap<Bottle,ReturnType<typeof intentFit>>();
 const fit=(b:Bottle)=>{let value=cache.get(b);if(!value){value=intentFit(b,context);cache.set(b,value);}return value;};
 const pairPriority=(a:Bottle,b:Bottle)=>[fit(a),fit(b)].reduce((total,item)=>total+(item.vibeLevel===2?3:item.vibeLevel===1?1:0),0);
 const soloOrder=(a:SoloResult,b:SoloResult)=>fit(b.bottle).vibeLevel-fit(a.bottle).vibeLevel||b.score-a.score;
 return {
  fit,
  // Explicit scent direction precedes the existing secondary numeric score.
  solo:(a:SoloResult,b:SoloResult)=>soloOrder(a,b)||a.bottle.id.localeCompare(b.bottle.id),
  outfitSolo:soloOrder,
  combo:(a:ComboResult,b:ComboResult)=>pairPriority(b.a,b.b)-pairPriority(a.a,a.b)||b.score-a.score,
  pairDescription:(a:Bottle,b:Bottle)=>{
   const values=[fit(a),fit(b)],cues=values.flatMap(value=>value.cue?[value.cue]:[]);
   if(!cues.length)return '';
   const label=intentSummary({vibe:context.vibe});
   const text=[...new Set(cues.map(cue=>cue.text+(cue.kind==='family'?' profile':'')))].join(' + ');
   return label+' cues: '+text+'.';
  },
 };
}
