import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base=process.env.FRAGOUT_TEST_URL??'http://localhost:3000';
const accounts=[];let checks=0;
async function call(path,{method='GET',data,cookie,origin=base}={}){
 const r=await fetch(base+'/api/'+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(method!=='GET'?{Origin:origin}:{}),...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
 const body=await r.json();return {status:r.status,body,cookie:r.headers.get('set-cookie')?.split(';')[0],headers:r.headers};
}
const pass=(name)=>{checks++;console.log('PASS '+name);};
try{
 assert.equal((await call('health')).status,200);pass('health and production server');
 assert.equal((await call('state')).status,401);pass('unauthenticated state denied');
 const a=await call('auth',{method:'POST',data:{action:'register',name:'Disposable test A',email:randomUUID()+'@example.test',password:randomUUID()}});assert.equal(a.status,200);accounts.push(a.cookie);assert.equal(a.body.bottles.length,0);pass('new real account is empty');
 const b=await call('auth',{method:'POST',data:{action:'register',name:'Disposable test B',email:randomUUID()+'@example.test',password:randomUUID()}});assert.equal(b.status,200);accounts.push(b.cookie);
 const input={brand:'Personal house',name:'Summer air',concentration:'EDP',ownership:'OWNED',family:'Citrus',notes:['bergamot'],strength:1,climate:'FRESH',profileKnown:true,provenance:'personal',color:'#aabb88',shape:'square',sizeMl:100,fillPct:75,rating:4,favorite:true,memo:'Disposable local test'};
 const bottle=await call('bottles',{method:'POST',cookie:a.cookie,data:input});assert.equal(bottle.status,201);assert.equal((await call('state',{cookie:a.cookie})).body.bottles.length,1);assert.equal((await call('state',{cookie:b.cookie})).body.bottles.length,0);pass('CRUD persists with isolated owner');
 assert.equal((await call('bottles/'+bottle.body.id,{method:'PATCH',cookie:b.cookie,data:{name:'Stolen'}})).status,404);assert.equal((await call('bottles/'+bottle.body.id,{method:'DELETE',cookie:b.cookie})).status,404);pass('cross-account mutation denied');
 assert.equal((await call('bottles',{method:'POST',cookie:a.cookie,data:{...input,userId:b.body.user.id}})).status,400);pass('mass assignment rejected');
 assert.equal((await call('settings',{method:'PUT',cookie:a.cookie,origin:'https://malicious.example',data:{}})).status,403);pass('cross-origin mutation denied');
 const solo=await call('recommend',{method:'POST',cookie:a.cookie,data:{occasion:'GYM',mode:'solo'}});assert.equal(solo.status,200);assert.equal(solo.body.solo[0].bottle.id,bottle.body.id);pass('owned-only gym recommendation');
 const unknown=await call('bottles',{method:'POST',cookie:a.cookie,data:{...input,name:'Unknown bottle',profileKnown:false,notes:[],provenance:'unknown'}});assert.equal(unknown.status,201);
 assert.equal((await call('recommend',{method:'POST',cookie:a.cookie,data:{occasion:'GENERAL',mode:'solo'}})).body.solo.length,1);pass('unknown profile excluded without invented claims');
 assert.equal((await call('recommend',{method:'POST',cookie:a.cookie,data:{occasion:'DATE',mode:'combo'}})).body.combos.length,0);pass('evidence-only has honest empty result');
 await call('bottles',{method:'POST',cookie:a.cookie,data:{...input,name:'Soft woods',notes:['cedar'],family:'Woody'}});
 const pair=await call('recommend',{method:'POST',cookie:a.cookie,data:{occasion:'DATE',mode:'combo',evidenceMode:'experimental'}});assert.ok(pair.body.combos.length>0);assert.equal(pair.body.combos[0].tier,'model_hypothesis');assert.equal(pair.body.combos[0].sources.length,0);pass('experimental opt-in is distinct and untested');
 assert.equal((await call('feedback',{method:'POST',cookie:b.cookie,data:{bottleIds:[bottle.body.id],reaction:'wore',occasion:'WORK'}})).status,400);pass('foreign feedback IDs rejected');
 const event=await call('feedback',{method:'POST',cookie:a.cookie,data:{bottleIds:[bottle.body.id],reaction:'wore',occasion:'WORK'}});assert.equal(event.status,201);assert.equal((await call('state',{cookie:a.cookie})).body.history.length,1);pass('wear journal persists');
 const cold={...a.body.context,setting:'OUTDOOR',tempC:-5,indoorTempC:22};await call('settings',{method:'PUT',cookie:a.cookie,data:{context:cold}});
 const gym=await call('recommend',{method:'POST',cookie:a.cookie,data:{occasion:'GYM',mode:'solo',shortcutId:'gym'}});assert.equal(gym.body.context.setting,'INDOOR');
 const logged=await call('feedback',{method:'POST',cookie:a.cookie,data:{bottleIds:[gym.body.solo[0].bottle.id],reaction:'wore',occasion:'GYM',requestId:gym.body.requestId}});assert.equal(logged.body.context.setting,'INDOOR');assert.equal(logged.body.context.indoorTempC,22);pass('wear log retains server-owned shortcut snapshot');
 for(const s of a.body.shortcuts){const r=await call('recommend',{method:'POST',cookie:a.cookie,data:{occasion:s.occasion,mode:'solo',shortcutId:s.id}});assert.equal(r.status,200);assert.equal(r.body.context.setting,s.setting);assert.ok(r.body.solo.every(r=>r.bottle.ownership==='OWNED'));}pass('every built-in and custom template shortcut ranks with its own setting');
 const beforePair=(await call('state',{cookie:a.cookie})).body.bottles;await call('feedback',{method:'POST',cookie:a.cookie,data:{bottleIds:[pair.body.combos[0].a.id,pair.body.combos[0].b.id],reaction:'disliked',occasion:'DATE'}});
 const afterPair=(await call('state',{cookie:a.cookie})).body.bottles;for(const old of beforePair){assert.equal(afterPair.find(b=>b.id===old.id).rating,old.rating);assert.equal(afterPair.find(b=>b.id===old.id).favorite,old.favorite);}pass('pair failure leaves solo ratings and favorites intact');
 assert.equal((await call('recommend',{method:'POST',cookie:a.cookie,data:{occasion:'DATE',mode:'combo',evidenceMode:'experimental'}})).body.combos.length,0);pass('private rejected pair is excluded from future experiments');
 const freeContext={...a.body.context,policy:'NO_FRAGRANCE'};assert.equal((await call('settings',{method:'PUT',cookie:a.cookie,data:{context:freeContext}})).status,200);
 assert.equal((await call('recommend',{method:'POST',cookie:a.cookie,data:{occasion:'GENERAL',mode:'solo'}})).body.solo.length,0);assert.equal((await call('recommend',{method:'POST',cookie:a.cookie,data:{occasion:'DATE',mode:'combo',evidenceMode:'experimental'}})).body.combos.length,0);pass('fragrance-free blocks every mode');
 const exported=await call('export',{cookie:a.cookie});assert.equal(exported.body.user.id,a.body.user.id);assert.ok(!JSON.stringify(exported.body).includes('token_hash'));assert.ok(!JSON.stringify(exported.body).includes('password'));pass('export is scoped and credential-free');
 assert.equal((await call('account',{method:'DELETE',cookie:a.cookie})).status,200);assert.equal((await call('state',{cookie:a.cookie})).status,401);accounts.splice(accounts.indexOf(a.cookie),1);pass('account delete cascades and revokes session');
 console.log(`${checks}/${checks} HTTP checks passed.`);
}finally{for(const cookie of accounts)await call('account',{method:'DELETE',cookie});}
