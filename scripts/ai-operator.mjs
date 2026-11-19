// Operator-only CLI. Values use stdin; no browser/app endpoint can call this.
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const project='prj_am2fYjn2SVu3Ox4vBdpFQTvWtjzA',team='rouchihas-projects';
export function vc(args,input){
 const cli=process.env.FRAGOUT_VERCEL_CLI;
 const prefix=cli?[resolve(cli)]:process.env.npm_execpath?[process.env.npm_execpath,'exec','--yes','--package=vercel@58.4.4','--','vercel']:null;
 if(!prefix)throw new Error('Run this command through npm, or set FRAGOUT_VERCEL_CLI to the installed CLI entrypoint.');
 return spawnSync(process.execPath,[...prefix,...args,'--scope',team],{input,encoding:'utf8',windowsHide:true,timeout:300000});
}
export async function requirePublishedSupport(){
 const response=await fetch('https://fragout-wardrobe.vercel.app/api/health',{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Deploy the free-vision release before changing its hosted settings.');
 const health=await response.json();
 if(health.capabilities?.paidAiSwitch!==true||health.capabilities?.freeHostedVision!==true)throw new Error('Deploy the free-vision release before changing its hosted settings.');
}
export function setProduction(name,value,sensitive=false){
 const flags=['--project',project,'--yes','--non-interactive',...(sensitive?['--sensitive']:[])];
 let result=vc(['env','update',name,'production',...flags],value);
 if(result.status!==0){
  const reason=(result.stderr??'')+(result.stdout??'');
  if(!/not found|does not exist|could not find/i.test(reason))throw new Error('Vercel setting update failed. No values were displayed.');
  result=vc(['env','add',name,'--environment','production',...flags],value);
 }
 if(result.status!==0)throw new Error('Vercel setting update failed. No values were displayed.');
}
export async function redeploy(expectedPaidEnabled){
 console.log('Rebuilding the current published source with the operator settings.');
 const result=vc(['redeploy','https://fragout-wardrobe.vercel.app','--target','production']);
 if(result.status!==0)throw new Error('Redeploy failed; inspect Vercel before retrying.');
 const health=await fetch('https://fragout-wardrobe.vercel.app/api/health',{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!health.ok||(await health.json()).paidAiEnabled!==expectedPaidEnabled)throw new Error('Deployment switch verification failed. Inspect production before retrying.');
 const ready=await fetch('https://fragout-wardrobe.vercel.app/api/ready',{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!ready.ok)throw new Error('Production readiness check failed. Inspect Vercel before retrying.');
 console.log('Production deployment and switch state verified.');
}
