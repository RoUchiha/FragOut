import {z} from 'zod';
import {requirePublishedSupport,setProduction,redeploy} from './ai-operator.mjs';
import {FREE_QWEN_MODEL} from '../src/lib/qwen-runtime.ts';
let key='',input='';
try{
 const revision=await requirePublishedSupport();
 process.stdin.setEncoding('utf8');for await(const chunk of process.stdin){input+=chunk;if(input.length>4096)throw new Error();}
 const setup=z.object({key:z.string().trim().min(10).max(512).regex(/^[A-Za-z0-9_.-]+$/),freeConfirmed:z.literal(true),zdrConfirmed:z.literal(true)}).strict().parse(JSON.parse(input));
 key=setup.key;setup.key='';input='';
 const response=await fetch('https://api.groq.com/openai/v1/models',{headers:{Authorization:'Bearer '+key},redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok||!(await response.json()).data?.some(model=>model.id===FREE_QWEN_MODEL))throw new Error();
 // No credit purchase or developer-plan upgrade. The key never enters argv/files.
 setProduction('FRAGOUT_PAID_AI_ENABLED','false');
 setProduction('GROQ_API_KEY',key,true);key='';
 setProduction('FRAGOUT_GROQ_FREE_CONFIRMED','true');
 setProduction('FRAGOUT_GROQ_ZDR_CONFIRMED','true');
 setProduction('FRAGOUT_QWEN_BACKEND','auto');
 await redeploy(false,revision);console.log('Free Groq vision configured; app-funded paid analysis is off.');
}catch{console.error('Free setup did not complete. Confirm the free account, ZDR, model access and Vercel sign-in; no key was displayed.');process.exitCode=1;}
finally{key='';input='';}
