import type {JournalReply,WearEvent} from './types.ts';

export function shiftMonth(month:string,amount:number){
 const [year,index]=month.split('-').map(Number);
 return new Date(Date.UTC(year,index-1+amount,15)).toISOString().slice(0,7);
}
export function calendarCells(month:string){
 const [year,index]=month.split('-').map(Number),start=new Date(Date.UTC(year,index-1,1)).getUTCDay();
 return [...Array<string|null>(start).fill(null),...Array.from({length:new Date(Date.UTC(year,index,0)).getUTCDate()},(_,i)=>month+'-'+String(i+1).padStart(2,'0'))];
}

export function dayInZone(at:string,timezone:string){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(at));
 const value=(kind:string)=>parts.find(part=>part.type===kind)!.value;
 return `${value('year')}-${value('month')}-${value('day')}`;
}

/** A date-only wear is stored at local noon, which avoids midnight DST transitions. */
export function wearDateAt(date:string,timezone:string,now=Date.now()){
 const invalid=()=>new Error('Choose a valid wear date no later than today.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw invalid();
 const target=Date.parse(date+'T12:00:00Z');
 if(!Number.isFinite(target)||new Date(target).toISOString().slice(0,10)!==date||date<'1900-01-01')throw invalid();
 let current=target;
 try{
  if(date>dayInZone(new Date(now).toISOString(),timezone))throw invalid();
  for(let attempt=0;attempt<4;attempt++){
   const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(current));
   const value=(type:string)=>Number(parts.find(part=>part.type===type)!.value);
   const local=Date.UTC(value('year'),value('month')-1,value('day'),value('hour'),value('minute'),value('second'));
   if(local===target)break;
   current+=target-local;
  }
  const at=new Date(current).toISOString();
  if(dayInZone(at,timezone)!==date)throw invalid();
  return at;
 }catch{throw invalid();}
}

export function journalSummary(history:WearEvent[],month:string,timezone:string):JournalReply {
 const all=history.filter(event=>event.reaction==='wore').sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
 const entries=all.filter(event=>dayInZone(event.at,timezone).startsWith(month+'-'));
 const days:Record<string,number>={},counts=new Map<string,{id:string;name:string;count:number}>();
 for(const event of entries){const day=dayInZone(event.at,timezone);days[day]=(days[day]??0)+1;}
 for(const event of all)for(const id of new Set(event.bottleIds)){
  const current=counts.get(id);
  counts.set(id,{id,name:current?.name??event.names[event.bottleIds.indexOf(id)]??'Removed fragrance',count:(current?.count??0)+1});
 }
 return {month,timezone,entries,days,totalWears:all.length,monthWears:entries.length,
  layeredWears:all.filter(event=>event.bottleIds.length===2).length,distinctBottles:counts.size,
  mostWorn:[...counts.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)).slice(0,10)};
}

export function journalCsv(history:WearEvent[],timezone:string){
 const cell=(input:string)=>{
  const safe=/^[\s\uFEFF]*[=+\-@]|^[\t\r]/u.test(input)?"'"+input:input;
  return '"'+safe.replace(/"/g,'""')+'"';
 };
 const rows=[['Date','Fragrance 1','Fragrance 2','Occasion','Time zone','Private note'],
  ...history.filter(event=>event.reaction==='wore').sort((a,b)=>b.at.localeCompare(a.at)).map(event=>[
   dayInZone(event.at,timezone),event.names[0]??'',event.names[1]??'',event.occasion,timezone,event.note??'',
  ])];
 return rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
