import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pairKey,eligiblePairs,evaluateLayering,compareLayering} from '../scripts/layering-evaluation.ts';

const bottle=(id:string,extra:Record<string,unknown>={})=>({id,variantId:'v'+id,brand:'Synthetic',name:id,concentration:'EDP',notes:['Musk','Sage'],strength:1,ownership:'OWNED',profileKnown:true,available:true,...extra});
const collection=[bottle('a'),bottle('b'),bottle('c'),bottle('d'),bottle('a-copy',{variantId:'va'})];
const context={occasion:'GENERAL',policy:'FREE',maxStrength:3,excludedNotes:[],excludedIds:[],rejectedPairs:[],evidenceOnly:false};
const combo=(a:string,b:string,extra:Record<string,unknown>={})=>({a,b,noteA:'Musk',noteB:'Sage',why:'An experimental combination of the supplied notes.',...extra});
const output=(combos:ReturnType<typeof combo>[])=>({combos,message:'Experimental pairings; not verified wearer evidence.'});

test('layering comparison treats the same edition in different bottles as the same pair',()=>{
 assert.equal(pairKey(collection,'a','b'),pairKey(collection,'b','a-copy'));
 assert.equal(eligiblePairs(collection,context).length,6);
 assert.equal(evaluateLayering(output([combo('a','a-copy')]),collection,context).constraintsValid,false);
});

test('layering constraints reject wishlist, unknown, empty, strong and avoided-note bottles',()=>{
 for(const extra of [{ownership:'WISHLIST'},{profileKnown:false},{available:false},{strength:3},{notes:['Vanilla']}]){
  const c=[bottle('a'),bottle('b',extra)],ctx={...context,occasion:'WORK',excludedNotes:['Vanilla']};
  assert.equal(evaluateLayering(output([combo('a','b')]),c,ctx).constraintsValid,false);
 }
 assert.deepEqual(eligiblePairs(collection,{...context,policy:'NO_FRAGRANCE'}),[]);
 assert.deepEqual(eligiblePairs(collection,{...context,evidenceOnly:true}),[]);
 assert.equal(evaluateLayering(output([combo('a-copy','b')]),collection,{...context,rejectedPairs:[['a','b']]}).constraintsValid,false);
});

test('note citations must belong to the corresponding bottle, independently of valid pair IDs',()=>{
 const c=[bottle('a',{notes:['Sage']}),bottle('b',{notes:['Musk']})];
 assert.equal(evaluateLayering(output([combo('a','b',{noteA:'Sage',noteB:'Musk'})]),c,context).notesValid,true);
 assert.equal(evaluateLayering(output([combo('a','b')]),c,context).notesValid,false);
});

test('empty or duplicate outputs cannot inflate positive pair agreement',()=>{
 const empty=evaluateLayering(output([]),collection,context);
 assert.equal(empty.coverageValid,false);assert.equal(compareLayering(empty,empty).overlapAt3,0);
 const repeated=evaluateLayering(output([combo('a','b'),combo('b','a-copy'),combo('a','c')]),collection,context);
 assert.equal(repeated.constraintsValid,false);assert.equal(repeated.coverageValid,false);
});

test('pair overlap uses the requested slots and excludes forced and empty controls from discretion',()=>{
 const left=evaluateLayering(output([combo('a','b'),combo('a','c'),combo('a','d')]),collection,context);
 const right=evaluateLayering(output([combo('b','a-copy'),combo('b','c'),combo('c','d')]),collection,context);
 const result=compareLayering(left,right);assert.equal(result.overlapAt3,1/3);assert.equal(result.topOneSame,true);assert.equal(result.discretionary,true);
 const forced=evaluateLayering(output([combo('a','b')]),collection.slice(0,2),context);
 assert.equal(compareLayering(forced,forced).discretionary,false);
 const blocked=evaluateLayering(output([]),collection,{...context,policy:'NO_FRAGRANCE'});
 assert.equal(blocked.abstentionValid,true);assert.equal(compareLayering(blocked,blocked).discretionary,false);
});

test('set agreement distinguishes the same returned pair from unfilled comparison slots',()=>{
 const one=evaluateLayering(output([combo('a','b')]),collection,context);
 const same=evaluateLayering(output([combo('b','a-copy')]),collection,context);
 assert.equal(one.constraintsValid,true);assert.equal(one.coverageValid,false);
 assert.equal(compareLayering(one,same).overlapAt3,1/3);
 assert.equal(compareLayering(one,same).returnedSetJaccard,1);
 const empty=evaluateLayering(output([]),collection,context);
 assert.equal(compareLayering(empty,empty).returnedSetJaccard,null);
});

test('a comma-list diagnostic distinguishes citation formatting from actually unsupported notes',()=>{
 const list=evaluateLayering(output([combo('a','b',{noteA:'Musk, Sage'})]),collection,context);
 assert.equal(list.notesValid,false);assert.equal(list.commaListGrounded,true);
 const invented=evaluateLayering(output([combo('a','b',{noteA:'Musk, Tobacco'})]),collection,context);
 assert.equal(invented.commaListGrounded,false);
});
