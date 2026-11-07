import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {catalogProfiles,findCatalogProfile} from '../src/lib/catalog.ts';

test('catalog matches exact concentration and flanker with common label formatting',()=>{
 const edt=findCatalogProfile({brand:'Christian Dior',name:'Dior Sauvage Eau de Toilette',concentration:'EDT'});
 const edp=findCatalogProfile({brand:'Dior',name:'Sauvage',concentration:'EDP'});
 assert.equal(edt?.concentration,'EDT');
 assert.equal(edp?.concentration,'EDP');
 assert.notEqual(edt?.id,edp?.id);
 for(const [name,concentration] of [
  ['Sauvage','UNKNOWN'],['Sauvage Eau de Parfum','EDT'],['Sauvage Elixir','EDP'],
  ['Sauvage Limited Edition 2099','EDP'],
 ]) assert.equal(findCatalogProfile({brand:'Dior',name,concentration}),null);
 assert.equal(findCatalogProfile({brand:'Wrong house',name:'Sauvage',concentration:'EDP'}),null);
});

test('catalog checks every displayed note and wear metric across publishers',()=>{
 assert.ok(catalogProfiles.length>=20);
 for(const profile of catalogProfiles) {
  const sources=new Map(profile.sources.map(source=>[source.id,source]));
  assert.equal(sources.size,profile.sources.length);
  for(const source of sources.values()) assert.equal(new URL(source.url).protocol,'https:');
  const crossChecked=(ids:string[])=>{
   const publishers=ids.map(id=>sources.get(id)?.publisher);
   assert.ok(publishers.every(Boolean));
   assert.ok(new Set(publishers).size>=2);
  };
  for(const note of profile.notes) crossChecked(note.sourceIds);
  for(const metric of profile.performance) crossChecked(metric.reports.map(report=>report.sourceId));
 }
});

test('catalog retains wear-source disagreement and uses only credited local photo files',()=>{
 const naxos=findCatalogProfile({brand:'Xerjoff',name:'Naxos',concentration:'EDP'});
 assert.equal(naxos?.performance.find(metric=>metric.kind==='longevity')?.reports.length,2);
 assert.equal(new Set(naxos?.performance.find(metric=>metric.kind==='sillage')?.reports.map(report=>report.value)).size,2);
 const santal=findCatalogProfile({brand:'Le Labo',name:'Santal 33',concentration:'EDP'});
 assert.ok(santal?.notes.some(note=>note.name.toLowerCase()==='cardamom'));
 assert.ok(santal?.photo);
 for(const {photo,sources} of catalogProfiles) {
  if(!photo) continue;
  assert.match(photo.path,/^\/catalog\/bottles\/[a-z0-9-]+\.jpg$/);
  const source=sources.find(source=>source.id===photo.sourceId);
  assert.ok(source?.credit&&source.license);
  assert.ok(existsSync(new URL('../public'+photo.path,import.meta.url)));
 }
});
