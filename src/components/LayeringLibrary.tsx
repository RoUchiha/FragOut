'use client';
import {useEffect,useState} from 'react';
import type {LayeringLibraryEntry,LayeringLibrarySide} from '@/lib/types';

type Page={entries:LayeringLibraryEntry[];total:number;nextOffset:number|null};

function Fragrance({side}:{side:LayeringLibrarySide}) {
 return <div className="layering-library-side">
  <h3>{side.label}</h3>
  {side.editions.map(edition=><p className="muted tiny" key={edition.id}>
   {edition.concentration}
   {edition.dupes.originals.map(original=><span key={original.brand+original.name}> · Dupe of {original.brand} {original.name} {original.concentration}</span>)}
  </p>)}
  {side.alternatives.length>0?<ul>{side.alternatives.map(dupe=><li key={dupe.brand+dupe.name+dupe.concentration}>
   <span>{dupe.brand} {dupe.name} · {dupe.concentration}</span>
   {dupe.originalConcentration&&<span className="muted tiny">For the {dupe.originalConcentration} edition</span>}
   <a href={dupe.sources[0].url} target="_blank" rel="noreferrer">{dupe.evidence==='brand'?'Brand-stated inspiration':'Community comparison'}</a>
  </li>)}</ul>:<p className="muted tiny">No sourced dupe in FragOut yet.</p>}
 </div>;
}

export default function LayeringLibrary() {
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[owned,setOwned]=useState(false),[offset,setOffset]=useState(0);
 const [page,setPage]=useState<Page|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController();
  const timer=setTimeout(()=>{
   void fetch('/api/layering/search?q='+encodeURIComponent(query)+'&owned='+owned+'&offset='+offset,{signal:controller.signal})
    .then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error??'Could not load pairings.');return data as Page;})
    .then(value=>{if(!controller.signal.aborted)setPage(value);})
    .catch(problem=>{if(!controller.signal.aborted)setError(problem.message);});
  },250);
  return ()=>{clearTimeout(timer);controller.abort();};
 },[open,query,owned,offset,attempt]);
 function reset(){setPage(null);setError('');}
 return <details className="layering-library" onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary>Explore layers &amp; dupe options</summary>
  {open&&<div className="form-stack">
   <div className="collection-tools">
    <label className="search-input"><input aria-label="Search layering library" placeholder="Fragrance, brand, or note" maxLength={120}
     value={query} onChange={event=>{reset();setQuery(event.target.value);setOffset(0);}}/></label>
    <button className={'button secondary '+(owned?'active-filter':'')} aria-pressed={owned}
     onClick={()=>{reset();setOwned(value=>!value);setOffset(0);}}>My fragrances</button>
   </div>
   <p className="muted tiny">Published AI predictions · Will It Layer?</p>
   {error?<div role="alert">{error}<button className="text-button" onClick={()=>{reset();setAttempt(value=>value+1);}}>Retry</button></div>:
    !page?<p role="status">Loading pairings…</p>:<div>
     <p className="muted tiny">{page.total} pairings</p>
     {page.entries.map(entry=><details key={entry.id} className="layering-library-entry">
      <summary>{entry.a.label} + {entry.b.label}
       {entry.reference.score!==null&&<span className="muted tiny">Source prediction {entry.reference.score}/{entry.reference.scale}</span>}
      </summary>
      <div className="layering-library-pair"><Fragrance side={entry.a}/><Fragrance side={entry.b}/></div>
      <p className="muted tiny">Dupe substitutions are experimental. The published score belongs to the source pair.</p>
      {entry.reference.editionUnconfirmed&&<p className="muted tiny">The source leaves a concentration unspecified.</p>}
      <a className="text-button" href={entry.reference.url} target="_blank" rel="noreferrer">View on Will It Layer?</a>
     </details>)}
     <div className="layering-library-pagination">
      <button className="button secondary" disabled={offset===0} onClick={()=>{reset();setOffset(value=>Math.max(0,value-12));}}>Previous</button>
      <button className="button secondary" disabled={page.nextOffset===null} onClick={()=>{reset();setOffset(page.nextOffset!);}}>Next</button>
     </div>
    </div>}
  </div>}
 </details>;
}
