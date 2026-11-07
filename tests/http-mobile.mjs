import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const base=process.env.FRAGOUT_TEST_URL??'http://localhost:3000';
const accounts=[];let checks=0;
async function call(path,{method='GET',data,cookie,token}={}){
 const r=await fetch(base+'/api/'+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(method!=='GET'?{Origin:base}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
 return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
const pass=name=>{checks++;console.log('PASS '+name);};
try{
 const credentials={email:randomUUID()+'@example.test',password:randomUUID()};
 const web=await call('auth',{method:'POST',data:{action:'register',name:'Disposable web',...credentials}});
 assert.equal(web.status,200);accounts.push({cookie:web.cookie});assert.equal(web.body.sessionToken,undefined);
 const mobile=await call('auth',{method:'POST',cookie:web.cookie,data:{action:'demo',client:'mobile'}});
 assert.equal(mobile.status,200);assert.match(mobile.body.sessionToken,/^[a-f0-9]{64}$/);assert.equal(mobile.cookie,undefined);
 const token=mobile.body.sessionToken;accounts.push({token});assert.notEqual(mobile.body.user.id,web.body.user.id);
 assert.equal((await call('state',{cookie:web.cookie})).body.user.id,web.body.user.id);pass('mobile login does not expose or replace companion cookie session');
 await call('auth',{method:'POST',cookie:web.cookie,data:{action:'logout',client:'mobile'}});
 assert.equal((await call('state',{cookie:web.cookie})).status,200);pass('native logout without bearer cannot revoke companion cookie');
 assert.equal((await call('state',{token})).body.user.id,mobile.body.user.id);pass('native bearer authenticates its isolated account');
 const status=await call('ai/status',{token});assert.equal(status.body.selected,'qwen');
 assert.ok(status.body.connections.filter(c=>c.provider!=='qwen').every(c=>!c.configured));pass('new user defaults to free local Qwen with no borrowed paid key');
 assert.equal((await call('ai/provider',{method:'PUT',token,data:{provider:'openai'}})).status,409);pass('paid provider requires that user connection');
 const fakeKey='sk-fixture-'+randomUUID();
 assert.equal((await call('ai/connection',{method:'POST',token,data:{provider:'openai',key:fakeKey}})).status,200);
 assert.equal((await call('ai/status',{token})).body.selected,'qwen');
 assert.equal((await call('ai/status',{cookie:web.cookie})).body.connections.find(c=>c.provider==='openai').configured,false);pass('saving a key is owner-scoped and does not silently select paid inference');
 await call('ai/provider',{method:'PUT',token,data:{provider:'openai'}});
 assert.equal((await call('outfit/analyze',{method:'POST',token,data:{provider:'qwen',text:'White shirt and navy trousers'}})).status,409);pass('changed destination is rejected before any model request');
 assert.equal((await call('ai/connection/openai',{method:'DELETE',token})).status,200);
 assert.equal((await call('ai/status',{token})).body.selected,'qwen');pass('disconnect returns to free default');
 assert.equal((await call('outfit/analyze',{method:'POST',token,data:{provider:'qwen',image:{mime:'image/png',data:Buffer.from('bad photo').toString('base64')}}})).status,400);pass('invalid image rejected');
 const analysis=await call('outfit/analyze',{method:'POST',token,data:{provider:'qwen',text:'White linen shirt, navy trousers and brown loafers. Smart casual.'}});
 assert.equal(analysis.status,200);assert.ok(analysis.body.profile.hasOutfit);
 if(status.body.local.installed)assert.equal(analysis.body.method,'model');else assert.equal(analysis.body.method,'offline_rules');pass('typed outfit has an explicit model or offline-rules receipt');
 const input={analysisId:analysis.body.id,profile:analysis.body.profile,occasion:'WORK',mode:'both',evidenceMode:'experimental'};
 assert.equal((await call('outfit/recommend',{method:'POST',cookie:web.cookie,data:input})).status,404);pass('analysis receipt cannot cross accounts');
 const matches=await call('outfit/recommend',{method:'POST',token,data:input});assert.equal(matches.status,200);assert.ok(matches.body.solo.length>0);
 const owned=new Set(mobile.body.bottles.filter(b=>b.ownership==='OWNED').map(b=>b.id));
 assert.ok(matches.body.solo.every(r=>owned.has(r.bottle.id)));assert.ok(matches.body.combos.every(r=>owned.has(r.a.id)&&owned.has(r.b.id)&&r.tier==='model_hypothesis'));pass('outfit fragrance and pairs use owned bottles with explicit experimental tier');
 const evidence=await call('outfit/recommend',{method:'POST',token,data:{...input,evidenceMode:'evidence'}});assert.equal(evidence.body.combos.length,0);pass('outfit interpretation never fabricates pair evidence');
 await call('settings',{method:'PUT',token,data:{context:{...mobile.body.context,policy:'NO_FRAGRANCE'}}});
 const blocked=await call('outfit/recommend',{method:'POST',token,data:input});assert.equal(blocked.body.solo.length,0);assert.equal(blocked.body.combos.length,0);pass('venue rules override outfit matching');
 if(process.env.FRAGOUT_FIXTURE_PATH){
  const image={mime:'image/png',data:(await readFile(process.env.FRAGOUT_FIXTURE_PATH)).toString('base64')};
  const photo=await call('outfit/analyze',{method:'POST',token,data:{provider:'qwen',image}});
  assert.equal(photo.status,200);assert.equal(photo.body.method,'model');assert.ok(photo.body.profile.hasOutfit);pass('real local Qwen processes synthetic outfit image through authenticated API');
 }
 const exported=await call('export',{token});const output=JSON.stringify(exported.body);
 assert.ok(exported.body.outfitAnalyses.some(a=>a.id===analysis.body.id));assert.ok(!output.includes(fakeKey)&&!output.includes('sessionToken')&&!output.includes('base64'));pass('export includes structured receipts without keys, tokens or photos');
 await call('account',{method:'DELETE',token});accounts.pop();assert.equal((await call('state',{token})).status,401);pass('deleting the mobile account revokes its token and analysis access');
 const login=await call('auth',{method:'POST',data:{action:'login',client:'mobile',...credentials}});
 assert.equal(login.status,200);
 await call('auth',{method:'POST',token:login.body.sessionToken,data:{action:'logout',client:'mobile'}});
 assert.equal((await call('state',{token:login.body.sessionToken})).status,401);assert.equal((await call('state',{cookie:web.cookie})).status,200);pass('mobile logout revokes bearer while companion stays signed in');
 console.log(`${checks}/${checks} mobile/API checks passed. No paid inference calls.`);
}finally{for(const auth of accounts)await call('account',{method:'DELETE',...auth});}
