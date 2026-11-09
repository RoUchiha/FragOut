import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import dupeRows from '../catalog/dupes.json' with {type:'json'};
import {catalogProfiles,findCatalogDupes,findCatalogProfile} from '../src/lib/catalog.ts';
import {catalogGalleryPhotos,catalogPhotoReferences,catalogPhotoSearchUrl} from '../src/lib/catalog-photos.ts';
import {catalogReferenceUrl,fragranceFacets} from '../src/lib/catalog-ratings.ts';
import {concentrationCodes} from '../src/lib/concentrations.ts';

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
 assert.ok(catalogProfiles.length>=200);
 for(const profile of catalogProfiles) {
  assert.equal(findCatalogProfile(profile)?.id,profile.id);
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

test('expanded catalog matches popular exact editions across concentrations',()=>{
 const known=[
  {brand:'Jo Malone',name:'Wood Sage & Sea Salt Cologne',concentration:'EDC',id:'jo-malone-london-wood-sage-and-sea-salt-edc'},
  {brand:'Nishane',name:'Hacivat Extrait de Parfum',concentration:'EXTRAIT',id:'nishane-hacivat-extrait'},
  {brand:'Sol de Janeiro',name:'Cheirosa 62™ Perfume Mist',concentration:'MIST',id:'sol-de-janeiro-cheirosa-62-mist'},
  {brand:'Lattafa',name:'Khamrah',concentration:'EDP',id:'lattafa-khamrah-edp'},
 ];
 for(const {id,...label} of known) {
  const profile=findCatalogProfile(label);
  assert.equal(profile?.id,id);
  assert.ok(profile.notes.length>=2);
  assert.equal(findCatalogProfile({...label,concentration:'UNKNOWN'}),null);
 }
 assert.equal(findCatalogProfile({brand:'Nishane',name:'Hacivat',concentration:'EDP'}),null);
 assert.equal(findCatalogProfile({brand:'Sol de Janeiro',name:'Cheirosa 62 Intense',concentration:'MIST'}),null);
 const label={brand:'Yves Saint Laurent',name:"La Nuit de L'Homme",concentration:'EDP'};
 assert.equal(findCatalogProfile(label),null);
 const original=findCatalogProfile({...label,name:label.name+' (2019)'});
 const reformulated=findCatalogProfile({...label,name:label.name+' (2026)'});
 assert.ok(original&&reformulated);
 assert.ok(original.notes.some(note=>note.name==='Grapefruit'));
 assert.ok(reformulated.notes.some(note=>note.name==='Tobacco'));
 assert.ok(original.links.some(link=>link.kind==='jomashop-listing'));
 assert.ok(!reformulated.links.some(link=>link.kind==='jomashop-listing'));
});

test('catalog retains wear-source disagreement and uses only credited local photo files',()=>{
 const naxos=findCatalogProfile({brand:'Xerjoff',name:'Naxos',concentration:'EDP'});
 assert.equal(naxos?.performance.find(metric=>metric.kind==='longevity')?.reports.length,2);
 assert.equal(new Set(naxos?.performance.find(metric=>metric.kind==='sillage')?.reports.map(report=>report.value)).size,2);
 const santal=findCatalogProfile({brand:'Le Labo',name:'Santal 33',concentration:'EDP'});
 assert.ok(santal?.notes.some(note=>note.name.toLowerCase()==='cardamom'));
 assert.ok(santal?.photo);
 const sauvage=findCatalogProfile({brand:'Dior',name:'Sauvage',concentration:'EDP'});
 assert.equal(sauvage?.additionalPhotos?.length,1);
 const paths=new Set<string>();
 for(const {id,photo,additionalPhotos,sources} of catalogProfiles) {
  const photos=photo?[photo,...(additionalPhotos??[])]:[];
  if(additionalPhotos) assert.ok(photo);
  assert.equal(new Set(photos.map(photo=>photo.sourceId)).size,photos.length);
  for(const image of photos) {
   assert.match(image.path,new RegExp('^/catalog/bottles/'+id+'(?:-[a-z0-9-]+)?\\.jpg$'));
   assert.ok(!paths.has(image.path));
   paths.add(image.path);
   const source=sources.find(source=>source.id===image.sourceId);
   assert.ok(source?.kind==='photo'&&source.credit&&source.license);
   assert.ok(existsSync(new URL('../public'+image.path,import.meta.url)));
  }
 }
});

test('FragDex ratings retain distinct sourced estimates, leaving absent facets empty',()=>{
 const naxos=findCatalogProfile({brand:'Xerjoff',name:'Naxos',concentration:'EDP'})!;
 assert.deepEqual(naxos.ratings.filter(r=>r.facet==='longevity').map(r=>[r.sourceId,r.score]),[
  ['mysecretcart',5],['gouttes',4.5],
 ]);
 assert.deepEqual(naxos.ratings.filter(r=>['sillage','projection'].includes(r.facet)).map(r=>[r.facet,r.sourceId,r.score]),[
  ['sillage','mysecretcart',4],['projection','gouttes',5],
 ]);
 const santal=findCatalogProfile({brand:'Le Labo',name:'Santal 33',concentration:'EDP'})!;
 assert.ok(santal.ratings.some(r=>r.facet==='longevity'&&r.kind==='estimate'));
 assert.ok(!santal.ratings.some(r=>r.facet==='projection'));
 const facets=new Set(fragranceFacets.map(([key])=>key));
 for(const entry of catalogProfiles) for(const rating of entry.ratings) {
  assert.ok(facets.has(rating.facet));
  assert.ok(rating.score>=1&&rating.score<=5);
  assert.ok(entry.sources.some(source=>source.id===rating.sourceId&&source.license));
 }
});

test('FragDex links use reviewed edition pages and reject unsafe destinations',()=>{
 const edt=findCatalogProfile({brand:'Dior',name:'Sauvage',concentration:'EDT'})!;
 const edp=findCatalogProfile({brand:'Dior',name:'Sauvage',concentration:'EDP'})!;
 for(const entry of [edt,edp]){
  assert.ok(entry.links.some(link=>link.label==='View on Fragrantica'));
  assert.ok(entry.links.some(link=>link.label==='View on Jomashop'));
  assert.ok(entry.links.every(link=>catalogReferenceUrl(link.url)));
 }
 assert.notEqual(edt.links[0].url,edp.links[0].url);
 for(const url of [
  'javascript:alert(1)','file:///C:/secret','https://user:secret@example.test/',
  'http://www.fragrantica.com/','https://localhost/','https://127.0.0.1/','https://[::1]/',
 ]) assert.equal(catalogReferenceUrl(url),null);
});

test('Jomashop galleries point only to distinct, exact listing pages',()=>{
 const productUrls=new Set<string>();
 for(const profile of catalogProfiles) {
  const product=profile.links.find(link=>link.label==='View on Jomashop');
  const galleries=profile.links.filter(link=>link.kind==='jomashop-listing');
  assert.deepEqual(galleries,product?[product]:[]);
  if(!product) continue;
  assert.match(product.url,/^https:\/\/www\.jomashop\.com\/[a-z0-9-]+\.html$/);
  assert.ok(!productUrls.has(product.url));
  productUrls.add(product.url);
 }
 assert.ok(productUrls.size>=60);
 const lightBlue=findCatalogProfile({brand:'Dolce & Gabbana',name:'Light Blue',concentration:'EDT'})!;
 assert.equal(lightBlue.releaseYear,2025);
 const lightBlueListing=lightBlue.links.find(link=>link.kind==='jomashop-listing');
 assert.ok(lightBlueListing);
 assert.ok(lightBlueListing.url.endsWith('-8057971188192.html'));
 assert.equal(lightBlueListing.bottleEdition,'2025 bottle');
});

test('web-sourced photos distinguish lookalike releases and retain their credits',()=>{
 const edt=findCatalogProfile({brand:'Dior',name:'Sauvage',concentration:'EDT'})!;
 const edp=findCatalogProfile({brand:'Dior',name:'Sauvage',concentration:'EDP'})!;
 assert.equal(edt.photo?.path,'/catalog/bottles/dior-sauvage-edt.jpg');
 assert.equal(edp.photo?.path,'/catalog/bottles/dior-sauvage-edp.jpg');
 const prada=findCatalogProfile({brand:'Prada',name:'Paradoxe',concentration:'EDP'})!;
 assert.ok(prada.photo);
 assert.equal(prada.additionalPhotos?.length,1);
 const narciso=findCatalogProfile({brand:'Narciso Rodriguez',name:'For Her',concentration:'EDP'})!;
 assert.equal(narciso.releaseYear,2006);
 assert.ok(narciso.sources.some(source=>source.kind==='photo'&&source.license?.name==='CC BY 3.0'));
});

test('the photo gallery skips failed, duplicate and non-catalog images',()=>{
 const profile=findCatalogProfile({brand:'Dior',name:'Sauvage',concentration:'EDP'})!;
 const first=profile.photo!;
 const [second]=profile.additionalPhotos!;
 assert.deepEqual(catalogGalleryPhotos({...profile,additionalPhotos:[
  first,{...first,path:'https://example.com/other.jpg'},second,
 ]},[first.path]),[second]);
 assert.deepEqual(catalogGalleryPhotos(profile,[first.path,second.path]),[]);
});

test('barcode-reviewed photos stay with the matching fragrance edition',()=>{
 const eauTendre={brand:'Chanel',name:'Chance Eau Tendre'};
 const edt=findCatalogProfile({...eauTendre,concentration:'EDT'})!;
 const edp=findCatalogProfile({...eauTendre,concentration:'EDP'})!;
 assert.match(edt.photo?.caption??'',/Eau de Toilette/);
 assert.notEqual(edt.photo?.path,edp.photo?.path);
 const rouge={brand:'MFK',name:'Baccarat Rouge 540'};
 const bottle=findCatalogProfile({...rouge,concentration:'EDP'})!;
 assert.ok(bottle.photo&&bottle.additionalPhotos?.length);
 assert.notEqual(bottle.photo.path,findCatalogProfile({...rouge,concentration:'EXTRAIT'})?.photo?.path);
 assert.ok(bottle.sources.some(source=>source.publisher==='Open Beauty Facts'&&source.kind==='photo'));
});

test('FragDex has a photo destination for every known edition',()=>{
 for(const profile of catalogProfiles) {
  const references=catalogPhotoReferences(profile);
  assert.ok(references.length>0,profile.id);
  assert.ok(references.every(({url})=>catalogReferenceUrl(url)),profile.id);
  assert.equal(new Set(references.map(({url})=>url)).size,references.length);
 }
 const profile=findCatalogProfile({brand:'Dior',name:'Sauvage',concentration:'EDT'})!;
 assert.match(catalogPhotoReferences(profile)[0].url,/^https:\/\/www\.jomashop\.com\/.+\.html$/);
 assert.ok(!catalogPhotoReferences({...profile,links:[],sources:[]})[0].url.includes('jomashop'));
});

test('the user-initiated web photo search encodes only the bottle identity',()=>{
 const label={brand:'Example & Co',name:'One #2? edt',concentration:'EDT',memo:'private-note'};
 const url=new URL(catalogPhotoSearchUrl(label));
 assert.equal(url.origin,'https://www.google.com');
 assert.equal(url.searchParams.get('udm'),'2');
 assert.equal(url.searchParams.get('q'),'Example & Co One #2? edt EDT bottle');
 assert.ok(!url.href.includes(label.memo));
});

test('dupe links resolve both directions and keep concentration and flankers distinct',()=>{
 const original={brand:'Jean Paul Gaultier',name:'Ultra Male',concentration:'EDT'};
 const copy={brand:'Afnan',name:'9 PM',concentration:'EDP'};
 const {alternatives}=findCatalogDupes(original);
 assert.ok(alternatives.some(match=>match.brand==='Afnan'&&match.name==='9PM'&&match.evidence==='community'));
 assert.ok(alternatives.length<=3);
 const reverse=findCatalogDupes({...copy,brand:'Afnan Perfumes'}).originals;
 assert.deepEqual(reverse.map(({brand,name,concentration})=>({brand,name,concentration})),[original]);
 assert.deepEqual(findCatalogDupes({...copy,concentration:'UNKNOWN'}).originals,[]);
 assert.deepEqual(findCatalogDupes({...copy,name:'9 PM Night Out',concentration:'EXTRAIT'}).originals,[]);
 assert.deepEqual(findCatalogDupes({...original,concentration:'EDP'}).alternatives,[]);
});

test('every published dupe has an exact original, a reciprocal lookup and public evidence',()=>{
 const profiles=new Map(catalogProfiles.map(profile=>[profile.id,profile]));
 const edges=new Set<string>();
 for(const {originalId,alternative,evidence,sources} of dupeRows) {
  const original=profiles.get(originalId);
  assert.ok(original,originalId);
  assert.ok(concentrationCodes.some(code=>code!=='UNKNOWN'&&code===alternative.concentration));
  assert.notEqual(findCatalogProfile(alternative)?.id,originalId);
  assert.ok(['brand','community'].includes(evidence));
  assert.ok(sources.every(source=>source.publisher&&catalogReferenceUrl(source.url)));
  const publishers=new Set(sources.map(source=>source.publisher));
  assert.ok(publishers.size>=(evidence==='community'?2:1));
  const edge=JSON.stringify([originalId,alternative.brand,alternative.name,alternative.concentration]);
  assert.ok(!edges.has(edge));
  edges.add(edge);
  assert.ok(findCatalogDupes(alternative).originals.some(match=>
   match.brand===original.brand&&match.name===original.name&&match.concentration===original.concentration),edge);
  const {alternatives}=findCatalogDupes(original);
  assert.ok(alternatives.length>0&&alternatives.length<=3);
 }
});
