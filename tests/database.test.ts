import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseUnavailable,openConfiguredDatabase,openSqlite} from '../src/lib/database.ts';

test('SQLite transactions roll back and do not interleave with other requests',async()=>{
  const db=openSqlite(':memory:');
  try{
    let entered!:()=>void, release!:()=>void;
    const started=new Promise<void>(resolve=>{entered=resolve;});
    const waiting=new Promise<void>(resolve=>{release=resolve;});
    const transaction=db.transaction(async tx=>{
      await tx.run('INSERT INTO rate_limits VALUES(?,?,?)','temporary',1,1000);
      entered();
      await waiting;
      throw new Error('rollback');
    });
    const rolledBack=assert.rejects(transaction,/rollback/);
    await started;
    const concurrent=db.run('INSERT INTO rate_limits VALUES(?,?,?)','permanent',2,1000);
    release();
    await rolledBack;
    assert.equal(await concurrent,1);
    assert.equal(await db.get('SELECT count FROM rate_limits WHERE key=?','temporary'),undefined);
    assert.equal((await db.get<{count:number}>('SELECT count FROM rate_limits WHERE key=?','permanent'))?.count,2);
  }finally{await db.close();}
});

test('managed storage requires valid Postgres settings and a stable vault key',()=>{
  const url='postgres://fragout_app:synthetic@db.example.test:5432/postgres';
  const secret=Buffer.alloc(32,1).toString('base64');
  assert.throws(()=>openConfiguredDatabase({FRAGOUT_DATABASE_URL:url}),DatabaseUnavailable);
  assert.throws(()=>openConfiguredDatabase({FRAGOUT_DATABASE_URL:'https://db.example.test',FRAGOUT_VAULT_KEY:secret}),DatabaseUnavailable);
});

test('Supabase transaction pooling is rejected before opening connections',()=>{
  const url='postgres://fragout_app:synthetic@aws-1-us-east-2.pooler.supabase.com:6543/postgres';
  const secret=Buffer.alloc(32,1).toString('base64');
  assert.throws(()=>openConfiguredDatabase({FRAGOUT_DATABASE_URL:url,FRAGOUT_VAULT_KEY:secret}),DatabaseUnavailable);
});
