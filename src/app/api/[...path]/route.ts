import {after,NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import sharp from 'sharp';
import {getStore,type Store} from '@/lib/store';
import {DatabaseUnavailable} from '@/lib/database';
import {bottleSchema,settingsSchema,intentFields} from '@/lib/validation';
import {rankCombos,rankSolo,ENGINE_VERSION} from '@/lib/engine';
import {matchesBottleSearch,scentSearchLimit} from '@/lib/scent-search';
import type {Bottle,BottleProfileReply,CatalogEdition} from '@/lib/types';
import {handleAiApi} from '@/lib/ai-api';
import {requestPolicy} from '@/lib/security';
import {findCatalogDupes,findCatalogProfile} from '@/lib/catalog';
import {catalogEditionById,findPublicCatalogEdition} from '@/lib/catalog-editions';
import {findAutomaticCatalogPhoto} from '@/lib/catalog-photo-selector';
import {lookupFragellaRatings} from '@/lib/fragella';
import {imageSchema,validateImage,type ImageInput} from '@/lib/outfit';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const COOKIE='fragout_session';
const SECURE_COOKIE='__Host-fragout_session';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer'}});
const signInRequired=()=>reply({error:'Please sign in to continue.'},401);
const catalogAdminRequired=()=>reply({error:'Catalog admin access required.'},403);
const storeValidationErrors=new Set([
  'Use a password with at least 12 characters.',
  'Unable to create this account. Try signing in or use another email.',
  'Choose one or two bottles you own.',
  'Choose two distinct bottles you own.',
  'This recommendation has expired. Please generate a new pick.',
  'Bottle does not belong to this recommendation.',
]);
const bottleProfile=(bottle:Bottle,profile:ReturnType<typeof findCatalogProfile>):BottleProfileReply=>({
  variantId:bottle.variantId,profile,dupes:findCatalogDupes(bottle,profile),
});
const photoEdit=z.object({id:z.string().min(1).max(180),action:z.enum(['replace','hide','reset','retry']),
  image:imageSchema.optional()}).strict().refine(edit=>(edit.action==='replace')===!!edit.image,'Choose a replacement image.');

function lookupPhoto(db:Store,userId:string,edition:CatalogEdition|null,force=false,canLookup?:()=>Promise<boolean>) {
  return db.catalogPhotos.ensure(edition,findAutomaticCatalogPhoto,async()=>
    await db.limit('catalog-image-user:'+userId,6,60000)&&
    await db.limit('catalog-image-installation',18,60000)&&(!canLookup||await canLookup()),force);
}

function schedulePhoto(db:Store,userId:string,bottle:Bottle) {
  const base=findCatalogProfile(bottle);
  if(base?.photo) return;
  const edition=findPublicCatalogEdition(bottle,base);
  if(edition) after(()=>lookupPhoto(db,userId,edition));
}

async function normalizeAdminPhoto(input:ImageInput) {
  let bytes:Buffer|undefined;
  try {
    bytes=validateImage(input);
    const image=sharp(bytes,{limitInputPixels:24_000_000,failOn:'error'});
    const metadata=await image.metadata();
    if((metadata.pages??1)!==1||!metadata.width||!metadata.height||Math.min(metadata.width,metadata.height)<120) return null;
    const jpeg=await image.rotate().resize({width:900,height:900,fit:'inside',withoutEnlargement:true})
      .flatten({background:'#fff'}).jpeg({quality:82}).toBuffer();
    return jpeg.length<=650_000?jpeg:null;
  } catch { return null; }
  finally {bytes?.fill(0);}
}

async function handle(req:NextRequest){
  try{
    const policy=requestPolicy(req.nextUrl,req.headers);if(policy.status!==200)return reply({error:policy.error},policy.status);
    const cookieName=policy.secureCookie?SECURE_COOKIE:COOKIE;
    const clearCookies=(res:NextResponse)=>{res.cookies.delete(COOKIE);res.cookies.set(SECURE_COOKIE,'',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});return res;};
    const path=req.nextUrl.pathname.replace('/api/','').split('/'),method=req.method,authRoute=path.length===1&&path[0]==='auth';
    if(method==='GET'&&path.length===1&&path[0]==='health')return reply({status:'ok',engine:ENGINE_VERSION,weather:'manual',photoIdentification:'provider-selectable',outfit:'enabled'});
    if(method!=='GET'){
      const origin=req.headers.get('origin');if(origin&&origin!==policy.origin)return reply({error:'This request must come from FragOut.'},403);
      if(req.headers.get('sec-fetch-site')==='cross-site')return reply({error:'Cross-site requests are not accepted.'},403);
      if(method!=='DELETE'&&req.headers.get('content-type')?.split(';')[0].trim().toLowerCase()!=='application/json')return reply({error:'Use a JSON request.'},415);
      if(!origin&&req.cookies.get(cookieName)&&!req.headers.get('authorization'))return reply({error:'Cookie changes require a same-origin request.'},403);
    }
    const authorization=req.headers.get('authorization'),bearer=authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    if(authorization!==null&&!bearer)return reply({error:'Invalid authentication header.'},401);
    const db=getStore();
    if(method==='GET'&&path.length===2&&path[0]==='catalog-image'){
      const image=await db.catalogPhotos.asset(path[1]);
      if(!image)return reply({error:'Photo not found.'},404);
      return new NextResponse(new Uint8Array(image),{headers:{'Content-Type':'image/jpeg','Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Referrer-Policy':'no-referrer'}});
    }
    const token=bearer??req.cookies.get(cookieName)?.value??'';
    const user=await db.sessionUser(token);
    if(!user&&!authRoute)return signInRequired();
    const isActive=async(store:Store=db,lock=false)=>!!user&&(await store.sessionUser(token,lock))?.id===user.id;
    const privateReply=async(data:unknown,status=200)=>await isActive()?reply(data,status):signInRequired();
    const adminRoute=path[0]==='catalog-admin';
    const isCatalogAdmin=async()=>!!user&&await db.catalogPhotos.isAdmin(user.id)&&await isActive();
    if(adminRoute&&!await isCatalogAdmin())return catalogAdminRequired();
    let body:unknown={};
    if(method==='POST'||method==='PUT'||method==='PATCH'){
      const max=(['outfit','vision'].includes(path[0])||adminRoute&&path[1]==='photo')?6*1024*1024:65536;
      if(Number(req.headers.get('content-length')??0)>max)return reply({error:'This request is too large.'},413);
      const reader=req.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
      if(reader)while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>max){await reader.cancel();return reply({error:'This request is too large.'},413);}chunks.push(item.value);}
      const encoded=Buffer.concat(chunks);
      try{body=JSON.parse(encoded.toString('utf8'));}catch{return reply({error:'Invalid JSON.'},400);}
      finally{encoded.fill(0);for(const chunk of chunks)chunk.fill(0);chunks.length=0;}
    }
    if(authRoute&&method==='POST'){
      const data=z.object({action:z.enum(['register','login','demo','logout']),client:z.literal('mobile').optional(),name:z.string().trim().min(1).max(60).optional(),email:z.email().max(254).optional(),password:z.string().max(256).optional()}).strict().parse(body);
      if(data.action==='logout'){await db.revokeSession(data.client==='mobile'?bearer??'':token);const res=reply({ok:true});if(data.client!=='mobile')clearCookies(res);return res;}
      if(data.action!=='demo'&&(!data.email||!data.password||data.action==='register'&&(!data.name||data.password.length<12)))return reply({error:'Enter valid account details. Registration needs a name and a password of at least 12 characters.'},400);
      if(data.action!=='login'&&!await db.limit('anonymous-account-creation',80,60000))return reply({error:'Too many new accounts. Please wait a minute.'},429);
      if(data.action==='demo'&&user&&(data.client!=='mobile'||bearer)){
        if(!await isActive())return signInRequired();
        const state=await db.state(user.id);
        return await privateReply({...state,...(data.client==='mobile'?{sessionToken:token}:{})});
      }
      if(data.email&&!await db.limit(`auth-email:${data.email.toLowerCase()}`,12,60000))return reply({error:'Too many attempts for this account. Please wait.'},429);
      let signedIn;
      if(data.action==='demo')signedIn=await db.createDemo();
      else {
        if(!data.email||!data.password)return reply({error:'Enter your email and password.'},400);
        if(data.action==='register'){if(!data.name)return reply({error:'Enter your name.'},400);signedIn=await db.register(data.name,data.email,data.password);}
        else signedIn=await db.login(data.email,data.password);
      }
      if(!signedIn)return reply({error:'Email or password is incorrect.'},401);
      if(token&&(data.client!=='mobile'||bearer))await db.revokeSession(token);
      const sessionToken=await db.createSession(signedIn.id);
      const state=await db.state(signedIn.id);
      const res=reply({...state,...(data.client==='mobile'?{sessionToken}:{})});
      if(data.client!=='mobile')res.cookies.set(cookieName,sessionToken,{httpOnly:true,sameSite:'lax',secure:policy.secureCookie,path:'/',maxAge:7*86400});return res;
    }
    if(!user)return signInRequired();
    if(!await db.limit('user:'+user.id,240,60000))return reply({error:'Please slow down and try again shortly.'},429);
    if(adminRoute){
      if(!await isCatalogAdmin())return catalogAdminRequired();
      if(method==='POST'&&path.length===2&&path[1]==='search'){
        const {q}=z.object({q:z.string().trim().max(160)}).strict().parse(body);
        const entries=await db.catalogPhotos.search(q);
        return await isCatalogAdmin()?reply({entries}):catalogAdminRequired();
      }
      if(method==='PUT'&&path.length===2&&path[1]==='photo'){
        if(!await db.limit('catalog-photo-edit:'+user.id,24,60000))return reply({error:'Please slow down and try again shortly.'},429);
        const {id,action,image}=photoEdit.parse(body);
        const edition=catalogEditionById(id);
        if(!edition)return reply({error:'Catalog edition not found.'},404);
        const jpeg=image?await normalizeAdminPhoto(image):null;
        if(image&&!jpeg)return reply({error:'Choose a readable JPG, PNG or WebP at least 120 pixels on each side.'},400);
        if(!await isCatalogAdmin())return catalogAdminRequired();
        if(action==='replace'||action==='hide')await db.catalogPhotos.setOverride(edition,jpeg);
        else if(action==='reset')await db.catalogPhotos.reset(edition);
        else await lookupPhoto(db,user.id,edition,true,isCatalogAdmin);
        const entry=await db.catalogPhotos.entry(edition);
        return await isCatalogAdmin()?reply({entry}):catalogAdminRequired();
      }
      return reply({error:'Not found.'},404);
    }
    const aiResponse=await handleAiApi(req,path,body,user,db,isActive,scoped=>isActive(scoped,true));
    if(aiResponse)return aiResponse;
    if(!await isActive())return signInRequired();
    if(path.length===1&&path[0]==='state'&&method==='GET')return await privateReply(await db.state(user.id));
    if(path[0]==='bottles'){
      if(method==='POST'&&path.length===1){
        const saved=await db.addBottle(user.id,{...bottleSchema.parse(body),id:'',variantId:''} as Bottle);
        schedulePhoto(db,user.id,saved);
        return await privateReply(saved,201);
      }
      if(method==='GET'&&path.length===3&&path[1]&&path[2]==='profile'){
        const bottle=await db.getBottle(user.id,path[1]);
        if(!bottle)return reply({error:'Bottle not found.'},404);
        const base=findCatalogProfile(bottle);
        const edition=findPublicCatalogEdition(bottle,base);
        const key=process.env.FRAGOUT_FRAGELLA_API_KEY?.trim();
        const [live]=await Promise.all([
          base?.releaseYear&&key&&!user.demo?lookupFragellaRatings(base,key,async()=>
            await db.limit('fragella-user:'+user.id,4,60000)&&
            await db.limit('fragella-installation',20,60000)&&await isActive()):null,
          lookupPhoto(db,user.id,edition,false,isActive),
        ]);
        if(!await isActive())return signInRequired();
        const current=await db.getBottle(user.id,bottle.id);
        if(!current)return reply({error:'Bottle not found.'},404);
        const profile=await db.catalogPhotos.profile(current);
        if(current.variantId!==bottle.variantId||!profile||!live)return await privateReply(bottleProfile(current,profile));
        const liveRatings=live.ratings.filter(rating=>rating.kind==='published'||!profile.ratings.some(existing=>existing.facet===rating.facet));
        return await privateReply(bottleProfile(current,liveRatings.length?{
          ...profile,ratings:[...liveRatings,...profile.ratings],sources:[...profile.sources,live.source],
        }:profile));
      }
      if(method==='PATCH'&&path.length===2&&path[1]){
        const b=await db.updateBottle(user.id,path[1],bottleSchema.partial().parse(body));
        if(!b)return reply({error:'Bottle not found.'},404);
        schedulePhoto(db,user.id,b);
        return await privateReply(b);
      }
      if(method==='DELETE'&&path.length===2&&path[1])return await db.removeBottle(user.id,path[1])?reply({ok:true}):reply({error:'Bottle not found.'},404);
    }
    if(path.length===1&&path[0]==='settings'&&method==='PUT'){await db.saveSettings(user.id,settingsSchema.parse(body));return await privateReply(await db.state(user.id));}
    if(path.length===1&&path[0]==='recommend'&&method==='POST'){
      const data=z.object({
        occasion:z.enum(['GENERAL','GYM','DATE','WORK','PARTY','ERRANDS','CUSTOM']),
        mode:z.enum(['solo','combo']),
        evidenceMode:z.enum(['evidence','single','experimental']).default('evidence'),
        shortcutId:z.string().max(100).optional(),
        search:z.string().trim().max(scentSearchLimit).optional(),
        ...intentFields,
      }).strict().parse(body);
      const s=await db.state(user.id);const shortcut=data.shortcutId?s.shortcuts.find(c=>c.id===data.shortcutId):undefined;
      const context={...s.context,occasion:shortcut?.occasion??data.occasion,...(shortcut?{setting:shortcut.setting}:{}),mood:data.mood,vibe:data.vibe};
      const prefs={...s.preferences,maxStrength:Math.min(s.preferences.maxStrength,shortcut?.maxStrength??3)};
      const search = data.search;
      const matching = search ? new Set(s.bottles.filter(bottle => matchesBottleSearch(bottle,search)).map(bottle => bottle.id)) : null;
      const soloPool = matching ? s.bottles.filter(bottle => matching.has(bottle.id)) : s.bottles;
      const solo = data.mode==='solo' ? rankSolo(soloPool,context,prefs) : [];
      const rejectedPairs = s.history.filter(event => event.reaction==='disliked' && event.bottleIds.length===2).map(event => event.bottleIds);
      const combos = data.mode==='combo' ? rankCombos(s.bottles,context,prefs,data.evidenceMode,[],rejectedPairs,3,matching??undefined) : [];
      if(!await isActive())return signInRequired();
      const requestId=await db.recordRecommendation(user.id,context,[...new Set([...solo.map(r=>r.bottle.id),...combos.flatMap(r=>[r.a.id,r.b.id])])]);
      return await privateReply({solo,combos,context,requestId,engine:ENGINE_VERSION});
    }
    if(path.length===1&&path[0]==='liked-combos'&&method==='PUT'){
      const data=z.object({
        bottleIds:z.array(z.string().max(100)).length(2),
        liked:z.boolean(),
        occasion:z.enum(['GENERAL','GYM','DATE','WORK','PARTY','ERRANDS','CUSTOM']).default('GENERAL'),
        requestId:z.string().uuid().optional(),
      }).strict().parse(body);
      await db.setComboLike(user.id,data.bottleIds,data.liked,data.occasion,data.requestId);
      return reply({ok:true});
    }
    if(path.length===1&&path[0]==='feedback'&&method==='POST'){
      const data=z.object({bottleIds:z.array(z.string().max(100)).min(1).max(2),reaction:z.enum(['wore','loved','disliked','saved']),occasion:z.enum(['GENERAL','GYM','DATE','WORK','PARTY','ERRANDS','CUSTOM']),requestId:z.string().uuid().optional()}).strict().parse(body);
      return await privateReply(await db.feedback(user.id,data.bottleIds,data.reaction,data.occasion,data.requestId),201);
    }
    if(path.length===2&&path[0]==='feedback'&&path[1]&&method==='DELETE')return await db.deleteEvent(user.id,path[1])?reply({ok:true}):reply({error:'Entry not found.'},404);
    if(path.length===1&&path[0]==='export'&&method==='GET'){
      const exported=await db.exportState(user.id);
      if(!await isActive())return signInRequired();
      return new NextResponse(JSON.stringify({format:'fragout-export-v1',exportedAt:new Date().toISOString(),...exported},null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="fragout-export.json"','Cache-Control':'no-store','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer'}});
    }
    if(path.length===1&&path[0]==='account'&&method==='DELETE'){await db.deleteUser(user.id);return clearCookies(reply({ok:true}));}
    return reply({error:'Not found.'},404);
  }catch(error){
    if(error instanceof DatabaseUnavailable)return reply({error:'Storage is temporarily unavailable. Try again shortly.'},503);
    if(error instanceof z.ZodError)return reply({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).slice(0,3).join('; ')},400);
    if(error instanceof Error&&error.message==='Account not found.')return signInRequired();
    if(error instanceof Error&&storeValidationErrors.has(error.message))return reply({error:error.message},400);
    console.error('FragOut request failed',error instanceof Error?error.name:'UnknownError');return reply({error:'Something went wrong. Please try again.'},500);
  }
}
export const GET=handle,POST=handle,PUT=handle,PATCH=handle,DELETE=handle;
