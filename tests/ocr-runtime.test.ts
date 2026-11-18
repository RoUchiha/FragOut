import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import sharp from 'sharp';

const require=createRequire(import.meta.url);
function load(){
 const module={exports:{} as {readBottleLabel:(image:{data:string;mime:string})=>Promise<string[]>}},calls:{path:string}[]=[];
 const source=readFileSync(new URL('../src/lib/bottle-label-ocr.ts',import.meta.url),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,{
  module,exports:module.exports,Buffer,process,setTimeout,clearTimeout,require:(name:string)=>{
   if(name==='@tesseract.js-data/eng')throw new Error('Language module is not resolvable in this serverless package');
   if(name==='tesseract.js')return {OEM:{LSTM_ONLY:1},PSM:{SPARSE_TEXT:11},createWorker:async(_language:string,_engine:number,options:{langPath:string})=>{
    calls.push({path:options.langPath});return {setParameters:async()=>{},recognize:async()=>({data:{tsv:'5\t1\t1\t1\t1\t1\t0\t0\t0\t0\t95\tDior'}}),terminate:async()=>{}};
   }};
   return require(name);
  },
 });
 return {read:module.exports.readBottleLabel,calls};
}

test('loading the API OCR adapter does not eagerly require its optional language module or worker',()=>{
 const h=load();assert.equal(typeof h.read,'function');assert.equal(h.calls.length,0);
});

test('OCR uses the local traced English data rather than a package alias or remote language download',async()=>{
 const h=load(),png=await sharp({create:{width:100,height:100,channels:3,background:'#fff'}}).png().toBuffer();
 const result=await h.read({data:png.toString('base64'),mime:'image/png'});
 assert.ok(result.includes('Dior'));assert.equal(h.calls[0].path,join(process.cwd(),'node_modules','@tesseract.js-data','eng','4.0.0_best_int'));
 assert.ok(existsSync(join(h.calls[0].path,'eng.traineddata.gz')));
});
