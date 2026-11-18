'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Modal} from './Primitives';
import {featureRequest,type FeatureMutation} from './CatalogTools';
import {calendarCells,dayInZone,shiftMonth} from '@/lib/journal';
import type {AppState,JournalReply,WearEvent} from '@/lib/types';

export default function WearJournal({state,busy,mutate}:{state:AppState;busy:boolean;mutate:FeatureMutation}){
 const today=dayInZone(new Date().toISOString(),state.context.timezone);
 const [month,setMonth]=useState(today.slice(0,7)),[day,setDay]=useState(''),[attempt,setAttempt]=useState(0),[editing,setEditing]=useState<WearEvent|null|undefined>(undefined),[exporting,setExporting]=useState(false),[exportError,setExportError]=useState('');
 const [lookup,setLookup]=useState<{key:string;history:WearEvent[];data?:JournalReply;error?:string}|null>(null);
 const active=useRef(true);useEffect(()=>{active.current=true;return ()=>{active.current=false;};},[]);
 const key=[month,attempt,state.context.timezone].join('|'),history=state.history;
 const result=lookup?.key===key&&lookup.history===history?lookup:null,data=result?.data;
 useEffect(()=>{
  const controller=new AbortController();
  void featureRequest<JournalReply>('journal/'+month,undefined,controller.signal).then(data=>{if(!controller.signal.aborted)setLookup({key,history,data});})
   .catch(error=>{if(!controller.signal.aborted)setLookup({key,history,error:error.message});});
  return ()=>controller.abort();
 },[month,key,history]);
 async function exportCsv(){
  setExporting(true);setExportError('');
  try{
   const {csv}=await featureRequest<{csv:string}>('journal/export');if(!active.current)return;
   const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
   try{link.href=url;link.download='fragout-wear-journal.csv';link.hidden=true;document.body.append(link);link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
   catch(error){URL.revokeObjectURL(url);throw error;}finally{link.remove();}
  }catch(error){if(active.current)setExportError((error as Error).message);}finally{if(active.current)setExporting(false);}
 }
 const displayed=data?.entries.filter(event=>!day||dayInZone(event.at,data.timezone)===day)??[];
 return <>
  <div className="page-heading"><h1>Journal</h1><button className="button primary" disabled={busy} onClick={()=>setEditing(null)}>Log wear</button></div>
  <div className="wear-layout"><section className="form-stack">
   <div className="split-actions"><button className="button secondary" aria-label="Previous month" disabled={month<='1900-01'} onClick={()=>{setMonth(value=>shiftMonth(value,-1));setDay('');}}>‹</button><h2>{new Date(month+'-15T12:00:00Z').toLocaleDateString(undefined,{month:'long',year:'numeric',timeZone:'UTC'})}</h2><button className="button secondary" aria-label="Next month" disabled={month>=today.slice(0,7)} onClick={()=>{setMonth(value=>shiftMonth(value,1));setDay('');}}>›</button></div>
   {result?.error?<div role="alert">{result.error}<button className="text-button" onClick={()=>setAttempt(value=>value+1)}>Retry</button></div>:!data?<p role="status">Loading wear journal…</p>:<>
    <div className="wear-calendar">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(label=><span className="muted tiny" key={label}>{label}</span>)}
     {calendarCells(month).map((date,index)=>date?<button key={date} aria-label={date+' · '+(data.days[date]??0)+' wears'} aria-pressed={date===day} disabled={date>today}
      className={(date===day?'selected ':'')+(date===today?'today':'')} onClick={()=>setDay(current=>current===date?'':date)}>
      {Number(date.slice(-2))}{!!data.days[date]&&<span className="wear-day-dot"/>}</button>:<span key={'blank-'+index}/>)}
    </div>
    <div className="split-actions"><p className="muted tiny">{data.monthWears} wears this month · {data.timezone}</p>{day&&<button className="text-button" onClick={()=>setDay('')}>All days</button>}</div>
    {day&&<div className="split-actions"><h3>{day}</h3><button className="text-button" onClick={()=>setEditing(null)}>Add for this day</button></div>}
    {!displayed.length&&<p className="muted">No wears {day?'this day':'this month'}.</p>}
    {displayed.map(event=><article key={event.id} className="wear-entry"><small>{dayInZone(event.at,data.timezone)} · {event.occasion.toLowerCase()}</small><h3>{event.names.join(' + ')}</h3>{event.note&&<p className="wear-private-note">{event.note}</p>}
     <div className="catalog-actions"><button className="text-button" disabled={busy} onClick={()=>setEditing(event)}>Edit</button><button className="text-button" disabled={busy} onClick={()=>void mutate('feedback/'+event.id,'DELETE',undefined,'Wear removed.')}>Remove</button></div></article>)}
   </>}
  </section><aside className="form-stack wear-stats"><h3>All-time wear stats</h3>{data&&<><p>{data.totalWears} wears · {data.distinctBottles} fragrances · {data.layeredWears} layers</p>
   {data.mostWorn.map(item=><div className="split-actions" key={item.id}><span>{item.name}</span><small>{item.count}</small></div>)}</>}
   <button className="button secondary" disabled={exporting||busy} onClick={()=>void exportCsv()}>{exporting?'Exporting…':'Export wear journal · CSV'}</button>{exportError&&<p role="alert">{exportError}</p>}
   <details><summary>Recent likes &amp; feedback</summary><p className="muted tiny">Recent 200 activities. These do not count as wears.</p>{history.filter(event=>event.reaction!=='wore').map(event=><div className="wear-entry" key={event.id}><small>{event.reaction==='saved'?'Saved pair':event.reaction==='loved'?'Loved':'Not for me'}</small><h4>{event.names.join(' + ')}</h4><button className="text-button" disabled={busy} onClick={()=>void mutate('feedback/'+event.id,'DELETE',undefined,'Entry removed.')}>Remove</button></div>)}</details>
  </aside></div>
  {editing!==undefined&&<WearForm key={editing?.id??'new'} state={state} event={editing} initialDate={day||today} busy={busy} mutate={mutate} onClose={()=>setEditing(undefined)}
   onSaved={date=>{setEditing(undefined);setMonth(date.slice(0,7));setDay('');setAttempt(value=>value+1);}}/>}
 </>;
}
function WearForm({state,event,initialDate,busy,mutate,onClose,onSaved}:{state:AppState;event:WearEvent|null;initialDate:string;busy:boolean;mutate:FeatureMutation;onClose:()=>void;onSaved:(date:string)=>void}){
 const [date,setDate]=useState(event?dayInZone(event.at,state.context.timezone):initialDate),[note,setNote]=useState(event?.note??''),[first,setFirst]=useState(''),[second,setSecond]=useState('');
 const bottles=state.bottles.filter(bottle=>bottle.ownership==='OWNED');
 async function save(e:FormEvent){e.preventDefault();if(busy)return;
  if(await mutate(event?'journal/'+event.id:'journal',event?'PATCH':'POST',{date,note,...(!event?{bottleIds:[first,second].filter(Boolean)}:{})},'Wear saved.'))onSaved(date);
 }
 return <Modal title={event?'Edit wear':'Log wear'} onClose={onClose}><form className="form-stack" onSubmit={e=>void save(e)}>
  <label>Date<input type="date" required min="1900-01-01" max={dayInZone(new Date().toISOString(),state.context.timezone)} value={date} onChange={e=>setDate(e.target.value)}/></label><p className="muted tiny">{state.context.timezone} · Date-only logs use local noon.</p>
  {event?<h3>{event.names.join(' + ')}</h3>:<><label>Fragrance<select required value={first} onChange={e=>{setFirst(e.target.value);if(e.target.value===second)setSecond('');}}><option value="">Choose a fragrance…</option>{bottles.map(bottle=><option value={bottle.id} key={bottle.id}>{bottle.brand} · {bottle.name} · {bottle.concentration}</option>)}</select></label>
   <label>Layer with (optional)<select value={second} onChange={e=>setSecond(e.target.value)}><option value="">Single fragrance</option>{bottles.filter(bottle=>bottle.id!==first).map(bottle=><option value={bottle.id} key={bottle.id}>{bottle.brand} · {bottle.name} · {bottle.concentration}</option>)}</select></label></>}
  <label>Private wear note<textarea maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} rows={3}/></label>
  <button className="button primary" disabled={busy||!date||!event&&!first}>{busy?'Saving…':'Save wear'}</button>
 </form></Modal>;
}
