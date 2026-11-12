import {createHash} from 'node:crypto';
import publicEditions from '../../catalog/thumbnail-editions.json' with {type:'json'};
import dupes from '../../catalog/dupes.json' with {type:'json'};
import {catalogIdentityKey,catalogProfiles,findCatalogProfile} from './catalog.ts';
import type {CatalogEdition,CatalogProfile} from './types.ts';

type Label=Pick<CatalogEdition,'brand'|'name'|'concentration'>;
export const catalogProfilesById=new Map(catalogProfiles.map(profile=>[profile.id,profile]));
const byIdentity=new Map<string,CatalogEdition|null>();
const byId=new Map<string,CatalogEdition>();
const unqualified=new Set<string>();
const publicAliases:Record<string,string[]>={'scento:versace-the-dreamer-toilette':['The Dreamer']};

function register(edition:CatalogEdition,aliases:string[]=[]) {
 const key=catalogIdentityKey(edition);
 if(!key||unqualified.has(key)||findCatalogProfile(edition)) return;
 const previous=byIdentity.get(key);
 if(previous===null) return;
 const canonical=previous&&catalogIdentityKey(previous)===key?previous:edition;
 byIdentity.set(key,canonical);
 byId.set(canonical.id,canonical);
 for(const name of aliases) {
  const alias=catalogIdentityKey({...edition,name});
  if(!alias||alias===key||unqualified.has(alias)) continue;
  const prior=byIdentity.get(alias);
  if(prior===undefined||prior?.id===canonical.id) byIdentity.set(alias,canonical);
  else byIdentity.set(alias,null);
 }
}

function editionOf({id,brand,name,concentration,releaseYear}:CatalogEdition):CatalogEdition {
 return {id,brand,name,concentration,...(releaseYear?{releaseYear}:{})};
}

for(const profile of catalogProfiles) {
 const name=profile.name.replace(/ \((?:19|20)\d{2}\)$/,'');
 const key=catalogIdentityKey({...profile,name});
 if(key&&name!==profile.name) unqualified.add(key);
 byId.set(profile.id,editionOf(profile));
}
for(const edition of publicEditions) register(editionOf(edition),publicAliases[edition.id]);
for(const {alternative} of dupes) {
 const {brand,name,concentration}=alternative;
 const key=catalogIdentityKey(alternative);
 if(!key) continue;
 const id='dupe:'+createHash('sha256').update(key).digest('hex').slice(0,20);
 register({id,brand,name,concentration},'aliases' in alternative?alternative.aliases:[]);
}

export function findPublicCatalogEdition(label:Label,profile:CatalogProfile|null=findCatalogProfile(label)) {
 if(profile) return byId.get(profile.id)??null;
 const key=catalogIdentityKey(label);
 return key&&!unqualified.has(key)?byIdentity.get(key)??null:null;
}

export function catalogEditionById(id:string){return byId.get(id)??null;}

const searchKey=(text:string)=>text.normalize('NFKD').toLowerCase().replace(/\p{M}/gu,'')
 .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const formats:Record<string,string>={EDP:'Eau de Parfum',EDT:'Eau de Toilette',EDC:'Eau de Cologne',
 EXTRAIT:'Extrait de Parfum',MIST:'Fragrance Mist',OIL:'Perfume Oil'};
const searchIndex=[...byId.values()].map(edition=>({edition,key:searchKey([
 edition.brand,edition.name,edition.concentration,formats[edition.concentration]??'',edition.releaseYear??'',
 ...(publicAliases[edition.id]??[]),...(catalogProfilesById.get(edition.id)?.aliases??[]),
].join(' '))}));

export function searchCatalogEditions(q:string,limit=40) {
 const terms=searchKey(q).split(' ').filter(Boolean);
 return searchIndex.filter(row=>terms.every(term=>row.key.includes(term))).slice(0,limit).map(row=>row.edition);
}
