'use client';
import {moodOptions,vibeOptions} from '@/lib/intent';
import type {ScentIntent} from '@/lib/types';
export default function IntentPicker({value,onChange}:{value:ScentIntent;onChange:(value:ScentIntent)=>void}){
 return <div className="intent-controls"><label>Mood<select aria-label="Mood" value={value.mood} onChange={e=>onChange({...value,mood:e.target.value as ScentIntent['mood']})}>{moodOptions.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label><label>Vibe<select aria-label="Vibe" value={value.vibe} onChange={e=>onChange({...value,vibe:e.target.value as ScentIntent['vibe']})}>{vibeOptions.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label></div>;
}
