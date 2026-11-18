import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {privateTestEnvironment} from '../src/lib/private-test-runtime.ts';

test('private test startup refuses repository environment files before Next can reload secrets',()=>{
 const directory=mkdtempSync(join(tmpdir(),'fragout-test-env-'));
 try{
  for(const name of ['.env.production.local','.env.local','.env.production','.env']){
   const file=join(directory,name);writeFileSync(file,'SYNTHETIC_PRODUCTION_SECRET=must-not-load\n');
   try{assert.throws(()=>privateTestEnvironment(directory,{}),/environment file/i,name);}finally{unlinkSync(file);}
  }
  assert.doesNotThrow(()=>privateTestEnvironment(directory,{}));
 }finally{rmdirSync(directory);}
});

test('private test runtime inherits only required operating-system settings',()=>{
 const directory=mkdtempSync(join(tmpdir(),'fragout-test-env-'));
 try{
  const clean=privateTestEnvironment(directory,{Path:'synthetic-path',SystemRoot:'synthetic-windows',TEMP:'synthetic-temp',FRAGOUT_DATABASE_URL:'synthetic-db',FRAGOUT_VAULT_KEY:'synthetic-vault',SUPABASE_SERVICE_ROLE_KEY:'synthetic-role',GITHUB_TOKEN:'synthetic-token',ARBITRARY_CREDENTIAL:'synthetic-credential',NODE_OPTIONS:'--require untrusted.js'});
  assert.deepEqual(clean,{Path:'synthetic-path',SystemRoot:'synthetic-windows',TEMP:'synthetic-temp'});
 }finally{rmdirSync(directory);}
});
