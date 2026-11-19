import type {CatalogRating} from './catalog-ratings.ts';

export type Ownership = 'OWNED' | 'WISHLIST' | 'REMOVED';
export type Provenance = 'demo' | 'personal' | 'catalog' | 'unknown';
export interface Bottle {
  id:string; variantId:string; brand:string; name:string; concentration:string;
  ownership:Ownership; family:string; notes:string[]; strength:number;
  climate:'FRESH'|'BALANCED'|'WARM'|'UNKNOWN'; profileKnown:boolean;
  provenance:Provenance; color:string; shape:'square'|'round'|'tall';
  sizeMl:number; fillPct:number; rating:number; favorite:boolean; memo:string;
  catalogPhoto?:string;
  catalogPhotos?:string[];
  catalogNotes?:string[];
  catalogSource?:{label:string;url:string};
  strengthUnknown?:true;
  shelves?:string[];
  catalogNoteGroups?:{name:string;stage:'top'|'heart'|'base'|'listed'}[];
}
export interface CatalogSource {
 id:string; publisher:string; url:string;
 kind:'house'|'reference'|'wear'|'photo'|'community';
 credit?:string; license?:{name:string;url:string};
}
export interface CatalogPhoto {path:string;caption:string;sourceId:string}
export interface CatalogProfile {
 id:string; brand:string; name:string; concentration:string; checkedAt:string;
 notes:{name:string;stage:'top'|'heart'|'base'|'listed';sourceIds:string[]}[];
 performance:{kind:'longevity'|'sillage'|'projection';reports:{sourceId:string;value:string}[]}[];
 ratings:CatalogRating[];
 links:{label:string;url:string;kind?:'jomashop-listing';bottleEdition?:string}[];
 releaseYear?:number;
 photo?:CatalogPhoto;
 additionalPhotos?:CatalogPhoto[];
 sources:CatalogSource[];
}
export type CatalogEdition=Pick<CatalogProfile,'id'|'brand'|'name'|'concentration'|'releaseYear'>;
export interface CatalogAdminEntry extends CatalogEdition {
 photoPath?:string;
 source?:{publisher:string;url:string};
 status:'bundled'|'automatic'|'override'|'hidden'|'missing';
}
export interface CatalogDupe {
 brand:string; name:string; concentration:string;
 evidence:'brand'|'community';
 sources:{publisher:string;url:string}[];
}
export interface CatalogDupeLinks {
 alternatives:CatalogDupe[];
 originals:CatalogDupe[];
}
export interface LayeringReference {
 publisher:string;url:string;score:number|null;scale:number;
 originalPair:[string,string];dupeAdapted:boolean;editionUnconfirmed:boolean;
}
export interface LayeringLibrarySide {
 label:string;
 editions:(CatalogEdition&{dupes:CatalogDupeLinks;photo?:string})[];
 alternatives:(CatalogDupe&{originalConcentration?:string})[];
 owned:{id:string;variantId:string;name:string;brand:string;concentration:string;substitute:boolean}[];
}
export interface LayeringLibraryEntry {
 id:string;a:LayeringLibrarySide;b:LayeringLibrarySide;
 reference:LayeringReference;checkedAt:string;
}
export interface BottleProfileReply {
 variantId:string;
 profile:CatalogProfile|null;
 dupes?:CatalogDupeLinks;
}
export interface Preferences {
  likedNotes:string[]; dislikedNotes:string[]; excludedIds:string[];
  maxStrength:number; sensitivity:boolean; units:'C'|'F'; archiveOutfits:boolean;
  collectionView?:{sort:'name'|'brand'|'rating'|'least-worn';layout:'grid'|'list'};
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
export interface PairRecord extends Evidence {a:string; b:string; reviewedAt:string; status:'approved'|'draft';note?:string}
export interface ComboResult {a:Bottle; b:Bottle; score:number; tier:Tier; sources:string[]; reason:string; caution:string; reviewedAt?:string;reference?:LayeringReference}
export interface WearEvent {id:string; bottleIds:string[]; names:string[]; occasion:string; reaction:'wore'|'loved'|'disliked'|'saved'; at:string; context:WearContext;note?:string}
export interface JournalReply {
 month:string;timezone:string;entries:WearEvent[];days:Record<string,number>;
 totalWears:number;monthWears:number;layeredWears:number;distinctBottles:number;
 mostWorn:{id:string;name:string;count:number}[];
}
export interface CatalogSearchEntry extends CatalogEdition {photo?:string;hasNotes:boolean}
export interface CatalogSearchReply {entries:CatalogSearchEntry[];total:number;offset:number}
export type CatalogTarget={kind:'bottle'|'catalog';id:string};
export interface ComparisonNotes {sharedNotes:string[];leftOnly:string[];rightOnly:string[];noteOverlap:number|null}
export interface ComparisonReply extends ComparisonNotes {
 left:{edition:CatalogEdition;profile:CatalogProfile|null};right:{edition:CatalogEdition;profile:CatalogProfile|null};
}
export interface CatalogDetailReply {
 edition:CatalogEdition;profile:CatalogProfile|null;dupes:CatalogDupeLinks;
 similar:{edition:CatalogEdition;sharedNotes:string[];overlap:number}[];
}
export interface User {id:string; name:string; email:string|null; demo:boolean; catalogAdmin?:true}
export interface AppState {user:User; bottles:Bottle[]; preferences:Preferences; context:WearContext; shortcuts:Shortcut[]; history:WearEvent[]; likedCombos:WearEvent[];environment?:'staging'}
export type AiProvider='qwen'|'openai'|'claude';
export interface OutfitProfile {
 summary:string; garments:string[]; colors:string[];
 styleTags:('casual'|'tailored'|'minimal'|'sporty'|'evening'|'streetwear'|'romantic'|'outdoors')[];
 formality:'casual'|'smart'|'formal'; palette:'light'|'dark'|'bright'|'neutral'|'mixed';
 hasOutfit:boolean; uncertainty:string[];
}
export interface OutfitReceipt {id:string;profile:OutfitProfile;provider:AiProvider;model:string;method:'model'|'offline_rules';createdAt:string;photoRetained?:boolean}
export interface QwenCloudConsent {destination:string;model:string;policyVersion:string}
export interface AiStatus {selected:AiProvider;connections:{provider:AiProvider;model:string;configured:boolean}[];local:{reachable:boolean;installed:boolean;model:string};qwen?:QwenCloudConsent&{mode:'local'|'hosted';configured:boolean;cost?:'local'|'free'|'paid';paidEnabled?:boolean}}
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
