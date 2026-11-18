import assert from 'node:assert/strict';
const origin=process.env.FRAGOUT_TEST_URL??'http://localhost:3000',environment=process.env.FRAGOUT_EXPECT_ENV??'development';
let checks=0;
async function request(path){const response=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(15000)});checks++;return response;}
const health=await request('/api/health');assert.equal(health.status,200);const info=await health.json();assert.equal(info.environment,environment);assert.match(health.headers.get('x-request-id'),/^[a-f\d-]{36}$/);checks+=3;
const ready=await request('/api/ready');assert.equal(ready.status,200);assert.equal((await ready.json()).status,'ready');assert.equal(ready.headers.get('x-fragout-environment'),environment);checks+=3;
for(const path of ['/data/fragout.sqlite','/.env','/credential-key','/private/reader.json','/recovery/recovery.pem']){const response=await request(path);assert.equal(response.status,404,path);checks++;await response.body?.cancel();}
for(const path of ['/api/state','/api/export','/api/looks']){const response=await request(path);assert.equal(response.status,401,path);checks++;assert.match(response.headers.get('cache-control'),/no-store/);checks++;}
if(environment==='staging'){const response=await request('/mobile');assert.equal(response.status,200);assert.match(response.headers.get('x-robots-tag'),/noindex/);checks+=2;}
console.log(JSON.stringify({at:new Date().toISOString(),checks,environment,liveness:'ok',readiness:'ready',privateFiles:'not served'}));
