import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import type {Store} from './store.ts';
import type {OutfitReceipt,User} from './types.ts';
import {CredentialVault,installationKey,DEFAULT_MODELS} from './vault.ts';
import {PrivateLooks} from './private-looks.ts';
import {imageSchema,outfitSchema,parseOutfitText,rankForOutfit} from './outfit.ts';
import {LOCAL_MODEL,ProviderError,localModelStatus,prepareImage,runVision,testProvider} from './providers.ts';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer'}});
const providerSchema=z.enum(['qwen','openai','claude']);
const occasionSchema=z.enum(['GENERAL','GYM','DATE','WORK','PARTY','ERRANDS','CUSTOM']);
const modelSchema=z.string().trim().regex(/^[A-Za-z0-9._:-]{1,120}$/);
export async function handleAiApi(req:NextRequest,path:string[],body:unknown,user:User,db:Store,isActive=()=>!!db.user(user.id)){
 if(!['ai','outfit','vision','looks'].includes(path[0]))return null;
 const route=path.join('/');
 const verifySession=()=>{if(!isActive())throw new ProviderError('Session expired. Sign in again.',401);};
 try{
  verifySession();const key=installationKey(),vault=new CredentialVault(db.db,key),looks=new PrivateLooks(db,key),method=req.method;
  if(route==='ai/status'&&method==='GET'){
   const local=await localModelStatus();verifySession();return json({selected:vault.selected(user.id),connections:vault.metadata(user.id),local});
  }
  if(route==='ai/connection'&&method==='POST'){
   if(req.nextUrl.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(req.nextUrl.hostname))return json({error:'API key connections require HTTPS. Open the mobile preview on this computer or configure HTTPS.'},400);
   const d=z.object({provider:z.enum(['openai','claude']),key:z.string().trim().min(10).max(512).regex(/^[A-Za-z0-9_\-.]+$/),model:modelSchema.optional()}).strict().parse(body);
   vault.set(user.id,d.provider,d.key,d.model??DEFAULT_MODELS[d.provider]);d.key='';if(body&&typeof body==='object'&&'key' in body)body.key='';return json({ok:true});
  }
  if(route==='ai/provider'&&method==='PUT'){const d=z.object({provider:providerSchema}).strict().parse(body);vault.select(user.id,d.provider);return json({ok:true});}
  if(path.length===3&&path[0]==='ai'&&path[1]==='connection'&&method==='DELETE'){const provider=z.enum(['openai','claude']).parse(path[2]);vault.remove(user.id,provider);return json({ok:true});}
  if(route==='ai/test'&&method==='POST'){
   if(!db.limit('provider-test:'+user.id,10,60000))return json({error:'Connection test limit reached. Wait a minute.'},429);
   const d=z.object({provider:providerSchema}).strict().parse(body),connection=d.provider==='qwen'?null:vault.get(user.id,d.provider);
   if(d.provider!=='qwen'&&!connection)throw new ProviderError('Connect your own API key first.',409);
   await testProvider(d.provider,connection?.model??LOCAL_MODEL,connection?.key);verifySession();return json({ok:true});
  }
  if((route==='outfit/analyze'||route==='vision/bottle')&&method==='POST'){
   if(!db.limit('vision:'+user.id,8,60000))return json({error:'Analysis limit reached. Please wait a minute.'},429);
   const input=z.object({provider:providerSchema,text:z.string().trim().max(1800).optional(),image:imageSchema.optional(),archivePhoto:z.boolean().default(false)}).strict().refine(d=>!!d.text||!!d.image,'Add a photo or describe your outfit.').parse(body);
   if(route==='vision/bottle'&&input.archivePhoto)throw new ProviderError('Bottle photos cannot be archived.',400);
   const archiveConsent=db.archiveConsent(user.id);
   const provider=vault.selected(user.id);
   if(input.provider!==provider)throw new ProviderError('Provider changed. Review the selected connection before analyzing.',409);
   let image;
   try{
    image=input.image?await prepareImage(input.image):undefined;
    if(input.image)input.image.data='';
    if(body&&typeof body==='object'&&'image' in body&&body.image&&typeof body.image==='object'&&'data' in body.image)body.image.data='';
    verifySession();if(vault.selected(user.id)!==provider)throw new ProviderError('Provider changed. Review the selected connection before analyzing.',409);
    const connection=provider==='qwen'?null:vault.get(user.id,provider);
    if(provider!=='qwen'&&!connection)throw new ProviderError('Connect your own API key first.',409);
    const model=provider==='qwen'?LOCAL_MODEL:connection!.model;
    if(route==='vision/bottle'){
     if(!image)throw new ProviderError('Take or choose a bottle photo.',400);
     const result=await runVision(provider,model,connection?.key,'bottle',{image,text:'Read the exact visible fragrance label. Return only uncertain candidates.'});
     verifySession();return json({...result,provider,model});
    }
    let profile,method:'model'|'offline_rules'='model';
    try{profile=outfitSchema.parse(await runVision(provider,model,connection?.key,'outfit',{text:input.text,image}));}
    catch(error){verifySession();if(provider==='qwen'&&!image&&input.text){profile=parseOutfitText(input.text);method='offline_rules';}else throw error;}
    verifySession();
    const receipt:OutfitReceipt={id:randomUUID(),profile,provider,model:method==='model'?model:'offline-description-rules',method,createdAt:new Date().toISOString()};
    db.saveOutfit(user.id,receipt);
    const photoRetained=!!(image&&profile.hasOutfit&&looks.stagePhoto(user.id,receipt.id,image,input.archivePhoto,archiveConsent));
    return json({...receipt,photoRetained});
   }finally{
    if(image)image.data='';if(input.image)input.image.data='';
    if(body&&typeof body==='object'&&'image' in body&&body.image&&typeof body.image==='object'&&'data' in body.image)body.image.data='';
   }
  }
  if(route==='outfit/recommend'&&method==='POST'){
   const d=z.object({analysisId:z.string().uuid(),profile:outfitSchema,mode:z.enum(['solo','combo','both']),evidenceMode:z.enum(['evidence','single','experimental']).default('evidence'),occasion:occasionSchema}).strict().parse(body);
   if(!db.getOutfit(user.id,d.analysisId))return json({error:'Outfit analysis not found or expired. Analyze the outfit again.'},404);
   const state=db.state(user.id),context={...state.context,occasion:d.occasion};
   const result=rankForOutfit(state.bottles,context,state.preferences,d.profile,d.mode,d.evidenceMode,[],state.history.filter(h=>h.reaction==='disliked'&&h.bottleIds.length===2).map(h=>h.bottleIds));
   const offered=[...result.solo.map(r=>r.bottle),...result.combos.flatMap(r=>[r.a,r.b])];
   const choices=[...result.solo.map(r=>[r.bottle.id]),...result.combos.map(r=>[r.a.id,r.b.id])];
   const requestId=db.recordRecommendation(user.id,context,[...new Set(offered.map(b=>b.id))],state.preferences.archiveOutfits?{analysisId:d.analysisId,profile:d.profile,choices,variants:Object.fromEntries(offered.map(b=>[b.id,b.variantId]))}:undefined);
   return json({...result,requestId,context,outfit:d.profile});
  }
  if(route==='looks'&&method==='GET')return json(looks.list(user.id));
  if(route==='looks'&&method==='POST'){
   const d=z.object({requestId:z.string().uuid(),bottleIds:z.array(z.string().uuid()).min(1).max(2),confirmedAccurate:z.literal(true)}).strict().parse(body);
   return json(looks.save(user.id,d),201);
  }
  if(path.length===3&&path[0]==='looks'&&path[2]==='photo'&&method==='GET'){
   const photo=looks.photo(user.id,z.string().uuid().parse(path[1]));return photo?json(photo):json({error:'Photo not found.'},404);
  }
  if(path.length===2&&path[0]==='looks'&&method==='DELETE')return looks.remove(user.id,z.string().uuid().parse(path[1]))?json({ok:true}):json({error:'Look not found.'},404);
  return json({error:'Not found.'},404);
 }catch(error){
  if(error instanceof ProviderError)return json({error:error.message},error.status);
  if(error instanceof z.ZodError)return json({error:error.issues.map(i=>i.message).slice(0,2).join(' ')},400);
  if(error instanceof Error&&error.message==='Connect your own API key first.')return json({error:error.message},409);
  if(path[0]==='looks'&&error instanceof Error&&/^(Enable outfit|Confirm the outfit|Reviewed recommendation|Select a fragrance|The selected owned|Saved photo integrity)/.test(error.message))return json({error:error.message},error.message.startsWith('Saved photo')?503:400);
  throw error;
 }
}
