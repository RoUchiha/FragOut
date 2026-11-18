import assert from 'node:assert/strict';
import {test} from 'node:test';
import {browseCollection,collectionDefaults,collectionNotes} from '../src/lib/collection-browse.ts';
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
