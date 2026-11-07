import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const aToken='a'.repeat(64),bToken='b'.repeat(64);
function harness({development=false,web=false,failWrite=false,initial=new Map<string,string>(),hooks={} as {write?:(key:string,value:string)=>Promise<void>;remove?:(key:string)=>Promise<void>}}={}){
 const requests:{url:string;options:any;resolve:(value:any)=>void}[]=[],storage=new Map(initial);
 const module={exports:{} as any},flags={cleanupFailure:false};
 const context={module,exports:module.exports,Error,URL,AbortController,__DEV__:development,window:web?{location:{origin:'https://server-a.example'}}:undefined,
  process:{env:{EXPO_PUBLIC_API_URL:'https://server-a.example'}},
  setTimeout:(f:()=>void,n:number)=>setTimeout(f,Math.min(n,1500)),clearTimeout,
  require:(name:string)=>{
   if(name==='react-native')return {Platform:{OS:web?'web':'android'}};
   if(name==='expo-secure-store')return {WHEN_UNLOCKED_THIS_DEVICE_ONLY:'device-only',getItemAsync:async(k:string)=>storage.get(k)??null,setItemAsync:async(k:string,v:string)=>{await hooks.write?.(k,v);if(failWrite&&k.startsWith('fragout.session'))throw new Error('synthetic storage failure');storage.set(k,v);},deleteItemAsync:async(k:string)=>{await hooks.remove?.(k);storage.delete(k);}};
   if(name==='./capture')return {clearTemporaryPhotos:async()=>{if(flags.cleanupFailure)throw new Error('synthetic cleanup failure');}};
   throw new Error('Unexpected native dependency: '+name);
  },
  fetch:(url:string,options:any)=>new Promise(resolve=>requests.push({url,options,resolve}))
 };
 const source=readFileSync(new URL('../mobile/src/api.ts',import.meta.url),'utf8');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,context);
 const respond=(index:number,token?:string,extra={})=>requests[index].resolve({ok:true,status:200,redirected:false,url:requests[index].url,json:async()=>token?{user:{id:token===aToken?'A':'B'},sessionToken:token}:{ok:true},...extra});
 const flush=()=>new Promise<void>(resolve=>setImmediate(resolve));
 return {client:module.exports,requests,storage,respond,flush,flags};
}

test('delayed server A login cannot install or send its token after switching to B',async()=>{
 const h=harness();const old=h.client.signIn('login',{email:'synthetic@example.test',password:'synthetic-password'}).then(()=>true,()=>false);
 await h.flush();await h.client.setServer('https://server-b.example');h.respond(0,aToken);
 assert.equal(await old,false,'Obsolete auth response must be rejected');
 const request=h.client.api('state');await h.flush();const i=h.requests.length-1;
 assert.equal(h.requests[i].url,'https://server-b.example/api/state');assert.equal(h.requests[i].options.headers.Authorization,undefined);
 h.respond(i);await request;assert.ok(![...h.storage.values()].some(v=>v.includes(aToken)));
});

test('newer sign-in wins even when the older response arrives last',async()=>{
 const h=harness();const old=h.client.signIn('login',{email:'old@example.test',password:'synthetic-password'}).then(()=>true,()=>false);await h.flush();
 const newer=h.client.signIn('login',{email:'new@example.test',password:'synthetic-password'});await h.flush();h.respond(1,bToken);await newer;h.respond(0,aToken);
 assert.equal(await old,false);const r=h.client.api('state');await h.flush();assert.equal(h.requests[2].options.headers.Authorization,'Bearer '+bToken);h.respond(2);await r;
});

test('logout clears the local credential immediately and ignores previous responses',async()=>{
 const h=harness();const login=h.client.signIn('demo');await h.flush();h.respond(0,aToken);await login;
 const old=h.client.api('state').then(()=>true,()=>false);await h.flush();const leaving=h.client.signOut();await h.flush();
 const fresh=h.client.api('state');await h.flush();const i=h.requests.length-1;
 assert.equal(h.requests[i].options.headers.Authorization,undefined,'Logout must not wait for the remote server to clear local credentials');
 h.respond(i);await fresh;h.respond(1);assert.equal(await old,false);h.respond(2);await leaving;
});

test('failed secure persistence leaves no usable in-memory session',async()=>{
 const h=harness({failWrite:true});const login=h.client.signIn('demo');await h.flush();h.respond(0,aToken);await assert.rejects(login);
 const r=h.client.api('state');await h.flush();assert.equal(h.requests[1].options.headers.Authorization,undefined);h.respond(1);await r;
});

test('restore rejects mismatched origin envelopes and removes ambiguous legacy tokens',async()=>{
 const initial=new Map([['fragout.server','https://server-b.example'],['fragout.session',aToken],['fragout.session.v2',JSON.stringify({origin:'https://server-a.example',token:aToken})]]);
 const h=harness({initial});await h.client.restoreSession();const r=h.client.api('state');await h.flush();
 assert.equal(h.requests[0].url,'https://server-b.example/api/state');assert.equal(h.requests[0].options.headers.Authorization,undefined);assert.equal(h.storage.has('fragout.session'),false);h.respond(0);await r;
});

test('release clients reject remote and LAN plaintext server origins',async()=>{
 const h=harness();await assert.rejects(()=>h.client.setServer('http://192.168.1.8:3000'),/HTTPS|secure/i);
 await assert.rejects(()=>h.client.setServer('https://user:secret@example.test'),/origin|address|credentials/i);
 await h.client.setServer('https://server-b.example');
});

test('authenticated requests reject redirects rather than following credentials to a new origin',async()=>{
 const h=harness();const request=h.client.api('state');await h.flush();
 assert.equal(h.requests[0].options.redirect,'error');h.respond(0,undefined,{redirected:true,url:'https://other.example/state'});await assert.rejects(request,/redirect|destination|server/i);
});

test('photo cleanup plus remote logout failure cannot restore a signed-out session',async()=>{
 const h=harness();const login=h.client.signIn('demo');await h.flush();h.respond(0,aToken);await login;
 h.flags.cleanupFailure=true;const leaving=h.client.signOut().then(()=>true,()=>false);await h.flush();h.respond(1,undefined,{ok:false,status:503,json:async()=>({error:'synthetic offline'})});
 assert.equal(await leaving,false);h.flags.cleanupFailure=false;await h.client.restoreSession();const r=h.client.api('state');await h.flush();
 assert.equal(h.requests[2].options.headers.Authorization,undefined);assert.equal(h.storage.has('fragout.session.v2'),false);h.respond(2);await r;
});

test('older failed-write cleanup cannot erase a newer successfully persisted session',async()=>{
 let writes=0,deletes=0,release:()=>void=()=>{};
 const gate=new Promise<void>(resolve=>{release=resolve;});
 const h=harness({hooks:{write:async key=>{if(key==='fragout.session.v2'&&++writes===1)throw new Error('synthetic one-time persistence failure');},remove:async key=>{if(key==='fragout.session.v2'&&++deletes===2)await gate;}}});
 const old=h.client.signIn('demo').then(()=>true,()=>false);await h.flush();h.respond(0,aToken);await h.flush();
 const newer=h.client.signIn('demo');await h.flush();const beganBeforeRelease=h.requests.length>1;
 if(beganBeforeRelease){h.respond(1,bToken);await newer;}
 release();await h.flush();if(!beganBeforeRelease){h.respond(1,bToken);await newer;}
 assert.equal(await old,false);assert.equal(JSON.parse(h.storage.get('fragout.session.v2')??'null')?.token,bToken);
});

test('browser preview stays on its document origin instead of forwarding data to another backend',async()=>{
 const h=harness({web:true});await assert.rejects(()=>h.client.setServer('https://server-b.example'),/browser|preview|origin/i);assert.equal(h.client.serverUrl(),'https://server-a.example');
});
