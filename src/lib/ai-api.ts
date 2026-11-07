import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import type {Store} from './store.ts';
import type {OutfitReceipt,User} from './types.ts';
import {CredentialVault,installationKey,DEFAULT_MODELS} from './vault.ts';
import {imageSchema,outfitSchema,parseOutfitText,rankForOutfit} from './outfit.ts';
import {LOCAL_MODEL,ProviderError,localModelStatus,prepareImage,runVision,testProvider} from './providers.ts';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const providerSchema=z.enum(['qwen','openai','claude']);
const occasionSchema=z.enum(['GENERAL','GYM','DATE','WORK','PARTY','ERRANDS','CUSTOM']);
const modelSchema=z.string().trim().regex(/^[A-Za-z0-9._:-]{1,120}$/);
export async function handleAiApi(req:NextRequest,path:string[],body:unknown,user:User,db:Store){
 if(!['ai','outfit','vision'].includes(path[0]))return null;
 try{
  const vault=new CredentialVault(db.db,installationKey());const method=req.method;
  if(path[0]==='ai'&&path[1]==='status'&&method==='GET')return json({selected:vault.selected(user.id),connections:vault.metadata(user.id),local:await localModelStatus()});
  if(path[0]==='ai'&&path[1]==='connection'&&method==='POST'){
   if(req.nextUrl.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(req.nextUrl.hostname))return json({error:'API key connections require HTTPS. Use the companion app on this computer or configure HTTPS.'},400);
   const d=z.object({provider:z.enum(['openai','claude']),key:z.string().trim().min(10).max(512).regex(/^[A-Za-z0-9_\-.]+$/),model:modelSchema.optional()}).strict().parse(body);
   vault.set(user.id,d.provider,d.key,d.model??DEFAULT_MODELS[d.provider]);return json({ok:true});
  }
  if(path[0]==='ai'&&path[1]==='provider'&&method==='PUT'){const d=z.object({provider:providerSchema}).strict().parse(body);vault.select(user.id,d.provider);return json({ok:true});}
  if(path[0]==='ai'&&path[1]==='connection'&&path[2]&&method==='DELETE'){const p=z.enum(['openai','claude']).parse(path[2]);vault.remove(user.id,p);return json({ok:true});}
  if(path[0]==='ai'&&path[1]==='test'&&method==='POST'){
   const d=z.object({provider:providerSchema}).strict().parse(body);const c=d.provider==='qwen'?null:vault.get(user.id,d.provider);
   if(d.provider!=='qwen'&&!c)throw new ProviderError('Connect your own API key first.',409);await testProvider(d.provider,c?.model??LOCAL_MODEL,c?.key);return json({ok:true});
  }
  if((path[0]==='outfit'&&path[1]==='analyze'||path[0]==='vision'&&path[1]==='bottle')&&method==='POST'){
   if(!db.limit('vision:'+user.id,8,60000))return json({error:'Analysis limit reached. Please wait a minute.'},429);
   const input=z.object({provider:providerSchema,text:z.string().trim().max(1800).optional(),image:imageSchema.optional()}).strict().refine(d=>!!d.text||!!d.image,'Add a photo or describe your outfit.').parse(body);
   const provider=vault.selected(user.id),connection=provider==='qwen'?null:vault.get(user.id,provider);
   if(input.provider!==provider)throw new ProviderError('Provider changed. Review the selected connection before analyzing.',409);
   if(provider!=='qwen'&&!connection)throw new ProviderError('Connect your own API key first.',409);
   const model=provider==='qwen'?LOCAL_MODEL:connection!.model;
   const image=input.image?await prepareImage(input.image):undefined;
   if(path[0]==='vision'){
    if(!image)throw new ProviderError('Take or choose a bottle photo.',400);
    const result=await runVision(provider,model,connection?.key,'bottle',{image,text:'Read the exact visible fragrance label. Return only uncertain candidates.'});
    return json({...result,provider,model});
   }
   let profile,method:'model'|'offline_rules'='model';
   try{profile=outfitSchema.parse(await runVision(provider,model,connection?.key,'outfit',{text:input.text,image}));}
   catch(error){if(provider==='qwen'&&!image&&input.text){profile=parseOutfitText(input.text);method='offline_rules';}else throw error;}
   const receipt:OutfitReceipt={id:randomUUID(),profile,provider,model:method==='model'?model:'offline-description-rules',method,createdAt:new Date().toISOString()};
   db.saveOutfit(user.id,receipt);return json(receipt);
  }
  if(path[0]==='outfit'&&path[1]==='recommend'&&method==='POST'){
   const d=z.object({analysisId:z.string().uuid(),profile:outfitSchema,mode:z.enum(['solo','combo','both']),evidenceMode:z.enum(['evidence','single','experimental']).default('evidence'),occasion:occasionSchema}).strict().parse(body);
   if(!db.getOutfit(user.id,d.analysisId))return json({error:'Outfit analysis not found or expired. Analyze the outfit again.'},404);
   const state=db.state(user.id);const context={...state.context,occasion:d.occasion};
   const result=rankForOutfit(state.bottles,context,state.preferences,d.profile,d.mode,d.evidenceMode,[],state.history.filter(h=>h.reaction==='disliked'&&h.bottleIds.length===2).map(h=>h.bottleIds));
   const requestId=db.recordRecommendation(user.id,context,[...new Set([...result.solo.map(r=>r.bottle.id),...result.combos.flatMap(r=>[r.a.id,r.b.id])])]);
   return json({...result,requestId,context,outfit:d.profile});
  }
  return json({error:'Not found.'},404);
 }catch(error){if(error instanceof ProviderError)return json({error:error.message},error.status);if(error instanceof z.ZodError)return json({error:error.issues.map(i=>i.message).slice(0,2).join(' ')},400);if(error instanceof Error&&error.message==='Connect your own API key first.')return json({error:error.message},409);throw error;}
}
