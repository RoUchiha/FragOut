import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function deferred(){let resolve!:(value:any)=>void;const promise=new Promise<any>(r=>resolve=r);return {promise,resolve};}
function harness({holdWrite=false,failShare=false}={}){
 let account='A';const available=deferred(),write=deferred(),writes:string[]=[],shares:string[]=[],files=new Set<string>();
 class File {uri:string;constructor(...parts:any[]){this.uri='file:///synthetic-cache/'+parts.at(-1);}get exists(){return files.has(this.uri);}async write(data:string){files.add(this.uri);writes.push(data);if(holdWrite)await write.promise;}delete(){files.delete(this.uri);}}
 const api={exportData:async()=>({owner:account,memo:'synthetic private account data'}),sessionScope:()=>{const captured=account;return ()=>account===captured;}};
 const dependencies:any={'react-native':{Platform:{OS:'ios'}},'expo-file-system':{File,Paths:{cache:{uri:'file:///synthetic-cache/'}}},'./api':api,'expo-sharing':{isAvailableAsync:()=>available.promise,shareAsync:async(uri:string)=>{shares.push(uri);if(failShare)throw new Error('Synthetic OS share failure');}}};
 const module={exports:{} as any},path=new URL('../mobile/src/export-data.ts',import.meta.url);
 let source:string;if(existsSync(path))source=readFileSync(path,'utf8');else{
  const settings=ts.createSourceFile('Settings.tsx',readFileSync(new URL('../mobile/src/Settings.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let fn='';
  const visit=(node:ts.Node)=>{if(ts.isFunctionDeclaration(node)&&node.name?.text==='exportAll')fn=node.getText(settings);else ts.forEachChild(node,visit);};visit(settings);source=fn+'\nexports.shareAccountExport=exportAll;';
 }
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{module,exports:module.exports,Error,JSON,Date,Math,console,...dependencies['react-native'],...dependencies['expo-file-system'],...api,notify:()=>{},require:(name:string)=>{if(dependencies[name])return dependencies[name];throw new Error(name);}});
 return {run:()=>module.exports.shareAccountExport(),change:()=>{account='B';},available,write,writes,shares,files};
}
const tick=()=>new Promise<void>(done=>setImmediate(done));
test('account switch during native sharing availability cannot write or share the earlier export',async()=>{
 const h=harness(),pending=h.run();await tick();h.change();h.available.resolve(true);
 await assert.rejects(pending,/session|account|server/i);assert.equal(h.writes.length,0);assert.equal(h.shares.length,0);
});
test('account switch during export writing removes that copy without opening a share sheet',async()=>{
 const h=harness({holdWrite:true});h.available.resolve(true);const pending=h.run();await tick();h.change();h.write.resolve(true);
 await assert.rejects(pending,/session|account|server/i);assert.equal(h.shares.length,0);assert.equal(h.files.size,0);
});
test('concurrent export operations use distinct temporary files and remove them after sharing',async()=>{
 const h=harness();h.available.resolve(true);await Promise.all([h.run(),h.run()]);assert.equal(new Set(h.shares).size,2);assert.equal(h.files.size,0);
});
test('OS sharing failure still removes the app-owned export copy',async()=>{
 const h=harness({failShare:true});h.available.resolve(true);await assert.rejects(h.run(),/share failure/);assert.equal(h.files.size,0);
});
