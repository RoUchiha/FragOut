import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {join} from 'node:path';
async function policy(){assert.ok(existsSync(new URL('../src/lib/security.ts',import.meta.url)),'Central HTTP/privacy policy is required');return import('../src/lib/security.ts');}

test('host and Origin policy rejects rebinding hosts, foreign/null origins and cross-site API reads',async()=>{
 const {requestPolicy}=await policy();
 const check=(url:string,headers:Record<string,string>)=>requestPolicy(new URL(url),new Headers(headers));
 assert.equal(check('http://evil.example/api/state',{origin:'http://evil.example'}).status,421);
 assert.equal(check('http://localhost:3000/api/state',{origin:'https://evil.example'}).status,403);
 assert.equal(check('http://localhost:3000/api/state',{origin:'null'}).status,403);
 assert.equal(check('http://localhost:3000/api/export',{'sec-fetch-site':'cross-site'}).status,403);
 assert.equal(check('http://localhost:3000/api/state',{origin:'http://localhost:3000'}).status,200);
});

test('HTTPS sessions are Secure automatically and only an explicitly configured public origin is accepted',async()=>{
 const {requestPolicy}=await policy();
 assert.equal(requestPolicy(new URL('https://localhost/api/auth'),new Headers()).secureCookie,true);
 const configured=requestPolicy(new URL('https://fragout.example/api/auth'),new Headers({origin:'https://fragout.example'}),'https://fragout.example');
 assert.equal(configured.status,200);assert.equal(configured.secureCookie,true);
 assert.equal(requestPolicy(new URL('https://wrong.example/api/state'),new Headers(),'https://fragout.example').status,421);
});

test('public HTTP is rejected and plaintext LAN needs both development mode and an explicit opt-in',async()=>{
 const {requestPolicy}=await policy();
 assert.equal(requestPolicy(new URL('http://fragout.example/api/state'),new Headers(),'https://fragout.example').status,426);
 const env=process.env as Record<string,string|undefined>,mode=env.NODE_ENV,flag=env.FRAGOUT_ALLOW_LAN_HTTP;
 try{env.NODE_ENV='development';process.env.FRAGOUT_ALLOW_LAN_HTTP='true';
  assert.equal(requestPolicy(new URL('http://192.168.1.8:3000/api/state'),new Headers(),'http://192.168.1.8:3000').status,200);
  env.NODE_ENV='production';assert.throws(()=>requestPolicy(new URL('http://192.168.1.8:3000/api/state'),new Headers(),'http://192.168.1.8:3000'),/secure/i);
 }finally{if(mode===undefined)delete env.NODE_ENV;else env.NODE_ENV=mode;if(flag===undefined)delete process.env.FRAGOUT_ALLOW_LAN_HTTP;else process.env.FRAGOUT_ALLOW_LAN_HTTP=flag;}
});

test('private data paths cannot be placed in any published or packaged asset directory',async()=>{
 const {privateDataPath}=await import('../src/lib/private-path.ts');const root=process.cwd();
 for(const folder of ['public','public/mobile','public/..photos','.next/static','mobile/native-dist'])assert.throws(()=>privateDataPath(join(root,folder,'users.sqlite'),root),/private|public|asset/i);
 assert.equal(privateDataPath(join(root,'data','users.sqlite'),root),join(root,'data','users.sqlite'));
});

test('local model endpoints cannot redirect images to arbitrary hosts or credential-bearing URLs',async()=>{
 const {localModelUrl}=await policy();
 for(const value of ['http://evil.example:11434','https://user:key@localhost:11434','http://localhost:11434?key=x','http://localhost:11434/other'])assert.throws(()=>localModelUrl(value),/local|loopback|endpoint/i);
 assert.equal(localModelUrl('http://127.0.0.1:11434'),'http://127.0.0.1:11434');
});

test('production CSP uses nonce scripts, blocks external connections and disallows framing',async()=>{
 const {contentPolicy}=await policy();const csp=contentPolicy('syntheticNonce',false);
 assert.match(csp,/script-src[^;]*'nonce-syntheticNonce'/);assert.doesNotMatch(csp,/script-src[^;]*'unsafe-inline'/);
 assert.match(csp,/connect-src 'self'/);assert.match(csp,/frame-ancestors 'none'/);assert.match(csp,/base-uri 'none'/);assert.match(csp,/object-src 'none'/);
});
