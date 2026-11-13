import {type NextRequest,NextResponse} from 'next/server.js';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import type {Store} from './store.ts';
import type {OutfitReceipt,User} from './types.ts';
import {CredentialVault,installationKey,DEFAULT_MODELS} from './vault.ts';
import {PrivateLooks} from './private-looks.ts';
import {imageSchema,outfitSchema,parseOutfitText,rankForOutfit} from './outfit.ts';
import {LOCAL_MODEL,ProviderError,localModelStatus,prepareImage,runVision,testProvider} from './providers.ts';
import {intentFields} from './validation.ts';
import {enrichRecommendationBottles,reviewedPairsFor} from './recommendation-evidence.ts';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer'}});
const providerSchema=z.enum(['qwen','openai','claude']);
const occasionSchema=z.enum(['GENERAL','GYM','DATE','WORK','PARTY','ERRANDS','CUSTOM']);
const modelSchema=z.string().trim().regex(/^[A-Za-z0-9._:-]{1,120}$/);
const lookValidationErrors=new Set([
 'Enable outfit archiving before saving a look.',
 'Confirm the outfit and fragrance selection first.',
 'Reviewed recommendation not found or expired.',
 'Select a fragrance or pair offered for this outfit.',
 'The selected owned fragrance has changed. Find fresh matches.',
]);
export async function handleAiApi(
 req:NextRequest,path:string[],body:unknown,user:User,db:Store,
 isActive:()=>boolean|Promise<boolean>=async()=>!!(await db.user(user.id)),
 isActiveForWrite?:(scoped:Store)=>Promise<boolean>,
){
 if(!['ai','outfit','vision','looks'].includes(path[0]))return null;
 const route=path.join('/');
 const verifySession=async(check=isActive)=>{if(!await check())throw new ProviderError('Session expired. Sign in again.',401);};
 const authorize=isActiveForWrite?(scoped:Store)=>verifySession(()=>isActiveForWrite(scoped)):undefined;
 const privateJson=async(data:unknown,status=200)=>{await verifySession();return json(data,status);};
 try{
  await verifySession();const key=installationKey(),vault=new CredentialVault(db.db,key),looks=new PrivateLooks(db,key),method=req.method;
  if(route==='ai/status'&&method==='GET'){
   const local=await localModelStatus();
   await verifySession();
   const [selected,connections]=await Promise.all([vault.selected(user.id),vault.metadata(user.id)]);
   return await privateJson({selected,connections,local});
  }
  if(route==='ai/connection'&&method==='POST'){
   if(req.nextUrl.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(req.nextUrl.hostname))return json({error:'API key connections require HTTPS. Open the mobile preview on this computer or configure HTTPS.'},400);
   const d=z.object({provider:z.enum(['openai','claude']),key:z.string().trim().min(10).max(512).regex(/^[A-Za-z0-9_\-.]+$/),model:modelSchema.optional()}).strict().parse(body);
   try{await vault.set(user.id,d.provider,d.key,d.model??DEFAULT_MODELS[d.provider]);}
   finally{d.key='';if(body&&typeof body==='object'&&'key' in body)body.key='';}
   return json({ok:true});
  }
  if(route==='ai/provider'&&method==='PUT'){const d=z.object({provider:providerSchema}).strict().parse(body);await vault.select(user.id,d.provider);return json({ok:true});}
  if(path.length===3&&path[0]==='ai'&&path[1]==='connection'&&method==='DELETE'){const provider=z.enum(['openai','claude']).parse(path[2]);await vault.remove(user.id,provider);return json({ok:true});}
  if(route==='ai/test'&&method==='POST'){
   if(!await db.limit('provider-test:'+user.id,10,60000))return json({error:'Connection test limit reached. Wait a minute.'},429);
   const d=z.object({provider:providerSchema}).strict().parse(body),connection=d.provider==='qwen'?null:await vault.get(user.id,d.provider);
   await verifySession();
   if(d.provider!=='qwen'&&!connection)throw new ProviderError('Connect your own API key first.',409);
   await testProvider(d.provider,connection?.model??LOCAL_MODEL,connection?.key);
   return await privateJson({ok:true});
  }
  if((route==='outfit/analyze'||route==='vision/bottle')&&method==='POST'){
   if(!await db.limit('vision:'+user.id,8,60000))return json({error:'Analysis limit reached. Please wait a minute.'},429);
   const input=z.object({provider:providerSchema,text:z.string().trim().max(1800).optional(),image:imageSchema.optional(),archivePhoto:z.boolean().default(false)}).strict().refine(d=>!!d.text||!!d.image,'Add a photo or describe your outfit.').parse(body);
   if(route==='vision/bottle'&&input.archivePhoto)throw new ProviderError('Bottle photos cannot be archived.',400);
   const archiveConsent=input.image&&input.archivePhoto?await db.archiveConsent(user.id):null;
   const provider=await vault.selected(user.id);
   if(input.provider!==provider)throw new ProviderError('Provider changed. Review the selected connection before analyzing.',409);
   let image;
   try{
    image=input.image?await prepareImage(input.image):undefined;
    if(input.image)input.image.data='';
    if(body&&typeof body==='object'&&'image' in body&&body.image&&typeof body.image==='object'&&'data' in body.image)body.image.data='';
    const connection=provider==='qwen'?null:await vault.get(user.id,provider);
    const currentProvider=await vault.selected(user.id);
    await verifySession();
    if(currentProvider!==provider)throw new ProviderError('Provider changed. Review the selected connection before analyzing.',409);
    if(provider!=='qwen'&&!connection)throw new ProviderError('Connect your own API key first.',409);
    const model=provider==='qwen'?LOCAL_MODEL:connection!.model;
    if(route==='vision/bottle'){
     if(!image)throw new ProviderError('Take or choose a bottle photo.',400);
     const result=await runVision(provider,model,connection?.key,'bottle',{image,text:'Read the exact visible fragrance label. Return only uncertain candidates.'});
     return await privateJson({...result,provider,model});
    }
    let profile,method:'model'|'offline_rules'='model';
    if(provider==='qwen'&&!image&&input.text){
     profile=parseOutfitText(input.text);
     method='offline_rules';
    }else{
     profile=outfitSchema.parse(await runVision(provider,model,connection?.key,'outfit',{text:input.text,image}));
    }
    await verifySession();
    const receipt:OutfitReceipt={id:randomUUID(),profile,provider,model:method==='model'?model:'offline-description-rules',method,createdAt:new Date().toISOString()};
    if(authorize){
     await db.withOwnerTransaction(user.id,async scoped=>{
      await authorize(scoped);
      await scoped.saveOutfit(user.id,receipt);
     });
    }else await db.saveOutfit(user.id,receipt);
    let photoRetained=false;
    if(image&&profile.hasOutfit&&input.archivePhoto&&archiveConsent!==null){
     await verifySession();
     photoRetained=await looks.stagePhoto(user.id,receipt.id,image,true,archiveConsent,authorize);
    }
    return await privateJson({...receipt,photoRetained});
   }finally{
    if(image)image.data='';if(input.image)input.image.data='';
    if(body&&typeof body==='object'&&'image' in body&&body.image&&typeof body.image==='object'&&'data' in body.image)body.image.data='';
   }
  }
  if(route==='outfit/recommend'&&method==='POST'){
   const d=z.object({analysisId:z.string().uuid(),profile:outfitSchema,mode:z.enum(['solo','combo','both']),evidenceMode:z.enum(['evidence','single','experimental']).default('evidence'),occasion:occasionSchema,...intentFields}).strict().parse(body);
   const archiveEpoch=await db.archiveConsent(user.id);
   if(!await db.getOutfit(user.id,d.analysisId))return json({error:'Outfit analysis not found or expired. Analyze the outfit again.'},404);
   const state=await db.state(user.id),context={...state.context,occasion:d.occasion,mood:d.mood,vibe:d.vibe};
   const bottles=enrichRecommendationBottles(state.bottles);
   const result=rankForOutfit(bottles,context,state.preferences,d.profile,d.mode,d.evidenceMode,reviewedPairsFor(bottles),state.history.filter(h=>h.reaction==='disliked'&&h.bottleIds.length===2).map(h=>h.bottleIds));
   const offered=[...result.solo.map(r=>r.bottle),...result.combos.flatMap(r=>[r.a,r.b])];
   const choices=[...result.solo.map(r=>[r.bottle.id]),...result.combos.map(r=>[r.a.id,r.b.id])];
   const outfit=archiveEpoch!==null?{analysisId:d.analysisId,profile:d.profile,choices,variants:Object.fromEntries(offered.map(b=>[b.id,b.variantId]))}:undefined;
   await verifySession();
   const requestId=await db.recordRecommendation(user.id,context,[...new Set(offered.map(b=>b.id))],outfit,archiveEpoch,authorize);
   return await privateJson({...result,requestId,context,outfit:d.profile});
  }
  if(route==='looks'&&method==='GET')return await privateJson(await looks.list(user.id));
  if(route==='looks'&&method==='POST'){
   const d=z.object({requestId:z.string().uuid(),bottleIds:z.array(z.string().uuid()).min(1).max(2),confirmedAccurate:z.literal(true)}).strict().parse(body);
   return await privateJson(await looks.save(user.id,d,authorize),201);
  }
  if(path.length===3&&path[0]==='looks'&&path[2]==='photo'&&method==='GET'){
   const photo=await looks.photo(user.id,z.string().uuid().parse(path[1]));return photo?await privateJson(photo):json({error:'Photo not found.'},404);
  }
  if(path.length===2&&path[0]==='looks'&&method==='DELETE')return await looks.remove(user.id,z.string().uuid().parse(path[1]))?json({ok:true}):json({error:'Look not found.'},404);
  return json({error:'Not found.'},404);
 }catch(error){
  if(error instanceof ProviderError)return json({error:error.message},error.status);
  if(error instanceof z.ZodError)return json({error:error.issues.map(i=>i.message).slice(0,2).join(' ')},400);
  if(error instanceof Error&&error.message==='Connect your own API key first.')return json({error:error.message},409);
  if(path[0]==='looks'&&error instanceof Error){
   if(error.message==='Saved photo integrity could not be verified.')return json({error:error.message},503);
   if(lookValidationErrors.has(error.message))return json({error:error.message},400);
  }
  throw error;
 }
}
