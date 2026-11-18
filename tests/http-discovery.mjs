import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';

const origin=process.env.FRAGOUT_TEST_URL??'http://localhost:3000',sessions=[],timings={},groups=[];let checks=0;
const equal=(a,b,message)=>{assert.equal(a,b,message);checks++;};
const ok=(value,message)=>{assert.ok(value,message);checks++;};
async function call(path,{method='GET',data,token,cookie,expected=200}={}){
 const started=performance.now();
 const response=await fetch(origin+'/api/'+path,{method,signal:AbortSignal.timeout(45000),headers:{
  ...(token?{Authorization:'Bearer '+token}:{}),...(cookie?{Cookie:cookie}:{}),...(data?{'Content-Type':'application/json'}:{}),
  ...(method!=='GET'?{Origin:origin}:{}),
 },body:data?JSON.stringify(data):undefined});
 equal(response.status,expected,method+' '+path);equal(response.headers.get('cache-control'),'no-store');
 return {body:await response.json(),headers:response.headers,ms:Math.round((performance.now()-started)*10)/10};
}
async function register(){
 const email=randomUUID()+'@example.test',password=randomUUID();
 const {body}=await call('auth',{method:'POST',data:{action:'register',client:'mobile',name:'Disposable Parfumo QA',email,password}});
 sessions.push(body.sessionToken);return {token:body.sessionToken,email,password,state:body};
}
async function group(name,work){await work();groups.push(name);console.log('PASS '+name);}
try{
 const owner=await register(),other=await register();let edition,profile,first,second,wear;
 await group('authentication and catalog search',async()=>{
  await call('catalog/search',{method:'POST',data:{},expected:401});
  await call('journal/2026-03',{expected:401});await call('journal/export',{expected:401});
  const result=await call('catalog/search',{method:'POST',token:owner.token,data:{query:'Dior Sauvage'}});timings.search=result.ms;
  edition=result.body.entries.find(entry=>entry.concentration==='EDP');ok(edition);ok(edition.photo);ok(result.body.total>1);
  const all=await call('catalog/search',{method:'POST',token:owner.token,data:{}});equal(all.body.total,1513);equal(all.body.entries.length,12);
  const next=await call('catalog/search',{method:'POST',token:owner.token,data:{offset:12}});ok(next.body.entries.every(entry=>!all.body.entries.some(previous=>entry.id===previous.id)));
 });
 await group('sourced detail, notes, ratings and public bottle thumbnail',async()=>{
  const result=await call('catalog/detail',{method:'POST',token:owner.token,data:{id:edition.id}});timings.detail=result.ms;profile=result.body.profile;
  equal(profile.concentration,edition.concentration);ok(profile.notes.length);ok(profile.sources.length>=2);ok(result.body.similar.length);
  ok(profile.ratings.every(rating=>rating.score>=0&&rating.score<=5&&profile.sources.some(source=>source.id===rating.sourceId)));
  const photo=await fetch(origin+profile.photo.path);equal(photo.status,200);ok((await photo.arrayBuffer()).byteLength>1000);
  const note=profile.notes.find(note=>note.stage==='base')??profile.notes[0];
  const included=await call('catalog/search',{method:'POST',token:owner.token,data:{query:edition.name,include:[note.name],stage:note.stage}});
  ok(included.body.entries.some(entry=>entry.id===edition.id));
  equal((await call('catalog/search',{method:'POST',token:owner.token,data:{query:edition.name,exclude:[note.name],stage:note.stage}})).body.entries.some(entry=>entry.id===edition.id),false);
  equal((await call('catalog/search',{method:'POST',token:owner.token,data:{include:['NoSuchRecordedNote']}})).body.total,0);
 });
 const bottleBody={brand:edition.brand,name:edition.name,concentration:edition.concentration,ownership:'OWNED',family:'',notes:[],strength:1,climate:'UNKNOWN',profileKnown:false,provenance:'unknown',color:'#aabb88',shape:'square',sizeMl:2,fillPct:75,rating:4,favorite:false,memo:'Synthetic private shelf QA',shelves:['Samples','samples','Tested']};
 await group('native catalog-to-collection journey and private shelves',async()=>{
  const start=performance.now(),added=await call('bottles',{method:'POST',token:owner.token,data:bottleBody,expected:201});first=added.body;timings.add=added.ms;
  const detail=await call('bottles/'+first.id+'/profile',{token:owner.token});equal(detail.body.profile.id,edition.id);
  const state=await call('state',{token:owner.token});timings.addThroughProfileAndCollection=Math.round((performance.now()-start)*10)/10;
  const bottle=state.body.bottles.find(bottle=>bottle.id===first.id);equal(bottle.sizeMl,2);equal(bottle.shelves.length,2);ok(bottle.catalogPhoto);ok(bottle.catalogNoteGroups.length);
  equal((await call('state',{token:other.token})).body.bottles.some(bottle=>bottle.id===first.id),false);
  await call('collection/view',{method:'PUT',token:owner.token,data:{sort:'rating',layout:'list'}});
  const after=(await call('state',{token:owner.token})).body;equal(after.preferences.collectionView.layout,'list');equal(after.preferences.archiveOutfits,false);
  second=(await call('bottles',{method:'POST',token:owner.token,data:{...bottleBody,sizeMl:10,shelves:['Decants']},expected:201})).body;
 });
 await group('comparison accuracy and owner isolation',async()=>{
  const result=await call('compare',{method:'POST',token:owner.token,data:{left:{kind:'bottle',id:first.id},right:{kind:'catalog',id:edition.id}}});timings.compare=result.ms;
  equal(result.body.noteOverlap,100);ok(result.body.sharedNotes.length);equal(result.body.leftOnly.length,0);
  await call('compare',{method:'POST',token:other.token,data:{left:{kind:'bottle',id:first.id},right:{kind:'catalog',id:edition.id}},expected:404});
 });
 await group('calendar, layering, backdates, CSV protection and historic edits',async()=>{
  const result=await call('journal',{method:'POST',token:owner.token,data:{bottleIds:[first.id,second.id],date:'2026-03-08',note:'=SUM(1+1)'},expected:201});wear=result.body;timings.logWear=result.ms;
  const journal=await call('journal/2026-03',{token:owner.token});equal(journal.body.totalWears,1);equal(journal.body.layeredWears,1);equal(journal.body.days['2026-03-08'],1);equal(journal.body.mostWorn.length,2);
  const csv=(await call('journal/export',{token:owner.token})).body.csv;ok(csv.includes("'=SUM(1+1)"));
  equal((await call('journal/2026-03',{token:other.token})).body.totalWears,0);
  await call('journal/'+wear.id,{method:'PATCH',token:other.token,data:{date:'2026-03-09',note:'Intrusion'},expected:404});
  await call('journal',{method:'POST',token:owner.token,data:{bottleIds:[first.id],date:'2999-01-01',note:''},expected:400});
  await call('journal/'+wear.id,{method:'PATCH',token:owner.token,data:{date:'2026-02-30',note:''},expected:400});
  await call('bottles/'+first.id,{method:'DELETE',token:owner.token});
  const changed=await call('journal/'+wear.id,{method:'PATCH',token:owner.token,data:{date:'2026-03-09',note:'Edited synthetic note'}});equal(changed.body.names[0],first.name);
  equal((await call('journal/2026-03',{token:owner.token})).body.days['2026-03-09'],1);
 });
 await group('desktop secure cookie session and refreshed app bundles',async()=>{
  const web=await call('auth',{method:'POST',data:{action:'login',email:owner.email,password:owner.password}});
  const cookie=web.headers.get('set-cookie');ok(cookie?.includes('HttpOnly'));ok(cookie.includes('Secure'));ok(cookie.includes('SameSite=lax'));
  const cookieHeader=cookie.split(';')[0];equal((await call('journal/2026-03',{cookie:cookieHeader})).body.totalWears,1);
  for(const path of ['/','/mobile']){const response=await fetch(origin+path);equal(response.status,200);ok(response.headers.get('content-security-policy')?.includes('nonce-'));}
  await call('auth',{method:'POST',cookie:cookieHeader,data:{action:'logout'}});
  await call('journal/2026-03',{cookie:cookieHeader,expected:401});
 });
 const samples=[];for(let i=0;i<10;i++)samples.push((await call('catalog/search',{method:'POST',token:owner.token,data:{query:'Dior Sauvage'}})).ms);
 samples.sort((a,b)=>a-b);timings.searchWarmMedian=samples[5];timings.searchWarmP95=samples[9];
 const report={at:new Date().toISOString(),origin,checks,groups,timingsMs:timings};
 if(process.env.FRAGOUT_TEST_REPORT)writeFileSync(process.env.FRAGOUT_TEST_REPORT,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{
 for(const token of sessions)try{await call('account',{method:'DELETE',token});}catch{console.error('Disposable test-account cleanup needs review.');}
}
