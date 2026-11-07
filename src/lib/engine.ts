import type {Bottle,ComboResult,Evidence,PairRecord,Preferences,SoloResult,Tier,WearContext} from './types.ts';
import {intentFit,intentSummary} from './intent.ts';
export const ENGINE_VERSION='1.1.0';
const normal=(s:string)=>s.toLowerCase().trim();
export function seasonFor(month:number,latitude:number){const seasons=['Winter','Spring','Summer','Autumn'];const i=Math.floor((month%12)/3);return seasons[(i+(latitude<0?2:0))%4];}
export function effectiveTemperature(c:WearContext){return c.setting==='INDOOR'?c.indoorTempC:c.tempC;}
function eligible(b:Bottle,c:WearContext,p:Preferences){
  if(b.ownership!=='OWNED'||!b.profileKnown||b.fillPct<=0||c.policy==='NO_FRAGRANCE'||p.excludedIds.includes(b.id))return false;
  if(b.notes.some(n=>p.dislikedNotes.map(normal).includes(normal(n))))return false;
  if(b.strength>p.maxStrength||(p.sensitivity&&b.strength>1))return false;
  if((c.occasion==='GYM'||c.policy==='LOW_SCENT')&&b.strength>1)return false;
  if((c.occasion==='WORK'||c.occasion==='DATE')&&b.strength>2)return false;
  return true;
}
export function rankSolo(bottles:Bottle[],context:WearContext,prefs:Preferences,limit=3):SoloResult[]{
  const used=new Set<string>();
  return bottles.filter(b=>eligible(b,context,prefs)).filter(b=>{if(used.has(b.variantId))return false;used.add(b.variantId);return true;}).map(b=>{
    const temp=effectiveTemperature(context);const fresh=temp>=25;const cold=temp<16;const climateFit=b.climate==='UNKNOWN'?0.5:((fresh&&b.climate==='FRESH')||(cold&&b.climate==='WARM')||(!fresh&&!cold&&b.climate==='BALANCED'))?1:0.6;
    const social=context.occasion==='PARTY'?b.strength/3:1-(b.strength-1)*0.22;
    const liked=b.notes.filter(n=>prefs.likedNotes.map(normal).includes(normal(n)));
    const affinity=Math.min(1,0.45+(b.favorite?0.2:0)+(b.rating/5)*0.2+liked.length*0.12);
    const occasionFit=context.occasion==='GYM'?(b.climate==='FRESH'?1:0.65):context.occasion==='PARTY'?(b.strength>=2?1:0.65):1-(b.strength-1)*0.1;
    const score=25*occasionFit+20*climateFit+20*social+20*affinity+10*0.7+5*0.5;
    const reasons=[{ruleId:'v1.venue',text:context.occasion==='GYM'?'Your light-projection profile is a cautious fit for a shared gym.':b.strength===1?'Your light-projection profile keeps things close and unobtrusive.':context.occasion==='PARTY'?'Your fuller scent profile fits a more expressive occasion.':'Your moderate scent profile suits this setting.'},
      {ruleId:'v1.climate',text:b.climate==='UNKNOWN'?'Climate character is unknown; this choice relies on your other preferences.':climateFit===1?`Your ${b.climate.toLowerCase()} profile fits the ${Math.round(temp)}°C ${context.setting==='INDOOR'?'indoor':'manual'} conditions.`:'A flexible option under your selected conditions.'},
      {ruleId:'v1.affinity',text:liked.length?`Matches your preference for ${liked.join(' and ')}.`:b.favorite?'A favorite from your own collection.':'Selected using your personal scent profile.'}];
    const intent=intentFit(b,context);
    return {bottle:b,score:score+intent.score,reasons:[...reasons,...intent.reasons],confidence:b.provenance==='demo'?'Illustrative demo fit':'Based on your observations',caution:context.occasion==='GYM'?'Consider going scent-free at the gym; respect venue policy.':'Start with a light application. Perception varies by skin and setting.'};
  }).sort((a,b)=>b.score-a.score||a.bottle.id.localeCompare(b.bottle.id)).slice(0,limit);
}
export function evidenceTier(e:Evidence):Tier|null{
  const valid=e.reports.filter(r=>r.rights==='approved'&&r.firsthand&&/^https:\/\//.test(r.url));
  if(!valid.length)return null;
  if(e.adapted)return 'dupe_adapted_hypothesis';
  if(e.kind==='brand')return 'brand_guidance';
  return new Set(valid.map(r=>r.author)).size>=2&&new Set(valid.map(r=>r.url)).size>=2?'community_corroborated':'single_anecdote';
}
export function rankCombos(bottles:Bottle[],context:WearContext,prefs:Preferences,mode:'evidence'|'single'|'experimental',records:PairRecord[],excludedPairs:string[][]=[],limit=3):ComboResult[]{
  const solo=rankSolo(bottles,context,prefs,100);const results:ComboResult[]=[];
  for(let i=0;i<solo.length;i++)for(let j=i+1;j<solo.length;j++){
    const a=solo[i].bottle,b=solo[j].bottle;
    if(a.variantId===b.variantId)continue;
    if(excludedPairs.some(ids=>ids.includes(a.id)&&ids.includes(b.id)))continue;
    if((context.occasion==='GYM'||context.occasion==='WORK'||context.occasion==='DATE'||context.policy==='LOW_SCENT')&&a.strength+b.strength>2)continue;
    const record=records.find(r=>r.status==='approved'&&((r.a===a.variantId&&r.b===b.variantId)||(r.b===a.variantId&&r.a===b.variantId)));
    let tier=record?evidenceTier(record):null;
    if(!tier&&mode==='experimental')tier='model_hypothesis';
    if(!tier)continue;
    if(mode==='evidence'&&!['brand_guidance','community_corroborated'].includes(tier))continue;
    if(mode==='single'&&!['brand_guidance','community_corroborated','single_anecdote'].includes(tier))continue;
    const shared=a.notes.filter(n=>b.notes.includes(n));
    const fits=[...solo[i].reasons,...solo[j].reasons],direction=intentSummary({mood:fits.some(r=>r.ruleId==='v1.mood')?context.mood:undefined,vibe:fits.some(r=>r.ruleId==='v1.vibe')?context.vibe:undefined});
    results.push({a,b,score:(solo[i].score+solo[j].score)/2+(tier==='brand_guidance'||tier==='community_corroborated'?20:0),tier,
      sources:record&&tier!=='model_hypothesis'?record.reports.filter(r=>r.rights==='approved'&&r.firsthand).map(r=>r.url):[],
      reason:(shared.length?`Your profiles share ${shared.join(', ')}. That overlap suggests a starting point, not proof of compatibility.`:`Your ${a.family.toLowerCase()} and ${b.family.toLowerCase()} profiles offer contrast. This combination has not been wear-tested.`)+(direction?` Scent direction: ${direction}, using your profiles.`:''),
      caution:'Try a small application of each separately. Do not mix liquids in a bottle. Stop if the combination feels overwhelming.',reviewedAt:record?.reviewedAt});
  }
  return results.sort((a,b)=>b.score-a.score).slice(0,limit);
}
