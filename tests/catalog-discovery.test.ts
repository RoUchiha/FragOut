import assert from 'node:assert/strict';
import {test} from 'node:test';
import {discoverCatalog,compareProfiles,similarCatalog} from '../src/lib/catalog-discovery.ts';
import {catalogProfiles} from '../src/lib/catalog.ts';
import type {CatalogProfile} from '../src/lib/types.ts';

test('catalog discovery searches exact editions and paginates without duplicates',()=>{
 const first=discoverCatalog({query:'Dior',offset:0}),next=discoverCatalog({query:'Dior',offset:12});
 assert.ok(first.total>12);assert.equal(first.entries.length,12);
 assert.ok(first.entries.every(entry=>entry.brand.toLowerCase().includes('dior')));
 assert.ok(next.entries.every(entry=>!first.entries.some(previous=>entry.id===previous.id)));
});

test('note discovery supports include all or any, exclusions and note stages',()=>{
 const profile=catalogProfiles.find(profile=>profile.notes.some(note=>note.stage==='base')&&profile.notes.some(note=>note.stage==='top'))!;
 const top=profile.notes.find(note=>note.stage==='top')!.name,base=profile.notes.find(note=>note.stage==='base')!.name;
 const options={query:profile.name,include:[top],stage:'top' as const};
 assert.ok(discoverCatalog(options).entries.some(entry=>entry.id===profile.id));
 assert.ok(!discoverCatalog({...options,exclude:[top]}).entries.some(entry=>entry.id===profile.id));
 assert.ok(!discoverCatalog({...options,include:['nonexistent note']}).entries.length);
 assert.ok(discoverCatalog({...options,include:[top,'nonexistent note'],match:'any'}).entries.some(entry=>entry.id===profile.id));
 assert.ok(!discoverCatalog({...options,include:[top,'nonexistent note'],match:'all'}).entries.length);
 assert.ok(discoverCatalog({...options,include:[base],stage:'base'}).entries.some(entry=>entry.id===profile.id));
 const excludedOnly=discoverCatalog({exclude:['vanilla']});
 assert.ok(excludedOnly.entries.every(entry=>catalogProfiles.some(profile=>profile.id===entry.id&&profile.notes.length)),'Unknown notes must not pass exclusion filters');
});

test('comparison distinguishes missing facts and never treats missing notes as zero similarity',()=>{
 const known=catalogProfiles.find(profile=>profile.notes.length>2)!;
 const empty:CatalogProfile={...known,id:'missing',notes:[],ratings:[],performance:[],releaseYear:undefined};
 const unknown=compareProfiles(known,empty);
 assert.equal(unknown.noteOverlap,null);assert.deepEqual(unknown.sharedNotes,[]);
 const same=compareProfiles(known,known);
 assert.equal(same.noteOverlap,100);assert.ok(same.sharedNotes.length);
 assert.equal(compareProfiles(null,null).noteOverlap,null);
});

test('similar listed notes excludes the same edition and gives a traceable shared-note count',()=>{
 const profile=catalogProfiles.find(profile=>profile.notes.length>=6)!;
 const matches=similarCatalog(profile);
 assert.ok(matches.length);assert.ok(matches.every(match=>match.edition.id!==profile.id&&match.sharedNotes.length>0));
 assert.ok(matches.every(match=>match.sharedNotes.every(note=>profile.notes.some(own=>own.name.toLowerCase()===note.toLowerCase()))));
 assert.deepEqual(similarCatalog(null),[]);
});
