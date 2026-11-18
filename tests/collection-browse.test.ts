import assert from 'node:assert/strict';
import {test} from 'node:test';
import {browseCollection,collectionDefaults,collectionNotes,collectionProfile} from '../src/lib/collection-browse.ts';
import {demoBottles,defaultContext} from '../src/lib/seed.ts';
import type {WearEvent} from '../src/lib/types.ts';

test('collection note facets count each bottle once and respect ownership',()=>{
 const owned={...demoBottles[0],notes:['Musk','musk'],catalogNotes:['MUSK','bergamot']};
 const wish={...demoBottles[1],notes:['musk'],ownership:'WISHLIST' as const};
 assert.equal(collectionNotes([owned,wish]).find(note=>note.name==='MUSK'||note.name.toLowerCase()==='musk')?.count,1);
 assert.equal(collectionNotes([owned,wish],'ALL').find(note=>note.name.toLowerCase()==='musk')?.count,2);
});

test('collection filters combine notes, favorites and concentration without changing stored order',()=>{
 const bottles=demoBottles.map(bottle=>({...bottle,catalogNotes:['cedar']}));
 const before=bottles.map(bottle=>bottle.id);
 const filtered=browseCollection(bottles,[],{...collectionDefaults,note:'CEDAR',favorites:true,concentration:'EDP'});
 assert.ok(filtered.length);
 assert.ok(filtered.every(bottle=>bottle.favorite&&bottle.concentration==='EDP'));
 assert.deepEqual(bottles.map(bottle=>bottle.id),before);
 assert.deepEqual(browseCollection(bottles,[],{...collectionDefaults,note:'not a recorded note'}),[]);
});

test('least-worn sorting counts only wear events and includes both bottles in a layered wear',()=>{
 const bottles=demoBottles.slice(0,3);
 const event:WearEvent={id:'wear',bottleIds:[bottles[0].id,bottles[1].id],names:[],reaction:'wore',occasion:'GENERAL',at:new Date().toISOString(),context:defaultContext};
 const history=[event,{...event,id:'like',bottleIds:[bottles[2].id],reaction:'saved' as const}];
 assert.equal(browseCollection(bottles,history,{...collectionDefaults,sort:'least-worn'})[0].id,bottles[2].id);
});

test('private shelves, brands and families combine with existing filters and legacy records',()=>{
 const bottles=[{...demoBottles[0],shelves:['Samples','Summer'],family:'Woody'},demoBottles[1]];
 const filters={...collectionDefaults,shelf:'samples',brand:bottles[0].brand,family:'woody'};
 assert.deepEqual(browseCollection(bottles,[],filters).map(b=>b.id),[bottles[0].id]);
 assert.deepEqual(browseCollection(bottles,[],{...filters,brand:'missing'}),[]);
 assert.ok(browseCollection(bottles,[],collectionDefaults).length);
});

test('collection profiler counts bottles once per note and labels partial catalog coverage',()=>{
 const first={...demoBottles[0],sizeMl:2,fillPct:50,rating:4,shelves:['Samples'],notes:['musk','MUSK'],catalogNotes:['musk','rose'],catalogNoteGroups:[{name:'rose',stage:'heart' as const}]};
 const second={...demoBottles[1],sizeMl:10,fillPct:0,rating:0,notes:[],catalogNotes:undefined};
 const result=collectionProfile([first,second]);
 assert.equal(result.total,2);assert.equal(result.notes.find(n=>n.name.toLowerCase()==='musk')?.count,1);
 assert.equal(result.catalogCoverage,1);assert.equal(result.averageRating,4);assert.equal(result.remainingMl,1);
 assert.equal(collectionProfile([first,second],'OWNED','heart').notes[0].name,'rose');
 assert.deepEqual(collectionProfile([]).notes,[]);assert.equal(collectionProfile([]).averageRating,null);
 assert.equal(collectionProfile([first,{...second,ownership:'WISHLIST',fillPct:100}],'ALL').remainingMl,1,'Wishlist volume is not owned inventory');
});
