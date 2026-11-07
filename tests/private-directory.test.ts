import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
test('private directory protection refuses unrelated files and protects a dedicated store',async()=>{
 const file=new URL('../src/lib/private-directory.ts',import.meta.url);assert.ok(existsSync(file),'Private files need explicit filesystem protection');
 const {protectPrivateDirectory}=await import('../src/lib/private-directory.ts');
 const work=resolve('..','..','work');mkdirSync(work,{recursive:true});const dir=mkdtempSync(join(work,'private-directory-test-'));
 try{
  writeFileSync(join(dir,'unrelated.txt'),'synthetic unrelated data');assert.throws(()=>protectPrivateDirectory(join(dir,'state.sqlite')),/dedicated|unrelated/i);rmSync(join(dir,'unrelated.txt'));
  writeFileSync(join(dir,'state.sqlite'),'synthetic SQLite placeholder');writeFileSync(join(dir,'credential-key'),'synthetic key placeholder');
  protectPrivateDirectory(join(dir,'state.sqlite'));assert.equal(readFileSync(join(dir,'credential-key'),'utf8'),'synthetic key placeholder');
 }finally{assert.ok(dir.startsWith(work+sep));rmSync(dir,{recursive:true,force:true});}
});
