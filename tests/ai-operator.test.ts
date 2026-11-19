import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setProduction} from '../scripts/ai-operator.mjs';

function withCli(envs:object[],check:(calls:()=>{args:string[];input:string}[])=>void){
 const directory=mkdtempSync(join(tmpdir(),'fragout-ai-cli-')),cli=join(directory,'fixture.mjs'),log=join(directory,'calls.jsonl');
 const previous=process.env.FRAGOUT_VERCEL_CLI;
 writeFileSync(cli,`import{appendFileSync}from'node:fs';const args=process.argv.slice(2);let input='';for await(const chunk of process.stdin)input+=chunk;appendFileSync(${JSON.stringify(log)},JSON.stringify({args,input})+'\\n');if(args[0]==='api'){process.stdout.write(${JSON.stringify(JSON.stringify({envs}))});process.exit(0);}if(!['add','update'].includes(args[1])||args[3]!=='production'||args.includes('--environment')){process.stderr.write('Unsupported pinned CLI arguments.');process.exit(1);}`);
 process.env.FRAGOUT_VERCEL_CLI=cli;
 try{
  check(()=>readFileSync(log,'utf8').trim().split('\n').map(line=>JSON.parse(line)));
 }finally{
  if(previous===undefined)delete process.env.FRAGOUT_VERCEL_CLI;else process.env.FRAGOUT_VERCEL_CLI=previous;
  unlinkSync(cli);unlinkSync(log);rmdirSync(directory);
 }
}

test('first-run operator setup checks scope and passes sensitive values only over stdin to the pinned CLI',()=>{
 withCli([],readCalls=>{
  setProduction('GROQ_API_KEY','synthetic-operator-secret',true);const calls=readCalls();
  assert.equal(calls.length,2);
  assert.equal(calls[0].args[0],'api');assert.match(calls[0].args[1],/decrypt=false/);assert.equal(calls[0].input,'');
  assert.equal(calls[1].input,'synthetic-operator-secret');assert.ok(calls.every(call=>!call.args.includes('synthetic-operator-secret')));
  assert.equal(calls[1].args[1],'add');assert.equal(calls[1].args[3],'production');assert.ok(calls[1].args.includes('--sensitive'));
  assert.equal(calls[1].args[calls[1].args.indexOf('--project')+1],'prj_am2fYjn2SVu3Ox4vBdpFQTvWtjzA');
 });
});

test('operator setup refuses shared and preview-only records before sending a credential',()=>{
 for(const target of [['production','preview'],['preview'],['development']])withCli([{id:'synthetic-env',key:'GROQ_API_KEY',target}],readCalls=>{
  assert.throws(()=>setProduction('GROQ_API_KEY','synthetic-operator-secret',true));
  assert.equal(readCalls().length,1);assert.equal(readCalls()[0].input,'');
 });
});

test('operator setup can rotate an exclusively Production credential as Sensitive',()=>{
 withCli([{id:'synthetic-env',key:'GROQ_API_KEY',target:['production']}],readCalls=>{
  setProduction('GROQ_API_KEY','synthetic-rotated-secret',true);
  const calls=readCalls();assert.equal(calls.length,2);assert.equal(calls[1].args[1],'update');assert.equal(calls[1].input,'synthetic-rotated-secret');assert.ok(calls[1].args.includes('--sensitive'));
 });
});
