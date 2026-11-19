import type {AiProvider,AiStatus,QwenCloudConsent} from '../../src/lib/types';
export const cloudAiNames = {openai:'OpenAI',claude:'Anthropic (Claude)'} as const;
export type CloudDestination={provider:AiProvider;name:string;cloudConsent?:QwenCloudConsent};
export function cloudDestination(status:AiStatus|null,hasImage:boolean):CloudDestination|undefined{
 if(!status)return;
 if(status.selected!=='qwen')return {provider:status.selected,name:cloudAiNames[status.selected]};
 if(hasImage&&status.qwen?.mode==='hosted'){
  const {destination,model,policyVersion}=status.qwen;
  // Updated clients render the named host before sending this acknowledgment;
  // never copy it from status. Legacy clients displayed a fixed Gateway host.
  return {provider:'qwen',name:'Qwen Cloud',cloudConsent:{destination,model,policyVersion,...(destination==='Groq'&&policyVersion==='qwen-groq-free-v1'?{disclosureVersion:'2' as const}:{})}};
 }
}
