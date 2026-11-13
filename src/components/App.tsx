'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,BookOpen,Check,Download,FlaskConical,Home,Layers,Shuffle,Info,LogOut,Menu,Settings2,Shirt,Trash2,UserRound,X} from 'lucide-react';
import {BrandMark,Modal} from './Primitives';
import {BottleForm,ContextForm,PreferencesForm,ShortcutsForm} from './Forms';
import {Collection,Dashboard,Journal,Layering,Learn,SoloResults,occasionName,type View} from './Screens';
import {defaultIntent,intentSummary} from '@/lib/intent';
import type {AppState,Bottle,ComboResult,ScentIntent,SoloResult,WearContext} from '@/lib/types';

type Dialog={kind:'add'}|{kind:'edit';bottle:Bottle}|{kind:'context'}|{kind:'preferences'}|{kind:'shortcuts'}|{kind:'solo';opener:HTMLElement|null}|{kind:'why';result:SoloResult}|{kind:'auth'}|{kind:'delete'}|null;
async function request<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const response=await fetch('/api/'+path,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
 const data=await response.json();if(!response.ok)throw new Error(data.error??'Unable to complete this request.');return data as T;
}
const navigation=[['home','Today',Home],['collection','Collection',Shirt],['layering','Layering',FlaskConical],['journal','Journal',BookOpen],['learn','Guide',BookOpen]] as const;
export default function App({accountDeletion}:{accountDeletion:boolean}){
 const [state,setState]=useState<AppState|null>(null),[view,setView]=useState<View>(accountDeletion?'profile':'home'),[dialog,setDialog]=useState<Dialog>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[toast,setToast]=useState(''),[mobileMenu,setMobileMenu]=useState(false);
 const [solo,setSolo]=useState<SoloResult[]>([]),[soloOccasion,setSoloOccasion]=useState('GENERAL'),[soloContext,setSoloContext]=useState<WearContext|null>(null),[combos,setCombos]=useState<ComboResult[]|null>(null);
 const [soloRequestId,setSoloRequestId]=useState<string|undefined>(),[comboRequestId,setComboRequestId]=useState<string|undefined>();
 const [intent,setIntent]=useState<ScentIntent>(defaultIntent),intentRevision=useRef(0);
 const initialized=useRef(false);const close=useCallback(()=>setDialog(null),[]);
 const initialize=useCallback(async()=>{setError('');try{const response=await fetch('/api/state');if(response.status===401){setState(await request<AppState>('auth','POST',{action:'demo'}));}else {const data=await response.json();if(!response.ok)throw new Error(data.error);setState(data);}}catch(e){setError(e instanceof Error?e.message:'Unable to open FragOut.');}},[]);
 useEffect(()=>{if(!initialized.current){initialized.current=true;void initialize();}},[initialize]);
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(timer);},[toast]);
 const notifyError=(e:unknown)=>setToast(e instanceof Error?e.message:'Something went wrong. Please try again.');
 const navigate=(v:View)=>{if(v!==view){intentRevision.current++;setCombos(null);setComboRequestId(undefined);}setView(v);setMobileMenu(false);window.scrollTo({top:0,behavior:'instant'});};
 const changeIntent=(value:ScentIntent)=>{if(value.mood===intent.mood&&value.vibe===intent.vibe)return;intentRevision.current++;setIntent(value);setCombos(null);setComboRequestId(undefined);};
 const clearPersonalState=()=>{intentRevision.current++;setIntent(defaultIntent);setSolo([]);setSoloOccasion('GENERAL');setSoloContext(null);setSoloRequestId(undefined);setComboRequestId(undefined);setCombos(null);setDialog(null);};
 async function mutate(path:string,method:string,data?:unknown,message='Saved.'){setBusy(true);try{await request(path,method,data);setState(await request<AppState>('state'));if(message)setToast(message);setCombos(null);return true;}catch(e){notifyError(e);return false;}finally{setBusy(false);}}
 function requestPicks(occasion:string,shortcutId?:string){return request<{solo:SoloResult[];context:WearContext;requestId:string}>('recommend','POST',{occasion,mode:'solo',shortcutId,...intent});}
 async function recommend(occasion=state?.context.occasion??'GENERAL',shortcutId?:string){
  const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const revision=intentRevision.current;
  setBusy(true);
  try{
   const data=await requestPicks(occasion,shortcutId);
   if(revision!==intentRevision.current)return;
   setSolo(data.solo);setSoloOccasion(data.context.occasion);setSoloContext(data.context);
   setSoloRequestId(data.requestId);setDialog({kind:'solo',opener});
  }catch(error){if(revision===intentRevision.current)notifyError(error);}
  finally{setBusy(false);}
 }
 async function generate(occasion:string,evidenceMode:string,isCurrent:()=>boolean){setBusy(true);setCombos(null);setComboRequestId(undefined);const revision=intentRevision.current;try{const data=await request<{combos:ComboResult[];requestId:string}>('recommend','POST',{occasion,mode:'combo',evidenceMode,...intent});if(revision!==intentRevision.current||!isCurrent())return;setCombos(data.combos);setComboRequestId(data.requestId);}catch(e){if(revision===intentRevision.current&&isCurrent())notifyError(e);}finally{setBusy(false);}}
 async function feedback(ids:string[],reaction:'wore'|'loved'|'disliked'|'saved',occasion='GENERAL',requestId?:string){const ok=await mutate('feedback','POST',{bottleIds:ids,reaction,occasion,requestId},reaction==='saved'?'Pair saved.':reaction==='disliked'?(ids.length===2?'Pair excluded from future suggestions.':'Preference saved.'):'Logged.');if(ok&&reaction==='wore')setDialog(null);}
 async function wearPick(bottleId:string){setBusy(true);const revision=intentRevision.current;try{const picks=await requestPicks(state?.context.occasion??'GENERAL');if(revision!==intentRevision.current)return;if(!picks.solo.some(r=>r.bottle.id===bottleId))throw new Error('Your picks changed. Open Recommend to choose again.');await feedback([bottleId],'wore',picks.context.occasion,picks.requestId);}catch(e){if(revision===intentRevision.current)notifyError(e);}finally{setBusy(false);}}
 async function auth(action:string,data?:Record<string,string>){setBusy(true);try{const next=await request<AppState>('auth','POST',{action,...data});clearPersonalState();setState(next);navigate(accountDeletion?'profile':'home');setToast(action==='register'?'Account created.':'Welcome back.');return true;}catch(e){notifyError(e);return false;}finally{setBusy(false);}}
 async function returnToDemo(message:string){clearPersonalState();setState(null);navigate('home');setError('');try{setState(await request<AppState>('auth','POST',{action:'demo'}));setToast(message);}catch{setError(message+' The demo is unavailable. Try again.');}}
 async function logout(){setBusy(true);try{await request('auth','POST',{action:'logout'});await returnToDemo('Signed out.');}catch(e){notifyError(e);}finally{setBusy(false);}}
 if(!state)return <main className="boot-screen"><div className="brand"><BrandMark/><span>FragOut<span className="logo-period">.</span></span></div>{error?<><p role="alert">{error}</p><button className="button primary" onClick={()=>void initialize()}>Try again<ArrowRight size={17}/></button></>:<><span className="loading-orbit"/><p>Loading…</p></>}</main>;
 const common={state,navigate,add:()=>setDialog({kind:'add'}),edit:(bottle:Bottle)=>setDialog({kind:'edit',bottle}),recommend:(o?:string,id?:string)=>void recommend(o,id),feedback:(ids:string[],r:'wore'|'loved'|'disliked'|'saved',o?:string)=>void feedback(ids,r,o),favorite:(b:Bottle)=>void mutate('bottles/'+b.id,'PATCH',{favorite:!b.favorite},b.favorite?'Removed from favorites.':'Added to favorites.'),busy};
 const titles:Record<View,string>={home:'Today',collection:'Collection',layering:'Layering',journal:'Journal',learn:'Guide',profile:'Settings'};
 return <div className="app-shell"><a className="skip-link" href="#main">Skip to content</a><aside className={'sidebar '+(mobileMenu?'mobile-open':'')}><button className="brand brand-button" onClick={()=>navigate('home')} aria-label="FragOut home"><BrandMark/><span>FragOut<span className="logo-period">.</span></span></button><button className="mobile-close icon-button" aria-label="Close navigation" onClick={()=>setMobileMenu(false)}><X size={22}/></button><nav aria-label="Main navigation">{navigation.map(([v,label,Icon])=><button className={'nav-item '+(view===v?'active':'')} key={v} aria-current={view===v?'page':undefined} onClick={()=>navigate(v)}><Icon size={19} strokeWidth={1.6}/><span>{label}</span>{v==='collection'&&<span className="nav-count">{state.bottles.filter(b=>b.ownership==='OWNED').length}</span>}</button>)}</nav><div className="sidebar-bottom"><button className={'nav-item '+(view==='profile'?'active':'')} onClick={()=>navigate('profile')}><Settings2 size={19} strokeWidth={1.6}/>Settings</button><button className="sidebar-user" onClick={()=>state.user.demo?setDialog({kind:'auth'}):navigate('profile')}><span className="avatar">{state.user.demo?<UserRound size={18}/>:state.user.name[0].toUpperCase()}</span><span><strong>{state.user.name}</strong><small>{state.user.demo?'Demo':'Local account'}</small></span><ArrowUpRight size={16}/></button></div></aside>{mobileMenu&&<button className="nav-overlay" aria-label="Close navigation" onClick={()=>setMobileMenu(false)}/>}
 <div className="main-shell"><header className="topbar"><div><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={()=>setMobileMenu(true)}><Menu size={22}/></button><span className="mobile-brand-name">FragOut.</span><span className="breadcrumb">{titles[view]}</span></div><div className="topbar-actions"><a className="quick-action mobile-app-link" href="/mobile">Mobile app</a><button className="quick-action" disabled={busy} onClick={()=>void recommend()}><Shuffle size={14}/><span>Recommend</span></button><button className="quick-action" onClick={()=>navigate('layering')}><Layers size={14}/><span>Combo</span></button><button className="topbar-avatar" aria-label="Open profile" onClick={()=>navigate('profile')}>{state.user.demo?<UserRound size={17}/>:state.user.name[0].toUpperCase()}</button></div></header>
 {state.user.demo&&<div className="demo-bar"><span><span className="demo-label">Demo</span><span>Fictional fragrances</span></span><button onClick={()=>setDialog({kind:'auth'})}>{accountDeletion?'Sign in':'Create account'}<ArrowUpRight size={13}/></button></div>}
 <main id="main" className="main-content" tabIndex={-1}>{view==='home'&&<Dashboard {...common} intent={intent} onIntentChange={changeIntent} onWearPick={id=>void wearPick(id)} context={()=>setDialog({kind:'context'})} shortcuts={()=>setDialog({kind:'shortcuts'})} why={result=>setDialog({kind:'why',result})}/>} {view==='collection'&&<Collection {...common}/>} {view==='layering'&&<Layering state={state} busy={busy} intent={intent} onIntentChange={changeIntent} generate={(o,m,current)=>void generate(o,m,current)} results={combos} feedback={(ids,r,o)=>void feedback(ids,r,o??'GENERAL',comboRequestId)}/>} {view==='journal'&&<Journal state={state} busy={busy} remove={id=>void mutate('feedback/'+id,'DELETE',undefined,'Journal entry deleted.')}/>} {view==='learn'&&<Learn/>}
 {view==='profile'&&<>
  <div className="page-heading"><h1>Settings</h1></div>
  <section className="profile-card"><span className="profile-avatar">{state.user.name[0].toUpperCase()}</span><div><h2>{state.user.name}</h2><p className="muted">{state.user.email??'Demo session'}</p></div>{state.user.demo?<button className="button primary" onClick={()=>setDialog({kind:'auth'})}>{accountDeletion?'Sign in':'Create account'}</button>:<button className="button secondary" disabled={busy} onClick={()=>void logout()}><LogOut size={15}/>Sign out</button>}</section>
  <div className="settings-grid">{[['Preferences','preferences'],['Shortcuts','shortcuts'],['Conditions','context']].map(([title,kind])=><button className="settings-card" key={kind} onClick={()=>setDialog({kind} as Dialog)}><span>{title}</span><ArrowRight size={16}/></button>)}</div>
  <section className="privacy-panel">
   <h2>Your data</h2>
   <p>Stored on the FragOut server you use.</p>
   <div className="privacy-actions">
    {accountDeletion&&state.user.demo?<button className="button primary" onClick={()=>setDialog({kind:'auth'})}>Sign in to delete account</button>:<>
     <a className="button secondary" href="/api/export" download><Download size={15}/>Export</a>
     <button className="button danger-text" onClick={()=>setDialog({kind:'delete'})}><Trash2 size={15}/>Delete account</button>
    </>}
    <a className="text-button policy-link" href="/privacy">Privacy policy</a>
   </div>
  </section>
  <details className="integration-status"><summary>Connections</summary><div>Accounts & collection<strong>Local</strong></div><div>Recommendations<strong>Profile + outfit</strong></div><div>Weather<strong>Manual</strong></div><div>Photo identification<strong>In mobile app</strong></div><div>Catalog & pair evidence<strong>Not connected</strong></div></details>
 </>}
 </main></div>
 <nav className="bottom-nav" aria-label="Mobile navigation">{navigation.slice(0,4).map(([v,label,Icon])=><button key={v} className={view===v?'active':''} aria-label={label} onClick={()=>navigate(v)}><Icon size={21}/><span>{v==='home'?'Home':v==='collection'?'Collection':v==='layering'?'Layering':'Journal'}</span></button>)}<button className={view==='profile'?'active':''} onClick={()=>navigate('profile')} aria-label="Profile"><UserRound size={21}/><span>You</span></button></nav>
 {toast&&<div className="toast" role="status"><Info size={18}/><span>{toast}</span><button aria-label="Dismiss message" onClick={()=>setToast('')}><X size={17}/></button></div>}
 {dialog&&<Modal title={dialog.kind==='add'?'Add fragrance':dialog.kind==='edit'?dialog.bottle.name:dialog.kind==='context'?'Conditions':dialog.kind==='preferences'?'Preferences':dialog.kind==='shortcuts'?'Shortcuts':dialog.kind==='solo'?`Picks · ${(soloContext&&intentSummary(soloContext))||occasionName(soloOccasion)}`:dialog.kind==='why'?'Why this?':dialog.kind==='auth'?'Account':'Delete your account'} wide={['solo','shortcuts','add','edit'].includes(dialog.kind)} onClose={close} opener={dialog.kind==='solo'?dialog.opener:undefined}>
  {(dialog.kind==='add'||dialog.kind==='edit')&&<BottleForm key={dialog.kind==='edit'?dialog.bottle.id:'new'} bottle={dialog.kind==='edit'?dialog.bottle:undefined} busy={busy} onSave={async data=>{if(await mutate(dialog.kind==='edit'?'bottles/'+dialog.bottle.id:'bottles',dialog.kind==='edit'?'PATCH':'POST',data,'Saved.')){close();}}} onDelete={dialog.kind==='edit'?()=>{void mutate('bottles/'+dialog.bottle.id,'DELETE',undefined,'Bottle removed from collection.').then(ok=>{if(ok)close();});}:undefined}/>}
  {dialog.kind==='context'&&<ContextForm context={state.context} busy={busy} onSave={async context=>{if(await mutate('settings','PUT',{context},'Wearing conditions updated.'))close();}}/>}
  {dialog.kind==='preferences'&&<PreferencesForm preferences={state.preferences} busy={busy} onSave={async preferences=>{if(await mutate('settings','PUT',{preferences},'Scent preferences saved.'))close();}}/>}
  {dialog.kind==='shortcuts'&&<ShortcutsForm shortcuts={state.shortcuts} busy={busy} onSave={async shortcuts=>{if(await mutate('settings','PUT',{shortcuts},'Shortcuts saved.'))close();}}/>}
  {dialog.kind==='solo'&&<SoloResults results={solo} state={{...state,context:soloContext??state.context}} feedback={(ids,r)=>void feedback(ids,r,soloOccasion,soloRequestId)} why={result=>setDialog({kind:'why',result})} busy={busy}/>}
  {dialog.kind==='why'&&<div className="why-content"><span className="badge">{dialog.result.confidence}</span><h3>{dialog.result.bottle.name}</h3><p className="muted tiny">{dialog.result.bottle.brand} · {dialog.result.bottle.concentration}</p>{dialog.result.reasons.map(r=><div className="reason-row" key={r.ruleId}><Check size={17}/><div><p>{r.text}</p></div></div>)}<p className="muted tiny">{dialog.result.caution}</p><div className="form-note"><Info size={17}/><span>{dialog.result.bottle.provenance==='demo'?'Fictional demo profile.':dialog.result.bottle.provenance==='catalog'?'Sourced FragDex notes.':'Based on your observations.'} Fit is subjective.</span></div>{dialog.result.bottle.catalogSource&&<a className="text-button" href={dialog.result.bottle.catalogSource.url} target="_blank" rel="noreferrer">Notes source · {dialog.result.bottle.catalogSource.label}<ArrowUpRight size={14}/></a>}<button className="text-button" onClick={()=>void recommend('GENERAL')}><ArrowLeft size={15}/>All picks</button></div>}
  {dialog.kind==='auth'&&<AuthForm onAuth={auth} busy={busy} signInOnly={accountDeletion}/>}
  {dialog.kind==='delete'&&<DeleteForm busy={busy} onDelete={async()=>{setBusy(true);try{await request('account','DELETE');await returnToDemo('Your account and active data were deleted.');}catch(e){notifyError(e);}finally{setBusy(false);}}}/>}
 </Modal>}
 </div>;
}
function AuthForm({onAuth,busy,signInOnly}:{onAuth:(action:string,data:Record<string,string>)=>Promise<boolean>;busy:boolean;signInOnly:boolean}){
 const [mode,setMode]=useState<'register'|'login'>(signInOnly?'login':'register');const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState('');
 async function submit(e:FormEvent){e.preventDefault();await onAuth(mode,{...(mode==='register'?{name}:{}),email,password});}
 return <form className="form-stack" onSubmit={submit}>
  {!signInOnly&&<div className="auth-tabs"><button type="button" className={mode==='register'?'active':''} onClick={()=>setMode('register')}>Create account</button><button type="button" className={mode==='login'?'active':''} onClick={()=>setMode('login')}>Sign in</button></div>}
  <p className="muted">{signInOnly?'Sign in to the account you want to delete.':mode==='register'?'Your collection starts empty.':'Sign in to your collection.'}</p>
  {mode==='register'&&<label>Your name<input autoComplete="name" required maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label>}
  <label>Email<input autoComplete="email" required type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></label>
  <label>Password<input autoComplete={mode==='register'?'new-password':'current-password'} required type="password" minLength={mode==='register'?12:1} maxLength={256} value={password} onChange={e=>setPassword(e.target.value)}/></label>
  {mode==='register'&&<p className="muted tiny">12 characters minimum. Local account; no password recovery.</p>}
  <button className="button primary full-width" disabled={busy}>{busy?'One moment…':mode==='register'?'Create account':'Sign in'}<ArrowRight size={17}/></button>
 </form>;
}
function DeleteForm({onDelete,busy}:{onDelete:()=>Promise<void>;busy:boolean}){const [confirmation,setConfirmation]=useState('');return <div className="form-stack"><div className="form-note warm"><Trash2 size={20}/><span>This permanently deletes your account, active sessions, bottles, settings, and journal entries from the running app. Export your data first if you want a copy.</span></div><a className="text-button" href="/api/export" download><Download size={16}/>Export my data first</a><label>Type DELETE to confirm<input value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off"/></label><button className="button danger" disabled={confirmation!=='DELETE'||busy} onClick={()=>void onDelete()}>{busy?'Deleting…':'Permanently delete my account'}<Trash2 size={16}/></button></div>;}
