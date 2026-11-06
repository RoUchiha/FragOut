import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {getStore} from '@/lib/store';
import {bottleSchema,settingsSchema} from '@/lib/validation';
import {rankCombos,rankSolo,ENGINE_VERSION} from '@/lib/engine';
import type {Bottle} from '@/lib/types';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const COOKIE='fragout_session';
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function handle(req:NextRequest){
  try{
    const db=getStore();const path=req.nextUrl.pathname.replace('/api/','').split('/');const method=req.method;
    if(method==='GET'&&path[0]==='health')return reply({status:'ok',engine:ENGINE_VERSION,weather:'manual',photoIdentification:'unavailable'});
    if(method!=='GET'){
      const origin=req.headers.get('origin');if(origin&&origin!==req.nextUrl.origin)return reply({error:'This request must come from FragOut.'},403);
      if(req.headers.get('sec-fetch-site')==='cross-site')return reply({error:'Cross-site requests are not accepted.'},403);
      if(method!=='DELETE'&&!req.headers.get('content-type')?.includes('application/json'))return reply({error:'Use a JSON request.'},415);
    }
    const token=req.cookies.get(COOKIE)?.value??'';const user=db.sessionUser(token);
    let body:unknown={};
    if(method==='POST'||method==='PUT'||method==='PATCH'){
      if(Number(req.headers.get('content-length')??0)>65536)return reply({error:'This request is too large.'},413);
      const raw=await req.text();if(Buffer.byteLength(raw)>65536)return reply({error:'This request is too large.'},413);
      try{body=JSON.parse(raw);}catch{return reply({error:'Invalid JSON.'},400);}
    }
    if(path[0]==='auth'&&method==='POST'){
      const data=z.object({action:z.enum(['register','login','demo','logout']),name:z.string().trim().min(1).max(60).optional(),email:z.email().max(254).optional(),password:z.string().max(256).optional()}).strict().parse(body);
      if(data.action==='logout'){db.revokeSession(token);const res=reply({ok:true});res.cookies.delete(COOKIE);return res;}
      if(!db.limit('auth-global',80,60000))return reply({error:'Too many attempts. Please wait a minute.'},429);
      if(data.action==='demo'&&user)return reply(db.state(user.id));
      if(data.email&&!db.limit(`auth-email:${data.email.toLowerCase()}`,12,60000))return reply({error:'Too many attempts for this account. Please wait.'},429);
      let signedIn;
      if(data.action==='demo')signedIn=db.createDemo();
      else {
        if(!data.email||!data.password)return reply({error:'Enter your email and password.'},400);
        if(data.action==='register'){if(!data.name)return reply({error:'Enter your name.'},400);signedIn=db.register(data.name,data.email,data.password);}
        else signedIn=db.login(data.email,data.password);
      }
      if(!signedIn)return reply({error:'Email or password is incorrect.'},401);
      if(token)db.revokeSession(token);const res=reply(db.state(signedIn.id));
      res.cookies.set(COOKIE,db.createSession(signedIn.id),{httpOnly:true,sameSite:'lax',secure:process.env.FRAGOUT_SECURE_COOKIES==='true',path:'/',maxAge:7*86400});return res;
    }
    if(!user)return reply({error:'Please sign in to continue.'},401);
    if(!db.limit('user:'+user.id,240,60000))return reply({error:'Please slow down and try again shortly.'},429);
    if(path[0]==='state'&&method==='GET')return reply(db.state(user.id));
    if(path[0]==='bottles'){
      if(method==='POST')return reply(db.addBottle(user.id,{...bottleSchema.parse(body),id:'',variantId:''} as Bottle),201);
      if(method==='PATCH'&&path[1]){const b=db.updateBottle(user.id,path[1],bottleSchema.partial().parse(body));return b?reply(b):reply({error:'Bottle not found.'},404);}
      if(method==='DELETE'&&path[1])return db.removeBottle(user.id,path[1])?reply({ok:true}):reply({error:'Bottle not found.'},404);
    }
    if(path[0]==='settings'&&method==='PUT'){db.saveSettings(user.id,settingsSchema.parse(body));return reply(db.state(user.id));}
    if(path[0]==='recommend'&&method==='POST'){
      const data=z.object({occasion:z.enum(['GENERAL','GYM','DATE','WORK','PARTY','ERRANDS','CUSTOM']),mode:z.enum(['solo','combo']),evidenceMode:z.enum(['evidence','single','experimental']).default('evidence'),shortcutId:z.string().max(100).optional()}).strict().parse(body);
      const s=db.state(user.id);const shortcut=data.shortcutId?s.shortcuts.find(c=>c.id===data.shortcutId):undefined;
      const context={...s.context,occasion:shortcut?.occasion??data.occasion,...(shortcut?{setting:shortcut.setting}:{})};
      const prefs={...s.preferences,maxStrength:Math.min(s.preferences.maxStrength,shortcut?.maxStrength??3)};
      const solo=data.mode==='solo'?rankSolo(s.bottles,context,prefs):[];
      const combos=data.mode==='combo'?rankCombos(s.bottles,context,prefs,data.evidenceMode,[],s.history.filter(h=>h.reaction==='disliked'&&h.bottleIds.length===2).map(h=>h.bottleIds)):[];
      const requestId=db.recordRecommendation(user.id,context,[...new Set([...solo.map(r=>r.bottle.id),...combos.flatMap(r=>[r.a.id,r.b.id])])]);
      return reply({solo,combos,context,requestId,engine:ENGINE_VERSION});
    }
    if(path[0]==='feedback'&&method==='POST'){
      const data=z.object({bottleIds:z.array(z.string().max(100)).min(1).max(2),reaction:z.enum(['wore','loved','disliked','saved']),occasion:z.enum(['GENERAL','GYM','DATE','WORK','PARTY','ERRANDS','CUSTOM']),requestId:z.string().uuid().optional()}).strict().parse(body);
      return reply(db.feedback(user.id,data.bottleIds,data.reaction,data.occasion,data.requestId),201);
    }
    if(path[0]==='feedback'&&path[1]&&method==='DELETE')return db.deleteEvent(user.id,path[1])?reply({ok:true}):reply({error:'Entry not found.'},404);
    if(path[0]==='export'&&method==='GET')return new NextResponse(JSON.stringify({format:'fragout-export-v1',exportedAt:new Date().toISOString(),...db.exportState(user.id)},null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="fragout-export.json"','Cache-Control':'no-store'}});
    if(path[0]==='account'&&method==='DELETE'){db.deleteUser(user.id);const res=reply({ok:true});res.cookies.delete(COOKIE);return res;}
    return reply({error:'Not found.'},404);
  }catch(error){
    if(error instanceof z.ZodError)return reply({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).slice(0,3).join('; ')},400);
    if(error instanceof Error&&/password|account|bottles you own|recommendation/.test(error.message))return reply({error:error.message},400);
    console.error('FragOut request failed',error instanceof Error?error.name:'UnknownError');return reply({error:'Something went wrong. Please try again.'},500);
  }
}
export const GET=handle,POST=handle,PUT=handle,PATCH=handle,DELETE=handle;
