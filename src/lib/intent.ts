import type {Bottle,Mood,Reason,ScentIntent,Vibe,WearContext} from './types.ts';
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
const vibeDirections:Partial<Record<Vibe,Direction>>={
 CLEAN:{notes:/\b(musk|neroli|cotton|linen|aldehydes?|soap|soapy|aquatic|iris)\b/i,description:'a clean, freshly washed direction'},
 MYSTERIOUS:{notes:/\b(incense|smoke|smoky|oud|leather|patchouli|resin|woody|wood|cedar|vetiver)\b/i,description:'a darker, woody or smoky direction'},
 WARM:{notes:/\b(amber|vanilla|tonka|benzoin|cinnamon|cardamom|spicy|sandalwood)\b/i,description:'a warm, ambery direction'},
 FRESH:{notes:/\b(citrus|bergamot|lemon|grapefruit|mint|peppermint|fresh|aquatic|sea salt|green|neroli)\b/i,description:'a crisp, fresh direction'},
 COZY:{notes:/\b(vanilla|tonka|musk|sandalwood|suede|cashmere|benzoin)\b/i,description:'a soft, cozy direction'},
 BOLD:{notes:/\b(oud|leather|smoke|smoky|spicy|pepper|patchouli|amber)\b/i,description:'a bold, expressive direction'},
 ROMANTIC:{notes:/\b(rose|floral|jasmine|peony|iris|musk|vanilla)\b/i,description:'a soft, floral direction'}
};
export function intentSummary(context:Pick<WearContext,'mood'|'vibe'>){return [moodOptions.find(([id])=>id===context.mood&&id!=='ANY')?.[1],vibeOptions.find(([id])=>id===context.vibe&&id!=='ANY')?.[1]].filter(Boolean).join(' · ');}
export function intentFit(bottle:Bottle,context:Pick<WearContext,'mood'|'vibe'>){
 const reasons:Reason[]=[];let score=0;
 if(!bottle.profileKnown)return {score,reasons};
 const profile=bottle.family+' '+bottle.notes.join(' ');
 const mood=moodDirections[context.mood??'ANY'],vibe=vibeDirections[context.vibe??'ANY'];
 const moodMatch=mood&&profile.match(mood.notes)?.[0],vibeMatch=vibe&&profile.match(vibe.notes)?.[0];
 if(mood&&moodMatch){score+=6;reasons.push({ruleId:'v1.mood',text:`${moodOptions.find(([id])=>id===context.mood)![1]} mood: ${moodMatch.toLowerCase()} for ${mood.description}.`});}
 if(vibe&&vibeMatch){score+=18;reasons.push({ruleId:'v1.vibe',text:`${vibeOptions.find(([id])=>id===context.vibe)![1]} vibe: ${vibeMatch.toLowerCase()} for ${vibe.description}.`});}
 return {score,reasons};
}
