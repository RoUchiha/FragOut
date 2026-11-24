import type {Bottle,ComboResult,Evidence,LayeringReference,PairRecord,Preferences,SoloResult,Tier,WearContext} from './types.ts';
import {createIntentRanking,intentSummary} from './intent.ts';
export const ENGINE_VERSION='1.4.0';
const normal=(s:string)=>s.toLowerCase().trim();
export function seasonFor(month:number,latitude:number){const seasons=['Winter','Spring','Summer','Autumn'] as const;const i=Math.floor((month%12)/3);return seasons[(i+(latitude<0?2:0))%4];}
export function effectiveTemperature(c:WearContext){return c.setting==='INDOOR'?c.indoorTempC:c.tempC;}
function eligible(b:Bottle,c:WearContext,p:Preferences){
  if(b.ownership!=='OWNED'||!b.profileKnown||b.fillPct<=0||c.policy==='NO_FRAGRANCE'||p.excludedIds.includes(b.id))return false;
  const excluded=p.dislikedNotes.map(normal);
  if([...b.notes,...(b.catalogNotes??[])].some(n=>excluded.includes(normal(n))))return false;
  if(b.strengthUnknown&&(p.maxStrength<3||p.sensitivity||c.policy==='LOW_SCENT'||['GYM','WORK','DATE'].includes(c.occasion)))return false;
  if(b.strength>p.maxStrength||(p.sensitivity&&b.strength>1))return false;
  if((c.occasion==='GYM'||c.policy==='LOW_SCENT')&&b.strength>1)return false;
  if((c.occasion==='WORK'||c.occasion==='DATE')&&b.strength>2)return false;
  return true;
}
export function rankSolo(bottles:Bottle[],context:WearContext,prefs:Preferences,limit=3):SoloResult[]{
  const intentRanking=createIntentRanking(context);
  const used=new Set<string>();
  return bottles.filter(b=>eligible(b,context,prefs)).filter(b=>{if(used.has(b.variantId))return false;used.add(b.variantId);return true;}).map(b=>{
    const temp=effectiveTemperature(context);const fresh=temp>=25;const cold=temp<16;const climateFit=b.climate==='UNKNOWN'?0.5:((fresh&&b.climate==='FRESH')||(cold&&b.climate==='WARM')||(!fresh&&!cold&&b.climate==='BALANCED'))?1:0.6;
    const social=b.strengthUnknown ? .5 : context.occasion==='PARTY'?b.strength/3:1-(b.strength-1)*0.22;
    const liked=b.notes.filter(n=>prefs.likedNotes.map(normal).includes(normal(n)));
    const affinity=Math.min(1,0.45+(b.favorite?0.2:0)+(b.rating/5)*0.2+liked.length*0.12);
    const occasionFit=b.strengthUnknown ? .65 : context.occasion==='GYM'?(b.climate==='FRESH'?1:0.65):context.occasion==='PARTY'?(b.strength>=2?1:0.65):1-(b.strength-1)*0.1;
    const score=25*occasionFit+20*climateFit+20*social+20*affinity+10*0.7+5*0.5;
    const projection=b.strength===1?'Light':b.strength===2?'Moderate':'Strong';
    const reasons=[{ruleId:'v1.venue',text:b.strengthUnknown?'Projection is unknown. Start with a light application.':b.provenance==='catalog'?projection+' projection estimate from FragDex.':context.occasion==='GYM'?'Your light-projection profile is a cautious fit for a shared gym.':projection+' projection from your scent profile.'},
      {ruleId:'v1.climate',text:b.climate==='UNKNOWN'?'Climate character is unknown; this choice relies on your other preferences.':climateFit===1?`Your ${b.climate.toLowerCase()} profile fits the ${Math.round(temp)}°C ${context.setting==='INDOOR'?'indoor':'manual'} conditions.`:'A flexible option under your selected conditions.'},
      {ruleId:'v1.affinity',text:liked.length?`Matches your preference for ${liked.join(' and ')}.`:b.favorite?'A favorite from your own collection.':'Selected using your personal scent profile.'}];
    const intent=intentRanking.fit(b);
    return {bottle:b,score:score+intent.score,reasons:[...reasons,...intent.reasons],confidence:b.provenance==='demo'?'Illustrative demo fit':b.provenance==='catalog'?'Sourced FragDex profile':'Based on your observations',caution:context.occasion==='GYM'?'Consider going scent-free at the gym; respect venue policy.':'Start with a light application. Perception varies by skin and setting.'};
  }).sort(intentRanking.solo).slice(0,limit);
}
export function evidenceTier(e:Evidence):Tier|null{
  const valid=e.reports.filter(r=>r.rights==='approved'&&r.firsthand&&/^https:\/\//.test(r.url));
  if(!valid.length)return null;
  if(e.adapted)return 'dupe_adapted_hypothesis';
  if(e.kind==='brand')return 'brand_guidance';
  return new Set(valid.map(r=>r.author)).size>=2&&new Set(valid.map(r=>r.url)).size>=2?'community_corroborated':'single_anecdote';
}
export function rankCombos(bottles:Bottle[],context:WearContext,prefs:Preferences,mode:'evidence'|'single'|'experimental',records:PairRecord[],excludedPairs:string[][]=[],limit=3,searchMatches?:ReadonlySet<string>,lookupReference?:(a:Bottle,b:Bottle)=>LayeringReference|undefined,scoreAdjustment?:(b:Bottle)=>number):ComboResult[]{
  if(limit<=0)return [];
  const intentRanking=createIntentRanking(context);
  // A solo cutoff can discard the only legal pair before evidence/venue checks.
  // Consider all eligible profiles, but retain only the requested best results.
  let solo=rankSolo(bottles,context,prefs,Number.MAX_SAFE_INTEGER);
  if (searchMatches) {
    const anchors=rankSolo(bottles.filter(bottle=>searchMatches.has(bottle.id)),context,prefs,Number.MAX_SAFE_INTEGER);
    if (!anchors.length) return [];
    const candidates=new Map([...solo,...anchors].map(result=>[result.bottle.variantId,result]));
    solo=[...candidates.values()].sort(intentRanking.solo);
  }
  const results:ComboResult[]=[];
  const key=(a:string,b:string)=>JSON.stringify([a,b].sort());
  const approved=new Map<string,PairRecord>();
  for(const record of records)if(record.status==='approved'&&!approved.has(key(record.a,record.b)))approved.set(key(record.a,record.b),record);
  const adjustments=new Map(solo.map(result=>[result.bottle,scoreAdjustment?.(result.bottle)??0]));
  const baseScores=new WeakMap<ComboResult,number>();
  // Preserve the prior base-order tie break when outfit adjustments tie.
  const compare=(a:ComboResult,b:ComboResult)=>intentRanking.combo(a,b)||(baseScores.get(b)!-baseScores.get(a)!);
  for(let i=0;i<solo.length;i++)for(let j=i+1;j<solo.length;j++){
    const a=solo[i].bottle,b=solo[j].bottle;
    if(searchMatches&&!searchMatches.has(a.id)&&!searchMatches.has(b.id))continue;
    if(a.variantId===b.variantId)continue;
    if(excludedPairs.some(ids=>ids.includes(a.id)&&ids.includes(b.id)))continue;
    if((context.occasion==='GYM'||context.occasion==='WORK'||context.occasion==='DATE'||context.policy==='LOW_SCENT')&&a.strength+b.strength>2)continue;
    const record=approved.get(key(a.variantId,b.variantId));
    let tier=record?evidenceTier(record):null;
    const external=!tier&&mode==='experimental'?lookupReference?.(a,b):undefined;
    if(!tier&&mode==='experimental')tier=external?.dupeAdapted?'dupe_adapted_hypothesis':'model_hypothesis';
    if(!tier)continue;
    if(mode==='evidence'&&!['brand_guidance','community_corroborated'].includes(tier))continue;
    if(mode==='single'&&!['brand_guidance','community_corroborated','single_anecdote'].includes(tier))continue;
    const shared=a.notes.filter(n=>b.notes.some(note=>normal(note)===normal(n)));
    const fits=[...solo[i].reasons,...solo[j].reasons],direction=intentSummary({mood:fits.some(r=>r.ruleId==='v1.mood')?context.mood:undefined,vibe:fits.some(r=>r.ruleId==='v1.vibe')?context.vibe:undefined});
    const cited=record&&tier!=='model_hypothesis';
    const reason=cited?(record.note??(tier==='brand_guidance'?'The fragrance house recommends wearing these two releases together.':'See the linked wearer reports for this exact pair.'))
      :shared.length?'Both profiles list '+shared.join(', ')+'. Experimental pairing.':a.family&&b.family?'Combines '+a.family.toLowerCase()+' and '+b.family.toLowerCase()+'. Experimental pairing.':'Two eligible fragrances from your collection. Experimental pairing.';
    const explanation=intentRanking.pairDescription(a,b);
    const baseScore=(solo[i].score+solo[j].score)/2+(tier==='brand_guidance'||tier==='community_corroborated'?20:external?3:0);
    const result:ComboResult={a,b,score:baseScore+(adjustments.get(a)!+adjustments.get(b)!)/2,tier,
      sources:external?[external.url]:record&&tier!=='model_hypothesis'?record.reports.filter(r=>r.rights==='approved'&&r.firsthand).map(r=>r.url):[],
      reason:explanation?(cited?reason+' '+explanation:explanation+' Experimental pairing.'):reason+(direction?' Scent direction: '+direction+'.':''),
      caution:'Try a small application of each separately. Do not mix liquids in a bottle. Stop if the combination feels overwhelming.',reviewedAt:record?.reviewedAt,
      ...(external?{reference:external}:{})};
    baseScores.set(result,baseScore);
    const position=results.findIndex(existing=>compare(result,existing)<0);
    if(position>=0)results.splice(position,0,result);
    else if(results.length<limit)results.push(result);
    if(results.length>limit)results.pop();
  }
  return results;
}
