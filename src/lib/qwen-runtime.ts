import {runtimeEnvironment} from './environment.ts';
import {DEFAULT_MODELS} from './vault.ts';
import {getContext,getVercelOidcToken} from '@vercel/oidc';
export const HOSTED_QWEN_MODEL='alibaba/qwen3.8-27b';
export const FREE_QWEN_MODEL='qwen/qwen3.8-27b';
export const QWEN_CLOUD_POLICY='qwen-cloud-v1';
export function qwenRuntime(env:Record<string,string|undefined>=process.env){
 const environment=runtimeEnvironment(env),backend=env.FRAGOUT_QWEN_BACKEND??(environment==='production'?'auto':'local');
 if(backend==='local')return {mode:'local' as const,transport:'local' as const,cost:'local' as const,paidEnabled:false,model:env.FRAGOUT_QWEN_MODEL??DEFAULT_MODELS.qwen,configured:true,destination:'Local Qwen',policyVersion:QWEN_CLOUD_POLICY};
 if(!['auto','groq','gateway'].includes(backend)||environment!=='production')throw new Error('Hosted Qwen requires an explicit production runtime.');
 const paidEnabled=env.FRAGOUT_PAID_AI_ENABLED==='true'&&backend!=='groq';
 if(paidEnabled)return {mode:'hosted' as const,transport:'gateway' as const,cost:'paid' as const,paidEnabled,model:HOSTED_QWEN_MODEL,configured:!!(getContext().headers?.['x-vercel-oidc-token']??env.VERCEL_OIDC_TOKEN)?.trim(),destination:'Vercel AI Gateway',policyVersion:QWEN_CLOUD_POLICY};
 return {mode:'hosted' as const,transport:'groq' as const,cost:'free' as const,paidEnabled:false,model:FREE_QWEN_MODEL,configured:!!env.GROQ_API_KEY?.trim()&&env.FRAGOUT_GROQ_FREE_CONFIRMED==='true'&&env.FRAGOUT_GROQ_ZDR_CONFIRMED==='true',destination:'Groq',policyVersion:'qwen-groq-free-v1'};
}
export async function qwenAccessToken(){
 const runtime=qwenRuntime();
 if(!runtime.configured||runtime.transport==='local')return;
 if(runtime.transport==='groq')return process.env.GROQ_API_KEY?.trim();
 try{return await getVercelOidcToken();}catch{return;}
}
