import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {resolve,join,dirname,basename} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import sharp from 'sharp';
import {request as httpRequest} from 'node:http';

const work=resolve('..','..','work'),manifest=JSON.parse(await readFile(process.env.FRAGOUT_SECURITY_RUN??join(work,'security-lab-run.json'),'utf8'));
assert.equal(dirname(resolve(manifest.directory)),work);assert.ok(basename(manifest.directory).startsWith('security-lab-'));assert.equal(resolve(manifest.database),join(resolve(manifest.directory),'state.sqlite'));
const base=manifest.base,model=manifest.modelBase,accounts=[],groups=[];let checks=0,db;
const canary='private-canary-'+randomUUID(),key='sk-fixture-'+randomUUID();
const equal=(actual,expected,message)=>{assert.equal(actual,expected,message);checks++;};
const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
async function call(path,{method='GET',data,raw,token,cookie,origin=base,headers={}}={}){
 const response=await fetch(base+'/api/'+path,{method,redirect:'manual',headers:{...(origin?{Origin:origin}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(cookie?{Cookie:cookie}:{}),...((data!==undefined||raw!==undefined)?{'Content-Type':'application/json'}:{}),...headers},body:raw??(data===undefined?undefined:JSON.stringify(data))});
 const text=await response.text();let body;try{body=JSON.parse(text);}catch{body={};}
 return {status:response.status,body,text,headers:response.headers};
}
async function demo(){const r=await call('auth',{method:'POST',data:{action:'demo',client:'mobile'}});equal(r.status,200);accounts.push({id:r.body.user.id,token:r.body.sessionToken});return {state:r.body,token:r.body.sessionToken};}
async function group(name,run){await run();groups.push(name);console.log('PASS '+name);}
async function modelStatus(){return (await fetch(model+'/__status')).json();}
async function hostileHost(){return new Promise((done,reject)=>{const request=httpRequest(base+'/api/health',{headers:{Host:'attacker.invalid'}},response=>{response.resume();response.on('end',()=>done(response.statusCode));});request.on('error',reject);request.end();});}
async function waitDelayed(tag){for(let i=0;i<100;i++){if((await modelStatus()).delayed.includes(tag))return;await new Promise(done=>setTimeout(done,50));}throw new Error('Synthetic delayed model was not reached.');}
const pref=(state,archiveOutfits)=>({...state.preferences,archiveOutfits});
let a,b,defaultReceipt,archivedLook;
try{
 await group('anonymous private endpoints and static-file traversal do not disclose data',async()=>{
  for(const path of ['state','export','ai/status','looks','looks/'+randomUUID()+'/photo','outfit/recommend','vision/bottle','settings'])equal((await call(path)).status,401,path);
  equal((await call('outfit/analyze',{method:'POST',raw:'{'})).status,401);
  for(const path of ['/.env','/.env.local','/.git/config','/data/fragout.sqlite','/data/credential-key','/src/lib/vault.ts','/scripts/protect-private-directory.ps1','/package.json','/mobile/.env','/mobile/native-dist/metadata.json','/uploads/unknown.jpg','/private_photos','/_next/server/app/api/route.js','/%2e%2e/data/credential-key']){
   const r=await fetch(base+path,{redirect:'manual'});ok(r.status>=400,'Unexpected public path '+path);
  }
 });
 a=await demo();b=await demo();db=new DatabaseSync(manifest.database);db.exec('PRAGMA foreign_keys=ON');
 await group('auth confusion, CSRF, hostile hosts and HTTPS cookie contract',async()=>{
  equal((await call('state',{token:b.token,cookie:'fragout_session='+a.token})).body.user.id,b.state.user.id);
  equal((await call('state',{cookie:'fragout_session='+a.token,headers:{Authorization:'Bearer invalid'}})).status,401);
  equal((await call('state',{token:'0'.repeat(64)})).status,401);
  for(const origin of ['https://attacker.invalid','null'])equal((await call('settings',{method:'PUT',cookie:'fragout_session='+a.token,origin,data:{}})).status,403);
  equal((await call('settings',{method:'PUT',cookie:'fragout_session='+a.token,origin:null,data:{}})).status,403);
  equal((await call('export',{cookie:'fragout_session='+a.token,origin:null,headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
  // Fetch normalizes Host; a raw HTTP request is required to exercise rebinding.
  equal(await hostileHost(),421);
  equal((await call('settings',{method:'PUT',token:a.token,data:{},headers:{'Content-Type':'text/plain; application/json'}})).status,415);
  const isolated=await call('auth',{method:'POST',cookie:'fragout_session='+a.token,data:{action:'demo',client:'mobile'}});equal(isolated.status,200);ok(isolated.body.user.id!==a.state.user.id);equal(isolated.headers.get('set-cookie'),null);accounts.push({id:isolated.body.user.id,token:isolated.body.sessionToken});
  equal((await call('state',{cookie:'fragout_session='+a.token})).body.user.id,a.state.user.id);
 });
 await group('credential canaries stay encrypted, owner-scoped and absent from responses',async()=>{
  equal((await call('ai/connection',{method:'POST',token:a.token,data:{provider:'openai',key}})).status,200);
  const row=db.prepare('SELECT sealed FROM ai_credentials WHERE user_id=?').get(a.state.user.id);ok(row&&!row.sealed.includes(key));
  const status=await call('ai/status',{token:a.token});equal(status.body.selected,'qwen');ok(!status.text.includes(key));
  equal((await call('ai/status',{token:b.token})).body.connections.find(c=>c.provider==='openai').configured,false);
  equal((await call('ai/provider',{method:'PUT',token:b.token,data:{provider:'openai'}})).status,409);
  equal((await call('ai/connection',{token:a.token})).status,404);
  equal((await call('ai/connection',{method:'POST',token:a.token,data:{provider:'claude',key,baseUrl:'https://attacker.invalid'}})).status,400);
  const exported=await call('export',{token:a.token});ok(!exported.text.includes(key));ok(!exported.text.includes(a.token));
  for(const header of ['Cache-Control','Vary','Referrer-Policy'])ok(exported.headers.get(header));ok(exported.headers.get('Cache-Control').includes('no-store'));equal(exported.headers.get('Referrer-Policy'),'no-referrer');
  await call('ai/provider',{method:'PUT',token:a.token,data:{provider:'openai'}});const before=(await modelStatus()).calls;
  equal((await call('outfit/analyze',{method:'POST',token:a.token,data:{provider:'qwen',text:'White shirt'}})).status,409);equal((await modelStatus()).calls,before);
  await call('ai/connection/openai',{method:'DELETE',token:a.token});equal((await call('ai/status',{token:a.token})).body.selected,'qwen');
 });
 await group('cross-account collection mutation and mass assignment fail closed',async()=>{
  const bottle={brand:'Synthetic private house',name:canary,concentration:'EDP',ownership:'OWNED',family:'Citrus',notes:['bergamot'],strength:1,climate:'FRESH',profileKnown:true,provenance:'personal',color:'#aabb88',shape:'square',sizeMl:100,fillPct:100,rating:4,favorite:true,memo:canary+'-memo'};
  const added=await call('bottles',{method:'POST',token:a.token,data:bottle});equal(added.status,201);
  equal((await call('bottles/'+added.body.id,{method:'PATCH',token:b.token,data:{memo:'stolen'}})).status,404);
  equal((await call('bottles/'+added.body.id,{method:'DELETE',token:b.token})).status,404);
  equal((await call('bottles',{method:'POST',token:a.token,data:{...bottle,userId:b.state.user.id}})).status,400);
  ok(!(await call('state',{token:b.token})).text.includes(canary));
 });
 const source=await sharp({create:{width:12,height:8,channels:3,background:'#748c59'}}).jpeg().withMetadata({exif:{IFD0:{Artist:canary}}}).toBuffer();
 const image={mime:'image/jpeg',data:source.toString('base64')};
 await group('default selfie processing retains no image and strips camera metadata',async()=>{
  const r=await call('outfit/analyze',{method:'POST',token:a.token,data:{provider:'qwen',image}});equal(r.status,200);equal(r.body.photoRetained,false);defaultReceipt=r.body;
  equal(db.prepare('SELECT COUNT(*) AS n FROM private_photos WHERE user_id=?').get(a.state.user.id).n,0);
  const inputs=await (await fetch(model+'/__inputs')).json(),last=inputs.at(-1);equal(last.keep_alive,0);ok(!JSON.stringify(last).includes(canary+'-memo'));
  const delivered=Buffer.from(last.messages.at(-1).images[0],'base64');ok(!delivered.includes(Buffer.from(canary)));equal((await sharp(delivered).metadata()).exif,undefined);
  const matched=await call('outfit/recommend',{method:'POST',token:a.token,data:{analysisId:r.body.id,profile:r.body.profile,occasion:'WORK',mode:'both',evidenceMode:'experimental'}});equal(matched.status,200);
  const run=JSON.parse(db.prepare('SELECT body FROM recommendation_runs WHERE id=?').get(matched.body.requestId).body);equal(run.outfit,undefined);
  equal((await call('outfit/recommend',{method:'POST',token:b.token,data:{analysisId:r.body.id,profile:r.body.profile,occasion:'WORK',mode:'both'}})).status,404);
  equal((await call('looks',{method:'POST',token:a.token,data:{requestId:matched.body.requestId,bottleIds:[matched.body.solo[0].bottle.id],confirmedAccurate:true}})).status,400);
 });
 await group('image spoofing, malformed content, oversized uploads and prompt injection are rejected',async()=>{
  for(const bad of [{mime:'image/svg+xml',data:Buffer.from('<svg><script>bad</script></svg>').toString('base64')},{mime:'image/jpeg',data:Buffer.from('<script>bad</script>').toString('base64')},{mime:'image/png',data:Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64')}])equal((await call('outfit/analyze',{method:'POST',token:b.token,data:{provider:'qwen',image:bad}})).status,400);
  equal((await call('outfit/analyze',{method:'POST',token:b.token,data:{provider:'qwen',image:{mime:'image/jpeg',data:'A'.repeat(4*1024*1024+4)}}})).status,400);
  equal((await call('outfit/analyze',{method:'POST',token:b.token,data:{provider:'qwen',text:'A'.repeat(6*1024*1024+100)}})).status,413);
  const injected=await call('outfit/analyze',{method:'POST',token:b.token,data:{provider:'qwen',image,text:'INJECT_PRODUCT_IDS white shirt'}});equal(injected.status,503);ok(!injected.text.includes('unowned-injected-id'));ok(!injected.text.includes('stack'));
 });
 await group('opt-in archive keeps only encrypted, authenticated, reviewed look photos',async()=>{
  equal((await call('settings',{method:'PUT',token:a.token,data:{preferences:pref(a.state,true)}})).status,200);
  const r=await call('outfit/analyze',{method:'POST',token:a.token,data:{provider:'qwen',image,archivePhoto:true}});equal(r.status,200);equal(r.body.photoRetained,true);
  const matched=await call('outfit/recommend',{method:'POST',token:a.token,data:{analysisId:r.body.id,profile:r.body.profile,occasion:'WORK',mode:'both',evidenceMode:'experimental'}});equal(matched.status,200);
  const ids=[matched.body.combos[0].a.id,matched.body.combos[0].b.id],requestId=matched.body.requestId;
  equal((await call('looks',{method:'POST',token:a.token,data:{requestId,bottleIds:ids,confirmedAccurate:false}})).status,400);
  equal((await call('looks',{method:'POST',token:a.token,data:{requestId,bottleIds:[b.state.bottles[0].id],confirmedAccurate:true}})).status,400);
  const saved=await call('looks',{method:'POST',token:a.token,data:{requestId,bottleIds:ids,confirmedAccurate:true}});equal(saved.status,201);equal(saved.body.photoAvailable,true);archivedLook=saved.body;
  const ownerPhoto=await call('looks/'+saved.body.id+'/photo',{token:a.token});equal(ownerPhoto.status,200);equal(ownerPhoto.body.mime,'image/jpeg');ok(ownerPhoto.headers.get('Cache-Control').includes('no-store'));
  equal((await call('looks/'+saved.body.id+'/photo',{token:b.token})).status,404);equal((await call('looks/'+saved.body.id+'/photo')).status,401);
  equal((await call('looks/'+saved.body.id,{method:'DELETE',token:b.token})).status,404);equal((await call('looks',{token:b.token})).body.length,0);
  const bytes=Buffer.from(ownerPhoto.body.data,'base64'),sealed=db.prepare('SELECT sealed FROM private_photos WHERE user_id=?').get(a.state.user.id).sealed;ok(!Buffer.from(sealed).includes(bytes));equal((await sharp(bytes).metadata()).exif,undefined);
  const exported=await call('export',{token:a.token});ok(!exported.text.includes(ownerPhoto.body.data));ok(!exported.text.includes(key));
  const rawDb=await readFile(manifest.database);ok(!rawDb.includes(Buffer.from(key)));ok(!rawDb.includes(bytes));
 });
 await group('archive off/on during an in-flight upload revokes the old photo consent',async()=>{
  const pending=call('outfit/analyze',{method:'POST',token:a.token,data:{provider:'qwen',image,archivePhoto:true,text:'White shirt DELAY-OPTOUT'}});
  await waitDelayed('OPTOUT');equal((await call('settings',{method:'PUT',token:a.token,data:{preferences:pref(a.state,false)}})).status,200);
  equal((await call('settings',{method:'PUT',token:a.token,data:{preferences:pref(a.state,true)}})).status,200);await fetch(model+'/__release/OPTOUT');
  const r=await pending;equal(r.status,200);equal(r.body.photoRetained,false);equal((await call('looks',{token:a.token})).body.length,0);
  equal((await call('looks/'+archivedLook.id+'/photo',{token:a.token})).status,404);equal(db.prepare('SELECT COUNT(*) AS n FROM private_photos WHERE user_id=?').get(a.state.user.id).n,0);
 });
 await group('unsaved clothing copies expire together and opt-out removes recommendation copies',async()=>{
  let r=await call('outfit/analyze',{method:'POST',token:a.token,data:{provider:'qwen',text:'White shirt'}});equal(r.status,200);
  let matched=await call('outfit/recommend',{method:'POST',token:a.token,data:{analysisId:r.body.id,profile:r.body.profile,occasion:'WORK',mode:'both'}});equal(matched.status,200);
  db.prepare('UPDATE outfit_analyses SET created=? WHERE id=?').run(Date.now()-16*60000,r.body.id);
  equal((await call('export',{token:a.token})).status,200);
  equal(JSON.parse(db.prepare('SELECT body FROM recommendation_runs WHERE id=?').get(matched.body.requestId).body).outfit,undefined);
  r=await call('outfit/analyze',{method:'POST',token:a.token,data:{provider:'qwen',text:'Navy trousers'}});equal(r.status,200);
  matched=await call('outfit/recommend',{method:'POST',token:a.token,data:{analysisId:r.body.id,profile:r.body.profile,occasion:'WORK',mode:'both'}});equal(matched.status,200);
  equal((await call('settings',{method:'PUT',token:a.token,data:{preferences:pref(a.state,false)}})).status,200);
  equal(JSON.parse(db.prepare('SELECT body FROM recommendation_runs WHERE id=?').get(matched.body.requestId).body).outfit,undefined);
 });
 await group('logout invalidates delayed analysis before a receipt or photo can be saved',async()=>{
  const c=await demo(),pending=call('outfit/analyze',{method:'POST',token:c.token,data:{provider:'qwen',image,text:'White shirt DELAY-LOGOUT'}});
  await waitDelayed('LOGOUT');await call('auth',{method:'POST',token:c.token,data:{action:'logout',client:'mobile'}});await fetch(model+'/__release/LOGOUT');equal((await pending).status,401);
  equal(db.prepare('SELECT COUNT(*) AS n FROM outfit_analyses WHERE user_id=?').get(c.state.user.id).n,0);
 });
 await group('analysis limits remain enforced without invoking paid fallback',async()=>{
  const c=await demo();for(let i=0;i<8;i++)equal((await call('outfit/analyze',{method:'POST',token:c.token,data:{provider:'qwen',text:'White shirt'}})).status,200);
  equal((await call('outfit/analyze',{method:'POST',token:c.token,data:{provider:'qwen',text:'White shirt'}})).status,429);
 });
 await group('nonces, browser policies and public bundles contain no canary data',async()=>{
  const first=await fetch(base+'/mobile'),html=await first.text(),csp=first.headers.get('Content-Security-Policy');equal(first.status,200);ok(csp.includes("'strict-dynamic'"));ok(!/script-src[^;]*'unsafe-inline'/.test(csp));
  const nonce=csp.match(/'nonce-([^']+)'/)[1];for(const tag of html.match(/<script\b[^>]*>/g)??[])ok(tag.includes('nonce="'+nonce+'"'));
  const second=await fetch(base+'/mobile');ok(second.headers.get('Content-Security-Policy')!==csp);equal(first.headers.get('Cache-Control'),'no-store');equal(first.headers.get('Cross-Origin-Resource-Policy'),'same-origin');
  const root=await fetch(base+'/');equal(root.status,200);ok(root.headers.get('Content-Security-Policy').includes("'strict-dynamic'"));equal(root.headers.get('X-Powered-By'),null);
  async function scan(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const path=join(folder,entry.name);if(entry.isDirectory())await scan(path);else{const bytes=await readFile(path);ok(!bytes.includes(Buffer.from(key))&&!bytes.includes(Buffer.from(canary)),'Canary in public build asset');}}}
  await scan(resolve('public/mobile'));
  equal((await fetch(base+'/mobile/index.html',{redirect:'manual'})).status,307);
 });
 const inputs=await (await fetch(model+'/__inputs')).json();ok(inputs.every(input=>input.keep_alive===0));ok(!JSON.stringify(inputs).includes(key));ok(!JSON.stringify(inputs).includes(canary+'-memo'));
 const result={checkedAt:new Date().toISOString(),checks,groups,syntheticOnly:true,externalProviderCalls:false,mainDatabaseUsed:false,scope:'Isolated production HTTP server, local structured-model stub, disposable accounts and images'};
 await writeFile(join(work,'security-http-results.json'),JSON.stringify(result,null,2));console.log(`${checks} security checks passed across ${groups.length} groups. No paid provider calls or personal photos.`);
}finally{
 for(const account of accounts){try{await call('account',{method:'DELETE',token:account.token});}catch{}if(db)db.prepare('DELETE FROM users WHERE id=?').run(account.id);}
 db?.close();
}
