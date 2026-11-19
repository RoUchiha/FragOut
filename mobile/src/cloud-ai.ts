import type {AiProvider,AiStatus,QwenCloudConsent} from '../../src/lib/types';
export const cloudAiNames = {openai:'OpenAI',claude:'Anthropic (Claude)'} as const;
export type CloudDestination={provider:AiProvider;name:string;cloudConsent?:QwenCloudConsent};
export function cloudDestination(status:AiStatus|null,hasImage:boolean):CloudDestination|undefined{
 if(!status)return;
 if(status.selected!=='qwen')return {provider:status.selected,name:cloudAiNames[status.selected]};
 if(hasImage&&status.qwen?.mode==='hosted'){
  const {destination,model,policyVersion}=status.qwen;
  return {provider:'qwen',name:'Qwen Cloud',cloudConsent:{destination,model,policyVersion}};
 }
}
