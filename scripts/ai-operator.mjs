// Operator-only CLI. Values use stdin; no browser/app endpoint can call this.
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const project='prj_am2fYjn2SVu3Ox4vBdpFQTvWtjzA',team='rouchihas-projects',teamId='team_VvCDKAaJ7mUDq2rJjFQ0rSsm';
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
 if(health.environment!=='production'||health.capabilities?.paidAiSwitch!==true||health.capabilities?.freeHostedVision!==true||!(/^[a-f\d]{7,40}$/).test(health.revision??''))throw new Error('Deploy the free-vision release before changing its hosted settings.');
 return health.revision;
}
export function setProduction(name,value,sensitive=false){
 const metadata=vc(['api','/v10/projects/'+project+'/env?decrypt=false&teamId='+teamId]);
 if(metadata.status!==0)throw new Error('Could not verify Production-only variable scope. No setting was written.');
 let variables;try{variables=JSON.parse(metadata.stdout).envs;}catch{throw new Error('Could not verify variable metadata. No setting was written.');}
 if(!Array.isArray(variables))throw new Error('Could not verify variable metadata. No setting was written.');
 const matching=variables.filter(entry=>entry.key===name);
 // CLI update preserves all targets. Refuse shared/ambiguous records first.
 if(matching.length>1||matching.some(entry=>!Array.isArray(entry.target)||entry.target.length!==1||entry.target[0]!=='production'||entry.gitBranch||entry.customEnvironmentIds?.length))throw new Error('This setting is not exclusively Production-scoped. Review it in Vercel before retrying.');
 const flags=['--project',project,'--yes','--non-interactive',...(sensitive?['--sensitive']:[])];
 const result=vc(['env',matching.length?'update':'add',name,'production',...flags],value);
 if(result.status!==0)throw new Error('Vercel setting update failed. No values were displayed.');
}
export async function redeploy(expectedPaidEnabled,expectedRevision){
 console.log('Rebuilding the current published source with the operator settings.');
 const result=vc(['redeploy','https://fragout-wardrobe.vercel.app','--target','production']);
 if(result.status!==0)throw new Error('Redeploy failed; inspect Vercel before retrying.');
 const health=await fetch('https://fragout-wardrobe.vercel.app/api/health',{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!health.ok)throw new Error('Deployment switch verification failed. Inspect production before retrying.');
 const info=await health.json();
 if(info.environment!=='production'||info.capabilities?.paidAiSwitch!==true||info.capabilities?.freeHostedVision!==true||info.revision!==expectedRevision||info.paidAiEnabled!==expectedPaidEnabled)throw new Error('Deployment switch verification failed. Inspect production before retrying.');
 const ready=await fetch('https://fragout-wardrobe.vercel.app/api/ready',{redirect:'error',signal:AbortSignal.timeout(15000)});
 if(!ready.ok)throw new Error('Production readiness check failed. Inspect Vercel before retrying.');
 console.log('Production deployment and switch state verified.');
}
