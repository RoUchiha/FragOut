import assert from 'node:assert/strict';
import {test} from 'node:test';
import {openConfiguredDatabase,openSqlite,DatabaseUnavailable} from '../src/lib/database.ts';
import {runtimeEnvironment,assertDatabaseEnvironment} from '../src/lib/environment.ts';

test('deployment identity distinguishes development, staging and production without trusting request headers',()=>{
 assert.equal(runtimeEnvironment({}),'development');
 assert.equal(runtimeEnvironment({VERCEL:'1',VERCEL_ENV:'production'}),'production');
 assert.equal(runtimeEnvironment({VERCEL:'1',VERCEL_ENV:'preview'}),'staging');
 assert.equal(runtimeEnvironment({FRAGOUT_ENVIRONMENT:'staging'}),'staging');
 assert.throws(()=>runtimeEnvironment({FRAGOUT_ENVIRONMENT:'prodution'}));
 assert.throws(()=>runtimeEnvironment({VERCEL:'1',VERCEL_ENV:'production',FRAGOUT_ENVIRONMENT:'development'}));
});

test('production requires managed storage and staging requires an explicit separate database path',()=>{
 assert.throws(()=>openConfiguredDatabase({FRAGOUT_ENVIRONMENT:'production'}),DatabaseUnavailable);
 assert.throws(()=>openConfiguredDatabase({FRAGOUT_ENVIRONMENT:'staging'}),DatabaseUnavailable);
});

test('a target database must positively identify itself as staging before refresh can write',async()=>{
 const source=openSqlite(':memory:',{environment:'production'}),target=openSqlite(':memory:',{environment:'staging'});
 try{
  const a=await assertDatabaseEnvironment(source,'production'),b=await assertDatabaseEnvironment(target,'staging');
  assert.notEqual(a.instanceId,b.instanceId);
  await assert.rejects(()=>assertDatabaseEnvironment(source,'staging'));
  await assert.rejects(()=>assertDatabaseEnvironment(target,'production'));
  await source.run('INSERT INTO rate_limits VALUES (?,?,?)','sentinel',7,Date.now()+10000);
  await assert.rejects(()=>assertDatabaseEnvironment(source,'staging'));
  assert.equal((await source.get<{count:number}>('SELECT count FROM rate_limits WHERE key=?','sentinel'))?.count,7);
 }finally{await source.close();await target.close();}
});
