import assert from 'node:assert/strict';
import {test} from 'node:test';
import {matchesBottleSearch,resolveScentSearch} from '../src/lib/scent-search.ts';
import {demoBottles,defaultContext,defaultPreferences} from '../src/lib/seed.ts';
import {rankCombos} from '../src/lib/engine.ts';

test('search cues combine mood, vibe and occasion without consuming a fragrance name', () => {
 assert.deepEqual(resolveScentSearch('tired & clean for work',demoBottles),{mood:'TIRED',vibe:'CLEAN',occasion:'WORK'});
 assert.deepEqual(resolveScentSearch('mysterious date night',demoBottles),{vibe:'MYSTERIOUS',occasion:'DATE'});
 assert.deepEqual(resolveScentSearch('Salt Air',demoBottles),{search:'Salt Air'});
 assert.deepEqual(resolveScentSearch('Happy',[{...demoBottles[0],name:'Happy'}]),{search:'Happy'});
 assert.deepEqual(resolveScentSearch('clean musk',demoBottles),{search:'clean musk'});
});

test('fragrance search supports punctuation and notes without indexing private memos', () => {
 const bottle={...demoBottles[0],name:'Café Rose',notes:['amber','vanilla'],memo:'private sentinel'};
 assert.ok(matchesBottleSearch(bottle,'cafe-rose amber'));
 assert.equal(matchesBottleSearch(bottle,'private sentinel'),false);
 assert.equal(matchesBottleSearch(bottle,'???'),false);
});

test('an eligible named pair anchor stays searchable outside the broad candidate cap', () => {
 const collection = Array.from({length:100},(_,index)=>({
  ...demoBottles[0],id:'higher-'+index,variantId:'higher-'+index,
 }));
 const named = {...demoBottles[2],id:'anchor'};
 const pairs = rankCombos([...collection,named],defaultContext,defaultPreferences,'experimental',[],[],3,new Set([named.id]));
 assert.ok(pairs.length>0);
 assert.ok(pairs.every(pair=>pair.a.id===named.id||pair.b.id===named.id));
 assert.deepEqual(rankCombos([...collection,named],defaultContext,defaultPreferences,'evidence',[],[],3,new Set([named.id])),[]);
});
