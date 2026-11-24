import assert from 'node:assert/strict';
import {test} from 'node:test';
import snapshot from '../catalog/layering.json' with {type:'json'};
import extraDupes from '../catalog/layering-dupes.json' with {type:'json'};
import {catalogEditionById} from '../src/lib/catalog-editions.ts';
import {findCatalogDupes} from '../src/lib/catalog.ts';
import {createLayeringReferenceLookup,layeringReferenceFor,searchLayeringCatalog} from '../src/lib/layering-catalog.ts';
import {rankCombos} from '../src/lib/engine.ts';
import {defaultContext,defaultPreferences,demoBottles} from '../src/lib/seed.ts';
import type {Bottle} from '../src/lib/types.ts';

const first:Bottle={...demoBottles[0],id:'layer-a',variantId:'variant-a',brand:'Rabanne',name:'1 Million',concentration:'EDT',provenance:'personal'};
const second:Bottle={...demoBottles[0],id:'layer-b',variantId:'variant-b',brand:'Kilian Paris',name:"Angels' Share",concentration:'EDP',provenance:'personal'};

test('every imported pairing has a unique public source and resolvable catalog references',()=>{
 assert.equal(snapshot.entries.length,snapshot.listed);
 assert.deepEqual(snapshot.failures,[]);
 assert.equal(new Set(snapshot.entries.map(entry=>entry.id)).size,snapshot.entries.length);
 for(const entry of snapshot.entries) {
  assert.match(entry.source.url,/^https:\/\/willitlayer\.com\/layer\/[^/]+\/[^/]+$/);
  assert.equal(entry.source.method,'algorithmic');
  assert.equal(entry.source.scale,10);
  assert.ok(entry.source.score===null||(entry.source.score>=0&&entry.source.score<=10));
  for(const side of [entry.a,entry.b])for(const id of side.catalogIds)assert.ok(catalogEditionById(id),id);
 }
});

test('source predictions stay experimental and do not enter evidence-only recommendations',()=>{
 const reference=layeringReferenceFor(first,second);
 assert.ok(reference);
 assert.equal(reference.dupeAdapted,false);
 assert.equal(reference.editionUnconfirmed,true);
 assert.deepEqual(rankCombos([first,second],defaultContext,defaultPreferences,'evidence',[]),[]);
 const [pair]=rankCombos([first,second],defaultContext,defaultPreferences,'experimental',[],[],3,undefined,layeringReferenceFor);
 assert.equal(pair.tier,'model_hypothesis');
 assert.equal(pair.reference?.url,reference.url);
 assert.deepEqual(pair.sources,[reference.url]);
 assert.deepEqual(rankCombos([first,second],{...defaultContext,policy:'NO_FRAGRANCE'},defaultPreferences,'experimental',[]),[]);
});

test('a verified dupe substitution retains the source pair and never inherits its score as a new rating',()=>{
 const [alternative]=findCatalogDupes(first).alternatives;
 assert.ok(alternative);
 const dupe:Bottle={...first,...alternative,id:'dupe-bottle',variantId:'dupe-variant'};
 const reference=layeringReferenceFor(dupe,second);
 assert.ok(reference?.dupeAdapted);
 assert.deepEqual(reference.originalPair,layeringReferenceFor(first,second)?.originalPair);
 const [pair]=rankCombos([dupe,second],defaultContext,defaultPreferences,'experimental',[],[],3,undefined,layeringReferenceFor);
 assert.equal(pair.tier,'dupe_adapted_hypothesis');
 assert.ok(pair.reference?.dupeAdapted);
 assert.deepEqual(rankCombos([dupe,second],defaultContext,defaultPreferences,'evidence',[]),[]);
});

test('request-scoped reference lookup preserves source identity and refreshes changed profiles between requests',()=>{
 const mutable={...first},lookup=createLayeringReferenceLookup();
 const source=lookup(mutable,second);assert.ok(source);assert.equal(source.dupeAdapted,false);
 assert.deepEqual(lookup(second,mutable),source);
 const [alternative]=findCatalogDupes(first).alternatives;
 const dupe={...first,...alternative,id:'request-dupe',variantId:'request-dupe'};
 assert.equal(lookup(dupe,second)?.dupeAdapted,true);
 mutable.brand='Unknown synthetic house';mutable.name='Unknown synthetic scent';
 assert.equal(createLayeringReferenceLookup()(mutable,second),undefined);
});

test('layering search paginates without duplicates and scopes owned matches to its input collection',()=>{
 const pages=[];
 for(let offset=0;offset<snapshot.entries.length;offset+=12)pages.push(...searchLayeringCatalog([], '',false,offset).entries);
 assert.equal(new Set(pages.map(entry=>entry.id)).size,snapshot.entries.length);
 assert.equal(searchLayeringCatalog([],'',true).total,0);
 const owned=searchLayeringCatalog([first],'1 million',true);
 assert.ok(owned.total>0);
 assert.ok(owned.entries.every(entry=>entry.a.owned.some(bottle=>bottle.id===first.id)||entry.b.owned.some(bottle=>bottle.id===first.id)));
 assert.ok(owned.entries.flatMap(entry=>[...entry.a.editions,...entry.b.editions]).some(edition=>edition.dupes.alternatives.length));
});

test('maker-stated extra dupes appear beside their source fragrance without inventing a notes profile',()=>{
 const extras=searchLayeringCatalog([],'virgin island water').entries.flatMap(entry=>[entry.a,entry.b]);
 assert.ok(extras.some(side=>side.alternatives.some(dupe=>dupe.brand==='Montagne Parfums'&&dupe.name==='Buko')));
 for(const row of extraDupes) {
  assert.equal(row.evidence,'brand');
  if(row.alternative.brand==='Montagne Parfums') {
   assert.equal(row.alternative.concentration,'EDP');
   assert.match(row.sources[0].url,/^https:\/\/www\.montagneparfums\.com\/fragrance\//);
  }else{
   assert.equal(row.alternative.brand,'DUA Fragrances');
   assert.equal(row.alternative.concentration,'EXTRAIT');
   assert.match(row.sources[0].url,/^https:\/\/theduabrand\.com\/products\//);
  }
 }
 const althair:Bottle={...first,id:'althair',variantId:'althair',brand:'Parfums de Marly',name:'Althaïr',concentration:'EDP'};
 const library=searchLayeringCatalog([althair],'althair',true);
 assert.ok(library.total>0);
 assert.ok(library.entries.flatMap(entry=>[entry.a,entry.b]).some(side=>side.alternatives.some(dupe=>dupe.name==='Ambre Vanille')));
});
