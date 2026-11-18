import {randomUUID} from 'node:crypto';
import {runtimeEnvironment,releaseIdentity} from './environment.ts';
type Env=Record<string,string|undefined>;
const routes=new Set(['health','ready','auth','state','bottles','settings','catalog','catalog-image','catalog-admin','compare','journal','layering','recommend','feedback','export','account','ai','outfit','vision','looks']);
export function beginRequest(request:{method:string;url:string;headers:Headers},env:Env){
 const parts=new URL(request.url).pathname.split('/').filter(Boolean),name=parts[0]==='api'&&routes.has(parts[1])?parts[1]:'unknown';
 return {id:randomUUID(),started:performance.now(),environment:runtimeEnvironment(env),revision:releaseIdentity(env),method:['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(request.method)?request.method:'OTHER',route:name+(name!=='unknown'&&parts.length>2?'/:item':'')};
}
export function finishRequest(context:ReturnType<typeof beginRequest>,status:number,env:Env,write:(entry:unknown)=>void=entry=>console.info(JSON.stringify(entry))){
 if(env.FRAGOUT_ACCESS_LOGS!=='true'&&env.VERCEL!=='1')return;
 write({event:'http.request',requestId:context.id,environment:context.environment,revision:context.revision,method:context.method,route:context.route,status,durationMs:Math.max(0,Math.round(performance.now()-context.started))});
}
