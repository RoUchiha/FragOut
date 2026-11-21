import {test} from 'node:test';
import assert from 'node:assert/strict';
import {supplementShortLines,type OcrLine,type OcrWord} from '../src/lib/bottle-ocr-lines.ts';
const base:OcrLine[]=[
 {text:'BLEU',left:503,right:754,top:610,bottom:715},
 {text:'CHANEL',left:453,right:804,top:746,bottom:800},
];
const word:OcrWord={text:'DE',left:604,right:645,top:693,bottom:714,confidence:96};
test('OCR can add an independently recognized small word between aligned label lines',()=>{
 assert.equal(supplementShortLines(base,[word]),'BLEU\nDE\nCHANEL');
});
test('OCR does not guess low-confidence, off-column, distant or ambiguous missing words',()=>{
 for(const extra of [[{...word,confidence:64}],[{...word,left:20,right:60}],[word,{...word,text:'LE'}]]){
  assert.equal(supplementShortLines(base,extra),'BLEU\nCHANEL');
 }
 assert.equal(supplementShortLines([base[0],{...base[1],top:1200,bottom:1250}],[word]),'BLEU\nCHANEL');
});
