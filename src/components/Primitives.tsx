'use client';
import {useEffect,useId,useRef,type ReactNode} from 'react';
import {ArrowRight,ArrowUpRight,BriefcaseBusiness,Coffee,Dumbbell,Heart,ShoppingBag,Sparkles,Sun,Wine,X,Plus} from 'lucide-react';
import type {Bottle} from '@/lib/types';
export const iconMap={dumbbell:Dumbbell,heart:Heart,briefcase:BriefcaseBusiness,wine:Wine,shopping:ShoppingBag,coffee:Coffee,sun:Sun,sparkles:Sparkles};
export function ShortcutIcon({name,size=22}:{name:string;size?:number}){const Icon=iconMap[name as keyof typeof iconMap]??Sparkles;return <Icon size={size} strokeWidth={1.65}/>;}
export function Arrow({diagonal=false}:{diagonal?:boolean}){return diagonal?<ArrowUpRight size={18}/>:<ArrowRight size={18}/>;}
export function BrandMark({small=false}:{small?:boolean}){return <span className={'brand-mark '+(small?'small':'')} aria-hidden="true"><svg viewBox="0 0 36 36"><path d="M18 0 21 12 31 5 24 15 36 18 24 21 31 31 21 24 18 36 15 24 5 31 12 21 0 18 12 15 5 5 15 12Z" fill="currentColor"/></svg></span>;}
export function BottleArt({bottle,hero=false}:{bottle:Pick<Bottle,'name'|'color'|'shape'>&{concentration?:string};hero?:boolean}){
 const uid=useId().replace(/:/g,'');const round=bottle.shape==='round',tall=bottle.shape==='tall';const x=round?36:tall?57:43,w=round?128:tall?86:114,y=tall?70:86,h=tall?164:148;
 return <svg className={'bottle-art '+(hero?'hero-art':'')} viewBox="0 0 200 270" role="img" aria-label={`Illustration of ${bottle.name}`}>
  <defs><linearGradient id={'glass'+uid} x1="0" x2="1"><stop stopColor={bottle.color} stopOpacity=".5"/><stop offset=".35" stopColor={bottle.color} stopOpacity=".8"/><stop offset=".8" stopColor={bottle.color}/><stop offset="1" stopColor={bottle.color} stopOpacity=".65"/></linearGradient><linearGradient id={'cap'+uid}><stop stopColor="#151b18"/><stop offset=".55" stopColor="#394039"/><stop offset="1" stopColor="#121612"/></linearGradient><filter id={'shadow'+uid} x="-100%" width="300%"><feGaussianBlur stdDeviation="7"/></filter></defs>
  <ellipse cx="103" cy="246" rx="65" ry="8" fill="#35402e" opacity=".15" filter={`url(#shadow${uid})`}/>
  <rect x="80" y={tall?37:50} width="40" height="14" rx="2" fill="#b8ac85"/>
  <rect x={tall?69:66} y={tall?20:31} width={tall?62:68} height={tall?34:39} rx={round?16:3} fill={`url(#cap${uid})`}/>
  <rect x="86" y={tall?55:71} width="28" height="19" fill={bottle.color} opacity=".8"/>
  <rect x={x} y={y} width={w} height={h} rx={round?43:6} fill={`url(#glass${uid})`} stroke={bottle.color} strokeWidth="1.6"/>
  <rect x={x+6} y={y+8} width={w-12} height={h-14} rx={round?38:3} fill="none" stroke="white" strokeOpacity=".35"/>
  <path d={`M${x+12} ${y+17}v${h-42}`} stroke="white" strokeWidth="3" strokeLinecap="round" opacity=".4"/>
  <rect x={tall?62:round?50:50} y={tall?112:128} width={tall?76:100} height={tall?75:69} fill="#f5f3e9" opacity=".96"/>
  <text x="100" y={tall?130:145} textAnchor="middle" fontFamily="Georgia,serif" fontSize="7" letterSpacing="2">FRAGOUT</text>
  {bottle.name.split(' ').map((word,i)=><text key={i} x="100" y={(tall?150:164)+i*13} textAnchor="middle" fontFamily="Georgia,serif" fontSize={tall?11:12} fill="#253329">{word.toUpperCase()}</text>)}
  <text x="100" y={tall?179:190} textAnchor="middle" fontFamily="Arial,sans-serif" fontSize="4.8" letterSpacing="1.2">{bottle.concentration==='EDP'?'EAU DE PARFUM':bottle.concentration==='EDT'?'EAU DE TOILETTE':bottle.concentration&&bottle.concentration!=='UNKNOWN'?bottle.concentration:'PERSONAL COLLECTION'}</text>
 </svg>;
}
export function Modal({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}){
 const ref=useRef<HTMLDivElement>(null),titleId=useId();
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const scroll=document.body.style.overflow;document.body.style.overflow='hidden';
   const el=ref.current;const focusables=()=>el?.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex="0"]');
   focusables()?.[0]?.focus();
   const key=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose();if(e.key==='Tab'){const items=Array.from(focusables()??[]).filter(e=>!e.hasAttribute('disabled'));const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}};
   document.addEventListener('keydown',key);return()=>{document.body.style.overflow=scroll;document.removeEventListener('keydown',key);previous?.focus();};
 },[onClose]);
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><div className={'modal '+(wide?'wide':'')} ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId}><div className="modal-heading"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={22}/></button></div>{children}</div></div>;
}
export function Empty({title,detail,action,onAction}:{title:string;detail:string;action?:string;onAction?:()=>void}){return <div className="empty-state"><span className="empty-symbol"><Sparkles size={28} strokeWidth={1.4}/></span><h3>{title}</h3><p>{detail}</p>{action&&<button className="button primary" onClick={onAction}><Plus size={17}/>{action}</button>}</div>;}
