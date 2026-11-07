import type {CatalogRating} from './catalog-ratings.ts';

export type Ownership = 'OWNED' | 'WISHLIST' | 'REMOVED';
export type Provenance = 'demo' | 'personal' | 'unknown';
export interface Bottle {
  id:string; variantId:string; brand:string; name:string; concentration:string;
  ownership:Ownership; family:string; notes:string[]; strength:number;
  climate:'FRESH'|'BALANCED'|'WARM'|'UNKNOWN'; profileKnown:boolean;
  provenance:Provenance; color:string; shape:'square'|'round'|'tall';
  sizeMl:number; fillPct:number; rating:number; favorite:boolean; memo:string;
  catalogPhoto?:string;
}
export interface CatalogSource {
 id:string; publisher:string; url:string;
 kind:'house'|'reference'|'wear'|'photo'|'community';
 credit?:string; license?:{name:string;url:string};
}
export interface CatalogProfile {
 id:string; brand:string; name:string; concentration:string; checkedAt:string;
 notes:{name:string;stage:'top'|'heart'|'base'|'listed';sourceIds:string[]}[];
 performance:{kind:'longevity'|'sillage'|'projection';reports:{sourceId:string;value:string}[]}[];
 ratings:CatalogRating[];
 links:{label:string;url:string}[];
 releaseYear?:number;
 photo?:{path:string;caption:string;sourceId:string};
 sources:CatalogSource[];
}
export interface Preferences {
  likedNotes:string[]; dislikedNotes:string[]; excludedIds:string[];
  maxStrength:number; sensitivity:boolean; units:'C'|'F'; archiveOutfits:boolean;
}
export type Mood='ANY'|'HAPPY'|'TIRED'|'SAD'|'CALM'|'STRESSED'|'CONFIDENT';
export type Vibe='ANY'|'CLEAN'|'MYSTERIOUS'|'WARM'|'FRESH'|'COZY'|'BOLD'|'ROMANTIC';
export interface ScentIntent {mood:Mood;vibe:Vibe}
export interface WearContext {
  city:string; tempC:number; humidity:number; setting:'INDOOR'|'OUTDOOR'|'MIXED';
  indoorTempC:number; occasion:string; policy:'FREE'|'LOW_SCENT'|'NO_FRAGRANCE';
  eventAtLocal:string; timezone:string; latitude:number; source:'manual';
  mood?:Mood; vibe?:Vibe;
}
export interface Shortcut {
  id:string; title:string; icon:string; occasion:string; setting:'INDOOR'|'OUTDOOR'|'MIXED';
  durationHours:number; maxStrength:number; hidden:boolean;
}
export interface Reason {ruleId:string; text:string}
export interface SoloResult {bottle:Bottle; score:number; reasons:Reason[]; confidence:string; caution:string}
export type Tier = 'brand_guidance'|'community_corroborated'|'single_anecdote'|'dupe_adapted_hypothesis'|'model_hypothesis';
export interface EvidenceReport {author:string; firsthand:boolean; rights:string; url:string}
export interface Evidence {kind:'brand'|'community'; reports:EvidenceReport[]; adapted?:boolean}
export interface PairRecord extends Evidence {a:string; b:string; reviewedAt:string; status:'approved'|'draft'}
export interface ComboResult {a:Bottle; b:Bottle; score:number; tier:Tier; sources:string[]; reason:string; caution:string; reviewedAt?:string}
export interface WearEvent {id:string; bottleIds:string[]; names:string[]; occasion:string; reaction:'wore'|'loved'|'disliked'|'saved'; at:string; context:WearContext}
export interface User {id:string; name:string; email:string|null; demo:boolean}
export interface AppState {user:User; bottles:Bottle[]; preferences:Preferences; context:WearContext; shortcuts:Shortcut[]; history:WearEvent[]; likedCombos:WearEvent[]}
export type AiProvider='qwen'|'openai'|'claude';
export interface OutfitProfile {
 summary:string; garments:string[]; colors:string[];
 styleTags:('casual'|'tailored'|'minimal'|'sporty'|'evening'|'streetwear'|'romantic'|'outdoors')[];
 formality:'casual'|'smart'|'formal'; palette:'light'|'dark'|'bright'|'neutral'|'mixed';
 hasOutfit:boolean; uncertainty:string[];
}
export interface OutfitReceipt {id:string;profile:OutfitProfile;provider:AiProvider;model:string;method:'model'|'offline_rules';createdAt:string;photoRetained?:boolean}
export interface AiStatus {selected:AiProvider;connections:{provider:AiProvider;model:string;configured:boolean}[];local:{reachable:boolean;installed:boolean;model:string}}
export interface OutfitMatches {solo:SoloResult[];combos:ComboResult[];requestId:string;context:WearContext;outfit:OutfitProfile}
export interface BottleCandidate {brand:string;name:string;concentration:string;confidence:'likely'|'uncertain';clue:string}
export interface OutfitSnapshot {analysisId:string;profile:OutfitProfile;choices:string[][];variants:Record<string,string>}
export interface RecommendationSnapshot {context:WearContext;bottleIds:string[];outfit?:OutfitSnapshot}
export interface SavedLook {
 id:string;analysisId:string;profile:OutfitProfile;
 bottles:Pick<Bottle,'id'|'variantId'|'brand'|'name'|'concentration'|'color'|'shape'>[];
 context:Pick<WearContext,'occasion'|'setting'|'tempC'|'indoorTempC'|'policy'|'mood'|'vibe'>;
 photoAvailable:boolean;createdAt:string;
}
