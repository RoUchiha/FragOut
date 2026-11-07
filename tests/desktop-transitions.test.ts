import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(){
 const tree=ts.createSourceFile('App.tsx',readFileSync(new URL('../src/components/App.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const names=new Set(['generate','logout','returnToDemo']),functions:string[]=[];
 const visit=(node:ts.Node)=>{if(ts.isFunctionDeclaration(node)&&names.has(node.name?.text??''))functions.push(node.getText(tree));else ts.forEachChild(node,visit);};visit(tree);
 const module={exports:{} as any},screen:{account:object|null;pair:object[]|null;requestId:string|undefined;error:string}={account:{name:'Synthetic previous account'},pair:[{tier:'model_hypothesis'}],requestId:'earlier-experiment',error:''};
 let reject!:(reason:Error)=>void;const unavailable=new Promise((_,fail)=>{reject=fail;});
 vm.runInNewContext(ts.transpileModule(functions.join('\n')+'\nexports.generate=generate;exports.logout=logout;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{
  module,exports:module.exports,Error,intent:{mood:'SAD',vibe:'CLEAN'},intentRevision:{current:0},
  request:async(_path:string,_method:string,data:{action?:string})=>data.action==='logout'?{ok:true}:unavailable,
  setBusy:()=>{},setToast:()=>{},navigate:()=>{},clearPersonalState:()=>{},
  setCombos:(value:typeof screen.pair)=>{screen.pair=value;},setComboRequestId:(value:string|undefined)=>{screen.requestId=value;},setState:(value:object|null)=>{screen.account=value;},setError:(value:string)=>{screen.error=value;},notifyError:()=>{},
 });
 return {screen,generate:module.exports.generate,logout:module.exports.logout,fail:()=>reject(new Error('Synthetic server unavailable'))};
}

test('a failed replacement cannot restore experimental pairs under evidence-only controls',async()=>{
 const h=harness(),running=h.generate('WORK','evidence',()=>true);
 const displayedWhileWaiting=h.screen.pair;h.fail();await running;
 assert.equal(displayedWhileWaiting,null);assert.equal(h.screen.pair,null);assert.equal(h.screen.requestId,undefined);
});

test('confirmed logout hides the prior account even if opening the demo fails',async()=>{
 const h=harness(),running=h.logout();await new Promise(done=>setImmediate(done));
 const displayedWhileWaiting=h.screen.account;h.fail();await running;
 assert.equal(displayedWhileWaiting,null);assert.equal(h.screen.account,null);assert.match(h.screen.error,/demo|unavailable/i);
});
