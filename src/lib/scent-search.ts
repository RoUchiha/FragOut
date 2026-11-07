import {moodOptions,vibeOptions} from './intent.ts';
import type {Bottle,Mood,ScentIntent,Vibe} from './types.ts';

export const scentSearchLimit = 120;
const words = (value:string) => value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

export function matchesBottleSearch(bottle:Bottle,search:string) {
 if (!search.trim()) return true;
 const terms = words(search);
 const profile = words([bottle.name,bottle.brand,bottle.family,bottle.concentration,...bottle.notes].join(' ')).join(' ');
 return terms.length>0 && terms.every(term => profile.includes(term));
}

const moods = new Map<string,Mood>(moodOptions.filter(([id])=>id!=='ANY').map(([id,label])=>[label.toLowerCase(),id]));
const vibes = new Map<string,Vibe>(vibeOptions.filter(([id])=>id!=='ANY').map(([id,label])=>[label.toLowerCase(),id]));
const occasions = {everyday:'GENERAL',gym:'GYM',date:'DATE',work:'WORK',party:'PARTY',errands:'ERRANDS'} as const;
export type SearchOccasion = typeof occasions[keyof typeof occasions] | 'CUSTOM';
type Search = Partial<ScentIntent> & {occasion?:SearchOccasion; search?:string};

export function resolveScentSearch(value:string,bottles:Bottle[]):Search {
 const search = value.trim().slice(0,scentSearchLimit);
 if (!search) return {};
 const normalized = words(search).join(' ');
 const namedBottle = bottles.some(bottle => bottle.ownership==='OWNED' &&
  [bottle.name,`${bottle.brand} ${bottle.name}`].some(name=>words(name).join(' ')===normalized));
 if (namedBottle) return {search};

 const terms = normalized.replace(/\bdate night\b/g,'date').replace(/\bgoing out\b/g,'party').split(' ');
 const cues:Search = {};
 for (const term of terms) {
  if (['and','for','a'].includes(term)) continue;
  const mood = moods.get(term);
  const vibe = vibes.get(term);
  if (mood) cues.mood = mood;
  else if (vibe) cues.vibe = vibe;
  else if (Object.hasOwn(occasions,term)) cues.occasion = occasions[term as keyof typeof occasions];
  else return {search};
 }
 return Object.keys(cues).length ? cues : {search};
}
