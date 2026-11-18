import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const origin=process.env.FRAGOUT_TEST_URL??'http://localhost:3000',root=new URL('../',import.meta.url),registry=JSON.parse(readFileSync(new URL('catalog/photos.json',root),'utf8'));
let token,checks=0;const timings={};
async function call(path,{method='GET',body,expected=200}={}){
 const started=performance.now(),response=await fetch(origin+'/api/'+path,{method,signal:AbortSignal.timeout(45000),headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json',Origin:origin}:{})},body:body?JSON.stringify(body):undefined});
 assert.equal(response.status,expected,path);checks++;return {data:await response.json(),ms:Math.round(performance.now()-started)};
}
try{
 const session=await call('auth',{method:'POST',body:{action:'register',client:'mobile',name:'Disposable image QA',email:randomUUID()+'@example.test',password:randomUUID()}});token=session.data.sessionToken;
 const detail=(await call('catalog/detail',{method:'POST',body:{id:'dior-sauvage-edp'}})).data;
 assert.equal(detail.profile.sources.find(source=>source.id===detail.profile.photo.sourceId).publisher,'Parfumo');checks++;
 const official=Object.entries(registry).filter(([,rows])=>rows[0].publisher.endsWith(' (official)'));
 for(const [id,[photo]] of official){
  const entry=(await call('catalog/detail',{method:'POST',body:{id}})).data.profile,source=entry.sources.find(source=>source.id===entry.photo.sourceId);
  assert.equal(entry.photo.path,'/catalog/bottles/'+photo.file+'.jpg');assert.equal(source.publisher,photo.publisher);assert.equal(source.url,photo.url);checks+=3;
 }
 const files=Object.values(registry).map(rows=>rows[0].file+'.jpg');let next=0;
 async function worker(){while(next<files.length){const file=files[next++],response=await fetch(origin+'/catalog/bottles/'+file);assert.equal(response.status,200,file);assert.match(response.headers.get('content-type'),/^image\/jpeg/);const bytes=Buffer.from(await response.arrayBuffer()),original=readFileSync(new URL('public/catalog/bottles/'+file,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),createHash('sha256').update(original).digest('hex'));checks+=3;}}
 await Promise.all([worker(),worker(),worker(),worker()]);
 const search=await call('catalog/search',{method:'POST',body:{query:'Dior Fahrenheit'}}),edition=search.data.entries.find(entry=>entry.concentration==='EDT');assert.ok(edition);checks++;
 const add=await call('bottles',{method:'POST',expected:201,body:{brand:edition.brand,name:edition.name,concentration:edition.concentration,ownership:'OWNED',family:'',notes:[],strength:1,climate:'UNKNOWN',profileKnown:false,provenance:'unknown',color:'#aabb88',shape:'square',sizeMl:100,fillPct:100,rating:0,favorite:false,memo:''}});timings.add=add.ms;
 const profile=await call('bottles/'+add.data.id+'/profile');timings.profileLookup=profile.ms;
 assert.ok(profile.data.profile?.photo);assert.equal(profile.data.profile.sources.find(source=>source.id===profile.data.profile.photo.sourceId).publisher,'Parfumo');assert.match(profile.data.profile.photo.path,/^\/api\/catalog-image\/[a-f0-9]{64}$/);checks+=3;
 const image=await fetch(origin+profile.data.profile.photo.path);assert.equal(image.status,200);checks++;
 const state=await call('state');assert.ok(state.data.bottles[0].catalogPhoto);checks++;
 const result={at:new Date().toISOString(),checks,servedImages:files.length,parfumoThumbnails:Object.values(registry).filter(rows=>rows[0].publisher==='Parfumo').length,manufacturerThumbnails:official.length,newEntryPublisher:'Parfumo',timingsMs:timings};if(process.env.FRAGOUT_TEST_REPORT)writeFileSync(process.env.FRAGOUT_TEST_REPORT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{if(token)await call('account',{method:'DELETE'});}
