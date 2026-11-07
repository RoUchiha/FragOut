import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getStore} from '@/lib/store';
import {bottleSchema,settingsSchema,intentFields} from '@/lib/validation';
import {rankCombos,rankSolo,ENGINE_VERSION} from '@/lib/engine';
import {matchesBottleSearch,scentSearchLimit} from '@/lib/scent-search';
import type {Bottle} from '@/lib/types';
import {handleAiApi} from '@/lib/ai-api';
import {requestPolicy} from '@/lib/security';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const COOKIE='fragout_session';
const SECURE_COOKIE='__Host-fragout_session';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer'}});
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
    const db=getStore();db.pruneOutfits();
    const token=bearer??req.cookies.get(cookieName)?.value??'';const user=db.sessionUser(token);
    if(!user&&!authRoute)return reply({error:'Please sign in to continue.'},401);
    let body:unknown={};
    if(method==='POST'||method==='PUT'||method==='PATCH'){
      const max=['outfit','vision'].includes(path[0])?6*1024*1024:65536;
      if(Number(req.headers.get('content-length')??0)>max)return reply({error:'This request is too large.'},413);
      const reader=req.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
      if(reader)while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>max){await reader.cancel();return reply({error:'This request is too large.'},413);}chunks.push(item.value);}
      const encoded=Buffer.concat(chunks);
      try{body=JSON.parse(encoded.toString('utf8'));}catch{return reply({error:'Invalid JSON.'},400);}
      finally{encoded.fill(0);for(const chunk of chunks)chunk.fill(0);chunks.length=0;}
    }
    if(authRoute&&method==='POST'){
      const data=z.object({action:z.enum(['register','login','demo','logout']),client:z.literal('mobile').optional(),name:z.string().trim().min(1).max(60).optional(),email:z.email().max(254).optional(),password:z.string().max(256).optional()}).strict().parse(body);
      if(data.action==='logout'){db.revokeSession(data.client==='mobile'?bearer??'':token);const res=reply({ok:true});if(data.client!=='mobile')clearCookies(res);return res;}
      if(data.action!=='demo'&&(!data.email||!data.password||data.action==='register'&&(!data.name||data.password.length<12)))return reply({error:'Enter valid account details. Registration needs a name and a password of at least 12 characters.'},400);
      if(data.action!=='login'&&!db.limit('anonymous-account-creation',80,60000))return reply({error:'Too many new accounts. Please wait a minute.'},429);
      if(data.action==='demo'&&user&&(data.client!=='mobile'||bearer))return reply({...db.state(user.id),...(data.client==='mobile'?{sessionToken:token}:{})});
      if(data.email&&!db.limit(`auth-email:${data.email.toLowerCase()}`,12,60000))return reply({error:'Too many attempts for this account. Please wait.'},429);
      let signedIn;
      if(data.action==='demo')signedIn=db.createDemo();
      else {
        if(!data.email||!data.password)return reply({error:'Enter your email and password.'},400);
        if(data.action==='register'){if(!data.name)return reply({error:'Enter your name.'},400);signedIn=db.register(data.name,data.email,data.password);}
        else signedIn=db.login(data.email,data.password);
      }
      if(!signedIn)return reply({error:'Email or password is incorrect.'},401);
      if(token&&(data.client!=='mobile'||bearer))db.revokeSession(token);const sessionToken=db.createSession(signedIn.id);const res=reply({...db.state(signedIn.id),...(data.client==='mobile'?{sessionToken}:{})});
      if(data.client!=='mobile')res.cookies.set(cookieName,sessionToken,{httpOnly:true,sameSite:'lax',secure:policy.secureCookie,path:'/',maxAge:7*86400});return res;
    }
    if(!user)return reply({error:'Please sign in to continue.'},401);
    if(!db.limit('user:'+user.id,240,60000))return reply({error:'Please slow down and try again shortly.'},429);
    const aiResponse=await handleAiApi(req,path,body,user,db,()=>db.sessionUser(token)?.id===user.id);if(aiResponse)return aiResponse;
    if(path.length===1&&path[0]==='state'&&method==='GET')return reply(db.state(user.id));
    if(path[0]==='bottles'){
      if(method==='POST'&&path.length===1)return reply(db.addBottle(user.id,{...bottleSchema.parse(body),id:'',variantId:''} as Bottle),201);
      if(method==='PATCH'&&path.length===2&&path[1]){const b=db.updateBottle(user.id,path[1],bottleSchema.partial().parse(body));return b?reply(b):reply({error:'Bottle not found.'},404);}
      if(method==='DELETE'&&path.length===2&&path[1])return db.removeBottle(user.id,path[1])?reply({ok:true}):reply({error:'Bottle not found.'},404);
    }
    if(path.length===1&&path[0]==='settings'&&method==='PUT'){db.saveSettings(user.id,settingsSchema.parse(body));return reply(db.state(user.id));}
    if(path.length===1&&path[0]==='recommend'&&method==='POST'){
      const data=z.object({
        occasion:z.enum(['GENERAL','GYM','DATE','WORK','PARTY','ERRANDS','CUSTOM']),
        mode:z.enum(['solo','combo']),
        evidenceMode:z.enum(['evidence','single','experimental']).default('evidence'),
        shortcutId:z.string().max(100).optional(),
        search:z.string().trim().max(scentSearchLimit).optional(),
        ...intentFields,
      }).strict().parse(body);
      const s=db.state(user.id);const shortcut=data.shortcutId?s.shortcuts.find(c=>c.id===data.shortcutId):undefined;
      const context={...s.context,occasion:shortcut?.occasion??data.occasion,...(shortcut?{setting:shortcut.setting}:{}),mood:data.mood,vibe:data.vibe};
      const prefs={...s.preferences,maxStrength:Math.min(s.preferences.maxStrength,shortcut?.maxStrength??3)};
      const search = data.search;
      const matching = search ? new Set(s.bottles.filter(bottle => matchesBottleSearch(bottle,search)).map(bottle => bottle.id)) : null;
      const soloPool = matching ? s.bottles.filter(bottle => matching.has(bottle.id)) : s.bottles;
      const solo = data.mode==='solo' ? rankSolo(soloPool,context,prefs) : [];
      const rejectedPairs = s.history.filter(event => event.reaction==='disliked' && event.bottleIds.length===2).map(event => event.bottleIds);
      const combos = data.mode==='combo' ? rankCombos(s.bottles,context,prefs,data.evidenceMode,[],rejectedPairs,3,matching??undefined) : [];
      const requestId=db.recordRecommendation(user.id,context,[...new Set([...solo.map(r=>r.bottle.id),...combos.flatMap(r=>[r.a.id,r.b.id])])]);
      return reply({solo,combos,context,requestId,engine:ENGINE_VERSION});
    }
    if(path.length===1&&path[0]==='liked-combos'&&method==='PUT'){
      const data=z.object({
        bottleIds:z.array(z.string().max(100)).length(2),
        liked:z.boolean(),
        occasion:z.enum(['GENERAL','GYM','DATE','WORK','PARTY','ERRANDS','CUSTOM']).default('GENERAL'),
        requestId:z.string().uuid().optional(),
      }).strict().parse(body);
      db.setComboLike(user.id,data.bottleIds,data.liked,data.occasion,data.requestId);
      return reply({ok:true});
    }
    if(path.length===1&&path[0]==='feedback'&&method==='POST'){
      const data=z.object({bottleIds:z.array(z.string().max(100)).min(1).max(2),reaction:z.enum(['wore','loved','disliked','saved']),occasion:z.enum(['GENERAL','GYM','DATE','WORK','PARTY','ERRANDS','CUSTOM']),requestId:z.string().uuid().optional()}).strict().parse(body);
      return reply(db.feedback(user.id,data.bottleIds,data.reaction,data.occasion,data.requestId),201);
    }
    if(path.length===2&&path[0]==='feedback'&&path[1]&&method==='DELETE')return db.deleteEvent(user.id,path[1])?reply({ok:true}):reply({error:'Entry not found.'},404);
    if(path.length===1&&path[0]==='export'&&method==='GET')return new NextResponse(JSON.stringify({format:'fragout-export-v1',exportedAt:new Date().toISOString(),...db.exportState(user.id)},null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="fragout-export.json"','Cache-Control':'no-store','Vary':'Cookie, Authorization','Referrer-Policy':'no-referrer'}});
    if(path.length===1&&path[0]==='account'&&method==='DELETE'){db.deleteUser(user.id);return clearCookies(reply({ok:true}));}
    return reply({error:'Not found.'},404);
  }catch(error){
    if(error instanceof z.ZodError)return reply({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).slice(0,3).join('; ')},400);
    if(error instanceof Error&&/password|account|bottles you own|recommendation/.test(error.message))return reply({error:error.message},400);
    console.error('FragOut request failed',error instanceof Error?error.name:'UnknownError');return reply({error:'Something went wrong. Please try again.'},500);
  }
}
export const GET=handle,POST=handle,PUT=handle,PATCH=handle,DELETE=handle;
