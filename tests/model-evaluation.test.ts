import {test} from 'node:test';
import assert from 'node:assert/strict';
import {factScore,garmentFacts,colorFacts,evaluateOutfit,acceptance,inputFingerprint} from '../scripts/model-evaluation.ts';
import {parseOutfitText} from '../src/lib/outfit.ts';
import {prepareFixtures} from '../scripts/model-fixtures.mjs';
import {mkdtempSync,writeFileSync,readFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('evaluation counts omissions and hallucinations rather than rewarding empty or repeated outputs',()=>{
 assert.deepEqual(factScore(['shirt','shirt'],['shirt','trousers']),{precision:1,recall:.5,f1:2/3,tp:1,fp:0,fn:1});
 assert.equal(factScore([],['shirt']).f1,0);
 assert.equal(factScore(['shirt','hat'],['shirt']).precision,.5);
});

test('evaluation normalizes only declared garment and color synonyms',()=>{
 assert.deepEqual(garmentFacts(['white T-shirt','navy pants','brown loafers']),['shirt','trousers','shoes']);
 assert.deepEqual(colorFacts(['navy blue','grey','cream','tan']),['blue','gray','white','beige']);
 assert.deepEqual(garmentFacts(['mystery object']),['other:mystery object']);
 assert.deepEqual(garmentFacts(['red dress','blue dresses']),['dress']);
 assert.deepEqual(garmentFacts(['Red dress with a flared skirt','Green hooded top']),['dress','hoodie']);
});

test('evaluation reports raw unsupported outfit claims separately from a safe app abstention',()=>{
 const raw={...parseOutfitText('white shirt'),garments:['fragrance bottle'],colors:['brown'],hasOutfit:true};
 const result=evaluateOutfit(raw,{hasOutfit:false,garments:[],colors:[]});
 assert.equal(result.schemaValid,true);assert.equal(result.rawAbstained,false);assert.equal(result.appAbstained,true);
 assert.equal(result.rawUnsupported,true);
});

test('evaluation cannot pass with inadequate coverage or unsafe output despite perfect agreement',()=>{
 const good={schemaRate:1,abstentionRate:1,bottleGroundingSafe:true,bottleRecall:1,garmentF1:1,colorF1:1,topSoloAgreement:1,boundariesSafe:true,coverageComplete:true};
 assert.equal(acceptance(good).passed,true);
 assert.equal(acceptance({...good,coverageComplete:false}).passed,false);
 assert.equal(acceptance({...good,bottleGroundingSafe:false}).passed,false);
 assert.equal(acceptance({...good,garmentF1:.89}).passed,false);
 assert.equal(acceptance({...good,bottleRecall:0}).passed,false);
});

test('evaluation binds output reuse to the image, prompt, task and schema',()=>{
 const input={task:'bottle',kind:'image',instructions:'Read the label.',text:'Label only.',schema:{type:'object'},imageSha256:'synthetic-image'};
 assert.equal(inputFingerprint(input),inputFingerprint({...input}));
 for(const change of [{text:'Describe clothing.'},{imageSha256:'different-image'},{schema:{type:'array'}},{task:'outfit'}])assert.notEqual(inputFingerprint(input),inputFingerprint({...input,...change}));
});

test('fixture preparation cannot overwrite unrelated files in an existing output directory',async()=>{
 const directory=mkdtempSync(join(tmpdir(),'fragout-fixture-')),sentinel=join(directory,'c01.jpg');writeFileSync(sentinel,'unrelated-content');
 try{await assert.rejects(()=>prepareFixtures(directory),/empty|existing/i);assert.equal(readFileSync(sentinel,'utf8'),'unrelated-content');}
 finally{unlinkSync(sentinel);rmdirSync(directory);}
});
