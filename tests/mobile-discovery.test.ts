import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as photos from '../src/lib/catalog-photos.ts';
import * as journal from '../src/lib/journal.ts';
import {catalogProfiles} from '../src/lib/catalog.ts';
import {defaultContext,demoBottles} from '../src/lib/seed.ts';

type Element={type:any;props:Record<string,any>};
function deferred(){let resolve!:(value:any)=>void;const promise=new Promise<any>(done=>{resolve=done;});return {promise,resolve};}
const tick=()=>new Promise<void>(done=>setImmediate(done));
function mount(file:string,name:string,props:object,request:(path:string,body:any)=>Promise<any>){
 const hooks:any[]=[],pending:(()=>void)[]=[],cleanups=new Map<number,()=>void>(),timers=new Map<number,()=>void>();let index=0,nextTimer=0,current=true;
 const react={
  createElement:(type:any,props:object,...children:any[]):Element=>({type,props:{...props,children}}),
  useState:(initial:any)=>{const slot=index++;if(!(slot in hooks))hooks[slot]=typeof initial==='function'?initial():initial;return [hooks[slot],(value:any)=>{hooks[slot]=typeof value==='function'?value(hooks[slot]):value;}];},
  useRef:(value:any)=>{const slot=index++;return hooks[slot]??=( {current:value});},
  useEffect:(effect:()=>void|(()=>void),deps:any[])=>{const slot=index++,before=hooks[slot];if(!before||deps.some((value,i)=>!Object.is(value,before[i]))){hooks[slot]=deps;pending.push(()=>{cleanups.get(slot)?.();const cleanup=effect();if(cleanup)cleanups.set(slot,cleanup);});}},
 };
 const module={exports:{} as any},source=readFileSync(new URL('../mobile/src/'+file,import.meta.url),'utf8')+'\nexports.Target='+name+';';
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText,{
  module,exports:module.exports,console,Date,JSON,Error,setTimeout:(work:()=>void)=>{const id=++nextTimer;timers.set(id,work);return id;},clearTimeout:(id:number)=>timers.delete(id),
  require:(dependency:string)=>{
   if(dependency==='react')return react;
   if(dependency==='./api')return {api:(path:string,_method:string,body:any)=>request(path,body),sessionScope:()=>{const allowed=current;return ()=>allowed&&current;},serverUrl:()=> 'https://example.test'};
   if(dependency==='./ui')return new Proxy({useUi:()=>({styles:{},colors:{}})},{get:(target,key)=>key==='useUi'?target.useUi:key});
   if(dependency==='../../src/lib/catalog-photos')return photos;
   if(dependency==='../../src/lib/journal')return journal;
   if(dependency==='react-native'||dependency==='lucide-react-native')return new Proxy({},{get:(_target,key)=>key});
   return {};
  },
 });
 let tree:Element;
 function render(){index=0;tree=module.exports.Target(props);for(const effect of pending.splice(0))effect();return tree;}
 function find(match:(node:Element)=>boolean,node:any=tree):Element|undefined{
  if(Array.isArray(node)){for(const item of node){const found=find(match,item);if(found)return found;}return;}
  if(!node||typeof node!=='object'||!node.props)return;
  return match(node)?node:find(match,node.props.children);
 }
 function action(label:string){render();const button=find(node=>node.props.label===label||node.props.accessibilityLabel===label);assert.ok(button&&!button.props.disabled,'Expected enabled '+label);button.props.onPress();render();}
 function field(label:string,value:string){render();const input=find(node=>node.props.label===label);assert.ok(input,'Expected '+label);(input.props.onChangeText??input.props.onChange)(value);render();}
 async function flush(){for(const [id,timer] of [...timers]){timers.delete(id);timer();}await tick();render();}
 render();return {render,find,action,field,flush,changeSession:()=>{current=false;},unmount:()=>{for(const cleanup of cleanups.values())cleanup();}};
}

test('catalog search cannot display an earlier result after the user changes the search',async()=>{
 const old=deferred(),fresh=deferred();let count=0;
 const app=mount('CatalogBrowser.tsx','CatalogBrowser',{onClose:()=>{},notify:()=>{}},async()=>++count===1?old.promise:fresh.promise);
 await app.flush();app.field('Search FragDex','new search');await app.flush();
 old.resolve({entries:[{id:'old',brand:'Old',name:'Old result',concentration:'EDP'}],total:1,offset:0});await app.flush();
 assert.equal(app.find(node=>node.props.accessibilityLabel==='Old Old result EDP'),undefined);
 fresh.resolve({entries:[{id:'new',brand:'New',name:'New result',concentration:'EDT'}],total:1,offset:0});await app.flush();
 assert.ok(app.find(node=>node.props.accessibilityLabel==='New New result EDT'));
});

test('catalog add uses the selected exact edition and resists repeated taps',async()=>{
 const profile=catalogProfiles[0],pending=deferred(),adds:any[]=[];
 const app=mount('CatalogBrowser.tsx','CatalogEntry',{id:profile.id,onClose:()=>{},notify:()=>{},onAdded:()=>{}},async(path,body)=>{
  if(path==='catalog/detail')return {edition:profile,profile,dupes:{alternatives:[],originals:[]},similar:[]};
  adds.push(body);return pending.promise;
 });
 await app.flush();const button=app.find(node=>node.props.label==='I own this')!;assert.ok(button);
 button.props.onPress();button.props.onPress();await tick();
 assert.equal(adds.length,1);assert.equal(adds[0].concentration,profile.concentration);assert.equal(adds[0].brand,profile.brand);
 assert.equal(adds[0].profileKnown,false);pending.resolve({id:'created'});await app.flush();
});

test('closing a catalog entry while adding cannot reopen a stale detail sheet',async()=>{
 const profile=catalogProfiles[0],pending=deferred();let opened=0;
 const app=mount('CatalogBrowser.tsx','CatalogEntry',{id:profile.id,onClose:()=>{},notify:()=>{},onAdded:(_bottle:unknown,open:boolean)=>{if(open)opened++;}},async path=>path==='catalog/detail'?{edition:profile,profile,dupes:{alternatives:[],originals:[]},similar:[]}:pending.promise);
 await app.flush();app.action('I own this');app.unmount();pending.resolve({id:'created'});await tick();assert.equal(opened,0);
});

test('manual wear logging submits the selected day, two distinct bottles and private note',async()=>{
 const calls:any[]=[],bottles=demoBottles.slice(0,2);let saved=0;
 const app=mount('Journal.tsx','WearEditor',{state:{bottles,context:defaultContext},event:null,initialDate:'2026-03-08',onClose:()=>{},notify:()=>{},onSaved:()=>saved++},async(path,body)=>{calls.push({path,body});return {id:'wear'};});
 for(const bottle of bottles)app.action(bottle.name+' '+bottle.concentration);
 app.field('Private wear note','Warm drydown');app.action('Save wear');await app.flush();
 assert.equal(calls[0].path,'journal');assert.equal(calls[0].body.date,'2026-03-08');assert.equal(calls[0].body.note,'Warm drydown');
 assert.deepEqual(Array.from(calls[0].body.bottleIds),bottles.map(bottle=>bottle.id));assert.equal(saved,1);
});
