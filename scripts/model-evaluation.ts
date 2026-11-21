import {outfitSchema,reviewPhotoOutfit} from '../src/lib/outfit.ts';
import {createHash} from 'node:crypto';

export function inputFingerprint(input:{task:string;kind:string;instructions:string;text:string;schema:unknown;imageSha256?:string}){
 return createHash('sha256').update(JSON.stringify({task:input.task,kind:input.kind,instructions:input.instructions,text:input.text,schema:input.schema,imageSha256:input.imageSha256})).digest('hex');
}

export interface ExpectedOutfit {hasOutfit:boolean;garments:string[];colors:string[]}
const normalized=(value:string)=>value.toLowerCase().normalize('NFKD').replace(/\p{M}/gu,'').trim();
export function factScore(actual:string[],expected:string[]){
 const a=new Set(actual),e=new Set(expected),tp=[...a].filter(value=>e.has(value)).length,fp=a.size-tp,fn=e.size-tp;
 const precision=a.size?tp/a.size:e.size?0:1,recall=e.size?tp/e.size:a.size?0:1;
 return {precision,recall,f1:precision+recall?2*precision*recall/(precision+recall):0,tp,fp,fn};
}
const garmentGroups=[
 ['shirt',/\b(?:t[ -]?shirts?|shirts?|blouses?|polos?|tops?)\b/],
 ['trousers',/\b(?:pants|trousers|jeans|chinos|leggings)\b/],
 ['shoes',/\b(?:shoes?|loafers?|sneakers?|trainers?|boots?|heels?|sandals?)\b/],
 ['hoodie',/\b(?:hoodies?|sweatshirts?|hooded tops?)\b/],
 ['blazer',/\b(?:blazers?|jackets?)\b/],
 ['dress',/\bdress(?:es)?\b/],
 ['shorts',/\bshorts\b/],
 ['hat',/\b(?:hats?|caps?)\b/],
 ['tie',/\bties?\b/],
 ['skirt',/\bskirts?\b/],
] as const;
export function garmentFacts(values:string[]){
 return [...new Set(values.flatMap(value=>{
  const text=normalized(value);
  // Suppress garment parts/synonyms, but still penalize unrelated extra items.
  const primaryDress=/\bdress(?:es)?\b/.test(text),primaryHoodie=garmentGroups.find(([name])=>name==='hoodie')![1].test(text);
  const matches=garmentGroups.filter(([name,pattern])=>pattern.test(text)&&!(primaryDress&&name==='skirt')&&!(primaryHoodie&&name==='shirt')).map(([name])=>name as string);
  if(/\bsuits?\b/.test(text))matches.push('blazer','trousers');
  return matches.length?matches:['other:'+text];
 }))];
}
const aliases:Record<string,string>={navy:'blue',grey:'gray',cream:'white',tan:'beige'};
export function colorFacts(values:string[]){
 return [...new Set(values.flatMap(value=>{
  const text=normalized(value),colors=text.match(/\b(?:black|white|grey|gray|navy|blue|green|red|pink|yellow|orange|beige|cream|brown|purple|burgundy|olive|tan|teal|gold|silver)\b/g);
  return colors?.map(color=>aliases[color]??color)??['other:'+text];
 }))];
}
export function evaluateOutfit(raw:unknown,expected:ExpectedOutfit){
 const parsed=outfitSchema.safeParse(raw);
 if(!parsed.success)return {schemaValid:false,rawAbstained:false,appAbstained:false,rawUnsupported:true,profile:null,garments:factScore([],expected.garments),colors:factScore([],expected.colors)};
 const profile=reviewPhotoOutfit(parsed.data);
 const rawGarments=factScore(garmentFacts(parsed.data.garments),expected.garments);
 return {schemaValid:true,rawAbstained:!parsed.data.hasOutfit&&!parsed.data.garments.length&&!parsed.data.colors.length,
  appAbstained:!profile.hasOutfit&&!profile.garments.length&&!profile.colors.length,
  rawUnsupported:!expected.hasOutfit&&parsed.data.hasOutfit||rawGarments.fp>0,profile,
  garments:factScore(garmentFacts(profile.garments),expected.garments),colors:factScore(colorFacts(profile.colors),expected.colors)};
}
export interface AcceptanceMetrics {
 schemaRate:number;abstentionRate:number;bottleGroundingSafe:boolean;bottleRecall:number;garmentF1:number;colorF1:number;
 topSoloAgreement:number;boundariesSafe:boolean;coverageComplete:boolean;
}
export function acceptance(metrics:AcceptanceMetrics){
 const checks={
  coverageComplete:metrics.coverageComplete===true,schemaSuccess:metrics.schemaRate===1,
  abstention:metrics.abstentionRate===1,bottleGrounding:metrics.bottleGroundingSafe===true,bottleRecall:metrics.bottleRecall>=.90,
  garmentAccuracy:metrics.garmentF1>=.90,colorAccuracy:metrics.colorF1>=.85,
  recommendationAgreement:metrics.topSoloAgreement>=.90,boundaries:metrics.boundariesSafe===true,
 };
 return {passed:Object.values(checks).every(Boolean),checks,metrics};
}
