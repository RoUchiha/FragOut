import {runVision,localModelStatus} from '../src/lib/providers.ts';
console.log(JSON.stringify(await localModelStatus()));
const start=Date.now();
const result=await runVision('qwen','qwen3-vl:2b-instruct',undefined,'outfit',{text:'White linen shirt, beige trousers and brown loafers. A smart casual outfit.'});
console.log(JSON.stringify({elapsedMs:Date.now()-start,profile:result}));
