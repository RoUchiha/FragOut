import assert from 'node:assert/strict';
import {test} from 'node:test';
import {beginRequest,finishRequest} from '../src/lib/observability.ts';

test('request correlation is server generated and logs exclude account identifiers, queries, tokens and bodies',()=>{
 const request={method:'POST',url:'https://fragout.example/api/bottles/private-owner-id?email=secret@example.test',headers:new Headers({authorization:'Bearer private-token','x-request-id':'malicious-id'})};
 const a=beginRequest(request,{}),b=beginRequest(request,{}),logs:unknown[]=[];
 assert.match(a.id,/^[a-f\d-]{36}$/);assert.notEqual(a.id,b.id);
 finishRequest(a,503,{FRAGOUT_ACCESS_LOGS:'true'},entry=>logs.push(entry));
 const text=JSON.stringify(logs);
 for(const value of ['private-owner-id','secret@example.test','private-token','malicious-id'])assert.ok(!text.includes(value));
 assert.ok(text.includes('bottles/:item'));assert.ok(text.includes(a.id));
});

test('logging is quiet by default locally, enabled for hosted requests, and rejects unsafe revision strings',()=>{
 const context=beginRequest({method:'GET',url:'https://fragout.example/api/unknown/secret',headers:new Headers()},{FRAGOUT_RELEASE:'secret-key-value'}),logs:unknown[]=[];
 finishRequest(context,200,{},entry=>logs.push(entry));assert.equal(logs.length,0);
 finishRequest(context,200,{VERCEL:'1'},entry=>logs.push(entry));assert.equal(logs.length,1);
 assert.equal(context.revision,'local');assert.equal(context.route,'unknown');
});
