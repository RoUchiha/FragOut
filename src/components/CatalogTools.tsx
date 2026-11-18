'use client';
import {useEffect,useRef,useState} from 'react';
import {Modal} from './Primitives';
import {catalogReferenceUrl,fragranceFacets} from '@/lib/catalog-ratings';
import {catalogThumbnailPhotos,isCatalogPhotoPath} from '@/lib/catalog-photos';
import type {AppState,CatalogDetailReply,CatalogProfile,CatalogSearchReply,CatalogTarget,ComparisonReply} from '@/lib/types';

export type FeatureMutation=(path:string,method:string,data?:unknown,message?:string)=>Promise<boolean>;
export async function featureRequest<T>(path:string,body?:unknown,signal?:AbortSignal):Promise<T>{
 const response=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?undefined:{'Content-Type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body),signal,cache:'no-store',redirect:'error'});
 const result=await response.json();if(!response.ok)throw new Error(result.error??'Request failed. Try again.');return result;
}
export function SourceLink({url,children}:{url:string;children:React.ReactNode}){
 const href=catalogReferenceUrl(url);
 return href?<a href={href} target="_blank" rel="noopener noreferrer" className="text-button">{children}</a>:<span>{children}</span>;
}
export function CatalogThumb({path,name,large=false}:{path?:string;name:string;large?:boolean}){
 const [failed,setFailed]=useState(false);
 return isCatalogPhotoPath(path)&&!failed?<img className={large?'catalog-photo large':'catalog-photo'} src={path} alt={name+' bottle'} loading="lazy" onError={()=>setFailed(true)}/>:null;
}
export function CatalogRatings({profile}:{profile:CatalogProfile|null|undefined}){
 return <div className="catalog-ratings">{fragranceFacets.map(([facet,label])=>{
  const ratings=profile?.ratings.filter(rating=>rating.facet===facet)??[];
  return <div className="catalog-rating" key={facet}><span>{label}</span><div>{!ratings.length?'N/A':ratings.map(rating=>{
   const source=profile?.sources.find(source=>source.id===rating.sourceId);
   return source?<SourceLink key={source.id} url={source.url}><span className="catalog-stars" aria-hidden="true"><span>☆☆☆☆☆</span><span style={{width:rating.score/5*100+'%'}}>★★★★★</span></span>
    {rating.score}/5{rating.kind==='estimate'?' · Est.':''}<small>{source.publisher} · {rating.basis}</small></SourceLink>:null;
  })}</div></div>;
 })}</div>;
}

export default function CatalogTools({state,mutate,start,onClosed}:{state:AppState;mutate:FeatureMutation;start?:CatalogTarget|null;onClosed?:()=>void}){
 const [open,setOpen]=useState(!!start),[query,setQuery]=useState(''),[include,setInclude]=useState(''),[exclude,setExclude]=useState(''),[stage,setStage]=useState('any'),[match,setMatch]=useState('all'),[offset,setOffset]=useState(0);
 const [selected,setSelected]=useState(''),[left,setLeft]=useState<CatalogTarget|null>(start??null),[right,setRight]=useState<CatalogTarget|null>(null),[attempt,setAttempt]=useState(0),[busy,setBusy]=useState(false),[enlarged,setEnlarged]=useState(false);
 const [size,setSize]=useState('100');
 const search=JSON.stringify({query,include:include.split(',').map(value=>value.trim()).filter(Boolean),exclude:exclude.split(',').map(value=>value.trim()).filter(Boolean),stage,match,offset});
 const key=JSON.stringify([search,selected,left,right,attempt,open]);
 const [lookup,setLookup]=useState<{key:string;page?:CatalogSearchReply;detail?:CatalogDetailReply;comparison?:ComparisonReply;error?:string}|null>(null);
 const result=lookup?.key===key?lookup:null;
 const saving=useRef(false);
 useEffect(()=>{
  if(!open)return;const controller=new AbortController();
  const timer=setTimeout(()=>{
   const task=left&&right?featureRequest<ComparisonReply>('compare',{left,right},controller.signal).then(comparison=>({comparison})):
    selected?featureRequest<CatalogDetailReply>('catalog/detail',{id:selected},controller.signal).then(detail=>({detail})):
     featureRequest<CatalogSearchReply>('catalog/search',JSON.parse(search),controller.signal).then(page=>({page}));
   void task.then(value=>{if(!controller.signal.aborted)setLookup({key,...value});}).catch(error=>{if(!controller.signal.aborted)setLookup({key,error:error.message});});
  },200);
  return ()=>{clearTimeout(timer);controller.abort();};
 },[open,key,search,selected,left,right]);
 const close=()=>{setOpen(false);onClosed?.();};
 async function add(ownership:'OWNED'|'WISHLIST'){
  if(!result?.detail||saving.current)return;saving.current=true;setBusy(true);
  const {brand,name,concentration}=result.detail.edition;
  try{if(await mutate('bottles','POST',{brand,name,concentration,ownership,family:'',notes:[],strength:1,climate:'UNKNOWN',profileKnown:false,provenance:'unknown',
   color:'#b8c986',shape:'square',sizeMl:Number(size),fillPct:100,rating:0,favorite:false,memo:'',shelves:[]},ownership==='OWNED'?'Added to collection.':'Added to wishlist.'))close();}
  finally{saving.current=false;setBusy(false);}
 }
 const detail=result?.detail,comparison=result?.comparison;
 const [photo]=catalogThumbnailPhotos(detail?.profile);
 return <>
  {!start&&<button className="text-button" onClick={()=>setOpen(true)}>Browse FragDex</button>}
  {open&&<Modal title={comparison?'Compare fragrances':left?'Choose a comparison':'FragDex'} wide onClose={close}>
   <div className="form-stack catalog-tools">
    {(selected||left)&&<button className="text-button" onClick={()=>{setSelected('');setLeft(null);setRight(null);setEnlarged(false);}}>Back to catalog</button>}
    {!selected&&!comparison&&<>
     {left&&<label>Compare with your collection<select value="" onChange={event=>{if(event.target.value)setRight({kind:'bottle',id:event.target.value});}}><option value="">Choose a bottle…</option>
      {state.bottles.filter(bottle=>left.kind!=='bottle'||bottle.id!==left.id).map(bottle=><option key={bottle.id} value={bottle.id}>{bottle.brand} · {bottle.name} · {bottle.concentration}</option>)}</select></label>}
     <label>Search FragDex<input placeholder="Fragrance or house" maxLength={120} value={query} onChange={event=>{setQuery(event.target.value);setOffset(0);}}/></label>
     <details><summary>Note filters{include||exclude?' · On':''}</summary><div className="form-grid catalog-filter-fields">
      <label>Include notes<input placeholder="bergamot, cedar" maxLength={500} value={include} onChange={event=>{setInclude(event.target.value);setOffset(0);}}/></label>
      <label>Exclude notes<input placeholder="vanilla, oud" maxLength={500} value={exclude} onChange={event=>{setExclude(event.target.value);setOffset(0);}}/></label>
      <label>Match<select value={match} onChange={event=>{setMatch(event.target.value);setOffset(0);}}><option value="all">All included notes</option><option value="any">Any included note</option></select></label>
      <label>Position<select value={stage} onChange={event=>{setStage(event.target.value);setOffset(0);}}>{[['any','Anywhere'],['top','Top'],['heart','Heart'],['base','Base'],['listed','Unstaged']].map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
     </div><p className="muted tiny">Recorded note names only. Unknown pyramids do not pass note filters. Notes are not ingredient or allergy lists.</p></details>
    </>}
    {result?.error?<div role="alert">{result.error}<button className="text-button" onClick={()=>setAttempt(value=>value+1)}>Retry</button></div>:!result?<p role="status">Loading…</p>:null}
    {result?.page&&<><p className="muted tiny">{result.page.total} editions</p><div className="catalog-results">
     {result.page.entries.map(entry=><button key={entry.id} onClick={()=>left?setRight({kind:'catalog',id:entry.id}):setSelected(entry.id)} className="catalog-result">
      <CatalogThumb path={entry.photo} name={entry.name}/><span><small>{entry.brand}</small><strong>{entry.name}</strong><small>{entry.concentration}{entry.releaseYear?' · '+entry.releaseYear:''}{!entry.hasNotes?' · Notes pending':''}</small></span>
     </button>)}{!result.page.entries.length&&<p>No matching editions.</p>}</div>
     <div className="split-actions"><button className="button secondary" disabled={!offset} onClick={()=>setOffset(value=>Math.max(0,value-12))}>Previous</button><span>{result.page.total?offset+1:0}–{Math.min(offset+12,result.page.total)}</span><button className="button secondary" disabled={offset+12>=result.page.total} onClick={()=>setOffset(value=>value+12)}>Next</button></div>
    </>}
    {detail&&<>
     <div className="catalog-detail-heading">{photo&&<button aria-label="Enlarge bottle thumbnail" onClick={()=>setEnlarged(value=>!value)}><CatalogThumb key={photo.path+enlarged} path={photo.path} name={detail.edition.name} large={enlarged}/></button>}
      <div><p className="muted tiny">{detail.edition.brand}</p><h3>{detail.edition.name}</h3><p>{detail.edition.concentration}{detail.edition.releaseYear?' · '+detail.edition.releaseYear:''}</p></div></div>
     <label>Volume · ml<input type="number" min={0.1} max={2000} step={0.1} value={size} onChange={event=>setSize(event.target.value)}/></label>
     <div className="catalog-actions"><button className="button primary" disabled={busy||!Number.isFinite(Number(size))||Number(size)<0.1||Number(size)>2000} onClick={()=>void add('OWNED')}>I own this</button><button className="button secondary" disabled={busy||!Number.isFinite(Number(size))||Number(size)<0.1||Number(size)>2000} onClick={()=>void add('WISHLIST')}>Wishlist</button>
      <button className="text-button" onClick={()=>{setLeft({kind:'catalog',id:detail.edition.id});setSelected('');}}>Compare</button></div>
     <h3>Cross-checked notes</h3><CatalogNotes profile={detail.profile}/><CatalogRatings profile={detail.profile}/>
     {detail.dupes.alternatives.length>0&&<><h3>Dupe options</h3>{detail.dupes.alternatives.map(dupe=><div key={dupe.brand+dupe.name}><p>{dupe.brand} · {dupe.name} · {dupe.concentration}</p><SourceLink url={dupe.sources[0].url}>{dupe.evidence==='brand'?'Brand-stated inspiration':'Community comparison'}</SourceLink></div>)}</>}
     {detail.dupes.originals.map(original=><p key={original.brand+original.name}>Dupe of {original.brand} {original.name} · {original.concentration} · <SourceLink url={original.sources[0].url}>Source</SourceLink></p>)}
     {detail.similar.length>0&&<details><summary>Similar listed notes</summary><p className="muted tiny">Shared note names suggest where to explore. They do not prove a similar smell.</p>{detail.similar.map(match=><button className="catalog-result" key={match.edition.id} onClick={()=>setSelected(match.edition.id)}><span><strong>{match.edition.name}</strong><small>{match.edition.brand} · {match.edition.concentration} · {match.sharedNotes.length} shared notes</small></span></button>)}</details>}
     <div className="catalog-actions">{detail.profile?.links.map(link=><SourceLink key={link.url} url={link.url}>{link.label}</SourceLink>)}</div>
     {!!detail.profile?.sources.length&&<details><summary>Sources &amp; credits</summary><p className="muted tiny">Checked {detail.profile.checkedAt}</p>{detail.profile.sources.map(source=><div key={source.id}><SourceLink url={source.url}>{source.publisher}</SourceLink>{source.credit&&<p className="muted tiny">{source.credit}</p>}{source.license&&<SourceLink url={source.license.url}>{source.license.name}</SourceLink>}</div>)}</details>}
    </>}
    {comparison&&<>
     <p className="form-note">{comparison.noteOverlap===null?'Listed-note overlap: N/A':comparison.noteOverlap+'% listed-note overlap'}. Recorded note names only; missing facts stay unknown.</p>
     <h3>Shared notes</h3><p>{comparison.sharedNotes.join(' · ')||(comparison.noteOverlap===null?'Unknown':'None listed in common')}</p>
     <div className="catalog-comparison">{[comparison.left,comparison.right].map((side,index)=><section key={index}>
      <CatalogThumb path={catalogThumbnailPhotos(side.profile)[0]?.path} name={side.edition.name}/><p className="muted tiny">{side.edition.brand}</p><h3>{side.edition.name}</h3><p>{side.edition.concentration} · {side.profile?.releaseYear??'Year N/A'}</p>
      <h4>Distinct notes</h4><p>{comparison.noteOverlap===null?'N/A':(index?comparison.rightOnly:comparison.leftOnly).join(' · ')||'None'}</p>
      <CatalogNotes profile={side.profile}/><CatalogRatings profile={side.profile}/>
     </section>)}</div>
     <button className="button secondary" onClick={()=>setRight(null)}>Change comparison</button>
    </>}
   </div>
  </Modal>}
 </>;
}
function CatalogNotes({profile}:{profile:CatalogProfile|null}){
 return profile?.notes.length?<div className="catalog-note-groups">{(['top','heart','base','listed'] as const).map(stage=>{
  const notes=profile.notes.filter(note=>note.stage===stage);return notes.length?<p key={stage}><strong>{stage==='listed'?'Notes':stage}</strong> {notes.map(note=>note.name).join(' · ')}</p>:null;
 })}</div>:<p className="muted tiny">No cross-checked notes for this edition yet.</p>;
}
