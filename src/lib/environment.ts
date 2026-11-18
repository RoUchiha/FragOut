import type {DataConnection} from './database.ts';
export type DeploymentEnvironment='development'|'staging'|'production';
type Env=Record<string,string|undefined>;

export function runtimeEnvironment(env:Env=process.env):DeploymentEnvironment{
 const value=env.FRAGOUT_ENVIRONMENT??(env.VERCEL==='1'&&env.VERCEL_ENV!=='development'?(env.VERCEL_ENV==='production'?'production':'staging'):'development');
 if(!['development','staging','production'].includes(value)||env.VERCEL==='1'&&env.VERCEL_ENV!=='development'&&value==='development')throw new Error('Invalid deployment environment.');
 return value as DeploymentEnvironment;
}

export async function assertDatabaseEnvironment(db:DataConnection,expected:DeploymentEnvironment){
 const row=await db.get<{environment:string;instance_id:string}>('SELECT environment,instance_id FROM deployment_identity WHERE id=1');
 if(!row||row.environment!==expected||!/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(row.instance_id))throw new Error('Database environment does not match this operation.');
 return {environment:expected,instanceId:row.instance_id};
}

export function releaseIdentity(env:Env=process.env){
 const candidate=env.FRAGOUT_RELEASE??env.VERCEL_GIT_COMMIT_SHA??'';
 return /^[a-f\d]{7,40}$/i.test(candidate)?candidate.slice(0,12):'local';
}
