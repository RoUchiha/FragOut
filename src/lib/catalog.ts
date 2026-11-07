import entries from '../../catalog/fragrances.json' with {type:'json'};
import identity from '../../catalog/identity.json' with {type:'json'};
import type {Bottle,CatalogProfile} from './types.ts';

type Label = Pick<Bottle,'brand'|'name'|'concentration'>;
type CatalogEntry = CatalogProfile & {aliases?:string[]};
const normalize = (value:string)=>value.normalize('NFKD').toLowerCase()
 .replace(/\p{M}/gu,'').replace(/[’ʼ']/g,'').replace(/&/g,' and ')
 .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const houses = new Map(Object.entries(identity.houseAliases));
const suffixes = new Map(Object.entries(identity.suffixes));

function key({brand,name,concentration}:Label) {
 const labelSuffixes=suffixes.get(concentration);
 if(!labelSuffixes) return null;
 const inputHouse=normalize(brand);
 const house=houses.get(inputHouse)??inputHouse;
 let release=normalize(name);
 const prefix=[house,...[...houses].filter(([,canonical])=>canonical===house).map(([alias])=>alias)]
  .sort((a,b)=>b.length-a.length).find(alias=>release.startsWith(alias+' '));
 if(prefix) release=release.slice(prefix.length+1);
 const suffix=labelSuffixes.find(marker=>release.endsWith(' '+marker));
 if(suffix) release=release.slice(0,-suffix.length-1);
 return JSON.stringify([house,release,concentration]);
}

export const catalogProfiles = entries as CatalogEntry[];
const index = new Map<string,CatalogEntry|null>();
for(const profile of catalogProfiles) {
 for(const name of [profile.name,...(profile.aliases??[])]) {
  const id=key({...profile,name});
  if(!id) continue;
  const previous=index.get(id);
  index.set(id,previous===undefined||previous===profile?profile:null);
 }
}

export function findCatalogProfile(label:Label):CatalogProfile|null {
 const id=key(label);
 return id?index.get(id)??null:null;
}
