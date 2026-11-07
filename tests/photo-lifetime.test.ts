import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness({native=false,conversionFailure=false}={}){
 const cache='file:///sandbox/cache/';
 const original=native?cache+'ImagePicker/original.jpg':URL.createObjectURL(new Blob(['original-with-sensitive-metadata']));
 const converted=native?cache+'ImageManipulator/converted.jpg':URL.createObjectURL(new Blob(['converted-image']));
 const files=new Set([original,converted,cache+'keep/other.db',cache+'fragout-export.json',cache+'fragout-export-123456789-1.json',cache+'33e6445d-0000-4000-8000-000000000001.jpg','file:///sandbox/Documents/original.jpg']);
 const deleted:string[]=[];
 class File {uri:string;constructor(...parts:any[]){this.uri=parts.length===1?parts[0]:cache+parts.at(-1);}get exists(){return files.has(this.uri);}delete(){deleted.push(this.uri);files.delete(this.uri);}}
 class Directory {uri:string;constructor(...parts:any[]){this.uri=parts.length===1?(typeof parts[0]==='string'?parts[0]:parts[0].uri):cache+parts.at(-1)+'/';}get exists(){return [...files].some(p=>p.startsWith(this.uri));}delete(){deleted.push(this.uri);for(const file of files)if(file.startsWith(this.uri))files.delete(file);}list(){return [...files].filter(p=>p.startsWith(cache)&&!p.slice(cache.length).includes('/')).map(p=>new File(p));}}
 const fileSystem={File,Directory,Paths:{cache:{uri:cache}}};
 const context:any={URL,Error,Set,Promise,console,require:(name:string)=>{
  if(name==='react-native')return {Platform:{OS:native?'android':'web'}};
  if(name==='expo-image-picker')return {requestCameraPermissionsAsync:async()=>({granted:true}),launchImageLibraryAsync:async()=>({canceled:false,assets:[{uri:original,width:100,height:100}]})};
  if(name==='expo-image-manipulator')return {SaveFormat:{JPEG:'jpeg'},manipulateAsync:async()=>{if(conversionFailure)throw new Error('synthetic conversion failure');return {uri:converted,base64:'c3ludGhldGlj'};}};
  if(name==='expo-file-system')return fileSystem;
  if(name==='./photo-lifetime')return load('photo-lifetime.ts');
  throw new Error('Unexpected dependency '+name);
 }};
 function load(name:string){const module={exports:{}};const code=ts.transpileModule(readFileSync(new URL('../mobile/src/'+name,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{...context,module,exports:module.exports});return module.exports as any;}
 return {capture:load('capture.ts'),original,converted,files,deleted,cache,release:()=>{if(!native){URL.revokeObjectURL(original);URL.revokeObjectURL(converted);}}};
}

test('discard revokes both original web picker blob and converted preview',async()=>{
 const h=harness();try{const photo=await h.capture.capturePhoto('gallery');await h.capture.discardPhoto(photo);
  await assert.rejects(()=>fetch(h.original));await assert.rejects(()=>fetch(h.converted));assert.equal(photo.data,'');
 }finally{h.release();}
});

test('conversion failures still revoke the original picker blob',async()=>{
 const h=harness({conversionFailure:true});try{await assert.rejects(()=>h.capture.capturePhoto('gallery'),/conversion/);await assert.rejects(()=>fetch(h.original));}finally{h.release();}
});

test('startup sweep removes only app-owned image caches and orphan export copies',async()=>{
 const h=harness({native:true});assert.equal(typeof h.capture.clearTemporaryPhotos,'function');await h.capture.clearTemporaryPhotos();
 assert.ok(!h.files.has(h.original));assert.ok(!h.files.has(h.converted));assert.ok(!h.files.has(h.cache+'fragout-export.json'));
 assert.ok(!h.files.has(h.cache+'fragout-export-123456789-1.json'));
 assert.ok(!h.files.has(h.cache+'33e6445d-0000-4000-8000-000000000001.jpg'));
 assert.ok(h.files.has(h.cache+'keep/other.db'));assert.ok(h.files.has('file:///sandbox/Documents/original.jpg'));
 assert.ok(!h.deleted.includes(h.cache),'Never recursively delete the entire cache root');
});

test('discard never removes a gallery original outside app cache',async()=>{
 const h=harness({native:true});const photo={uri:'file:///sandbox/Documents/original.jpg',mime:'image/jpeg',data:'private'};
 await h.capture.discardPhoto(photo);assert.ok(h.files.has(photo.uri));assert.equal(h.deleted.length,0);assert.equal(photo.data,'');
});

test('all original iOS picker image formats are deleted even when SDK writes at cache root',async()=>{
 const h=harness({native:true});
 for(const extension of ['gif','bmp','tiff','tif','avif']){
  const uri=h.cache+'33e6445d-0000-4000-8000-000000000001.'+extension;h.files.add(uri);
  await h.capture.discardPhoto({uri,data:'synthetic',mime:'image/jpeg'});assert.equal(h.files.has(uri),false,extension+' cache copy must be deleted');
 }
});
