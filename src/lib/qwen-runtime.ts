import {runtimeEnvironment} from './environment.ts';
import {DEFAULT_MODELS} from './vault.ts';
import {getContext,getVercelOidcToken} from '@vercel/oidc';
export const HOSTED_QWEN_MODEL='alibaba/qwen3.8-27b';
export const QWEN_CLOUD_POLICY='qwen-cloud-v1';
export function qwenRuntime(env:Record<string,string|undefined>=process.env){
 const backend=env.FRAGOUT_QWEN_BACKEND??'local';
 if(backend==='local')return {mode:'local' as const,model:env.FRAGOUT_QWEN_MODEL??DEFAULT_MODELS.qwen,configured:true,destination:'Local Qwen',policyVersion:QWEN_CLOUD_POLICY};
 if(backend!=='gateway'||runtimeEnvironment(env)!=='production')throw new Error('Hosted Qwen requires an explicit production runtime.');
 return {mode:'hosted' as const,model:HOSTED_QWEN_MODEL,configured:!!(getContext().headers?.['x-vercel-oidc-token']??env.VERCEL_OIDC_TOKEN)?.trim(),destination:'Vercel AI Gateway',policyVersion:QWEN_CLOUD_POLICY};
}
export async function qwenAccessToken(){
 if(!qwenRuntime().configured)return;
 try{return await getVercelOidcToken();}catch{return;}
}
