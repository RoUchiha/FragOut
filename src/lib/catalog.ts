import entries from '../../catalog/fragrances.json' with {type:'json'};
import dupeEntries from '../../catalog/dupes.json' with {type:'json'};
import identity from '../../catalog/identity.json' with {type:'json'};
import type {Bottle,CatalogDupe,CatalogDupeLinks,CatalogProfile} from './types.ts';

type Label = Pick<Bottle,'brand'|'name'|'concentration'>;
type CatalogEntry = CatalogProfile & {aliases?:string[]};
const normalize = (value:string)=>value.replace(/[™®℠]/g,'').normalize('NFKD').toLowerCase()
 .replace(/\p{M}/gu,'').replace(/[’ʼ']/g,'').replace(/&/g,' and ')
 .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const houses = new Map(Object.entries(identity.houseAliases));
const suffixes = new Map(Object.entries(identity.suffixes));

export function catalogIdentityKey({brand,name,concentration}:Label) {
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
  const id=catalogIdentityKey({...profile,name});
  if(!id) continue;
  const previous=index.get(id);
  index.set(id,previous===undefined||previous===profile?profile:null);
 }
}

export function findCatalogProfile(label:Label):CatalogProfile|null {
 const id=catalogIdentityKey(label);
 return id?index.get(id)??null:null;
}

type DupeEntry = Pick<CatalogDupe,'evidence'|'sources'> & {
 originalId:string;
 alternative:Label & {aliases?:string[]};
};
const profilesById=new Map(catalogProfiles.map(profile=>[profile.id,profile]));
const alternativesByOriginal=new Map<string,CatalogDupe[]>();
const originalsByAlternative=new Map<string,CatalogDupe[]>();
function addDupeLink(target:Map<string,CatalogDupe[]>,id:string,match:CatalogDupe) {
 const matches=target.get(id);
 if(matches) matches.push(match);
 else target.set(id,[match]);
}

for(const {originalId,alternative:{brand,name,concentration,aliases},evidence,sources} of dupeEntries as DupeEntry[]) {
 const original=profilesById.get(originalId);
 if(!original) continue;
 const label={brand,name,concentration};
 addDupeLink(alternativesByOriginal,originalId,{...label,evidence,sources});
 const citedOriginal={brand:original.brand,name:original.name,concentration:original.concentration,evidence,sources};
 for(const id of new Set([name,...(aliases??[])].map(alias=>catalogIdentityKey({...label,name:alias})))) {
  if(!id) continue;
  addDupeLink(originalsByAlternative,id,citedOriginal);
 }
}

export function findCatalogDupes(label:Label,profile=findCatalogProfile(label)):CatalogDupeLinks {
 const id=catalogIdentityKey(label);
 return {
  alternatives:profile?alternativesByOriginal.get(profile.id)?.slice(0,3)??[]:[],
  originals:id?originalsByAlternative.get(id)??[]:[],
 };
}
