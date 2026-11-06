export type Ownership = 'OWNED' | 'WISHLIST' | 'REMOVED';
export type Provenance = 'demo' | 'personal' | 'unknown';
export interface Bottle {
  id:string; variantId:string; brand:string; name:string; concentration:string;
  ownership:Ownership; family:string; notes:string[]; strength:number;
  climate:'FRESH'|'BALANCED'|'WARM'|'UNKNOWN'; profileKnown:boolean;
  provenance:Provenance; color:string; shape:'square'|'round'|'tall';
  sizeMl:number; fillPct:number; rating:number; favorite:boolean; memo:string;
}
export interface Preferences {
  likedNotes:string[]; dislikedNotes:string[]; excludedIds:string[];
  maxStrength:number; sensitivity:boolean; units:'C'|'F';
}
export interface WearContext {
  city:string; tempC:number; humidity:number; setting:'INDOOR'|'OUTDOOR'|'MIXED';
  indoorTempC:number; occasion:string; policy:'FREE'|'LOW_SCENT'|'NO_FRAGRANCE';
  eventAtLocal:string; timezone:string; latitude:number; source:'manual';
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
export interface AppState {user:User; bottles:Bottle[]; preferences:Preferences; context:WearContext; shortcuts:Shortcut[]; history:WearEvent[]}
