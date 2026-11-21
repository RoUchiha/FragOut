import {z} from 'zod';

export interface LayerBottle {id:string;variantId:string;brand:string;name:string;concentration:string;notes:string[];strength:number;ownership:string;profileKnown:boolean;available:boolean}
export interface LayerContext {occasion:string;policy:string;maxStrength:number;excludedNotes:string[];excludedIds:string[];rejectedPairs:string[][];evidenceOnly:boolean}
export const layeringSchema=z.object({combos:z.array(z.object({a:z.string().min(1).max(60),b:z.string().min(1).max(60),noteA:z.string().min(1).max(80),noteB:z.string().min(1).max(80),why:z.string().min(1).max(160)}).strict()).max(3),message:z.string().max(160)}).strict();
const normal=(value:string)=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().trim();
export function pairKey(collection:LayerBottle[],a:string,b:string){
 const left=collection.find(item=>item.id===a),right=collection.find(item=>item.id===b);
 return !left||!right||left.variantId===right.variantId?null:JSON.stringify([left.variantId,right.variantId].sort());
}
export function eligiblePairs(collection:LayerBottle[],context:LayerContext){
 if(context.policy==='NO_FRAGRANCE'||context.evidenceOnly)return [];
 const light=context.policy==='LOW_SCENT'||context.occasion==='GYM';
 const quiet=light||['WORK','DATE'].includes(context.occasion);
 const excluded=new Set(context.excludedNotes.map(normal));
 const bottles=collection.filter(b=>b.ownership==='OWNED'&&b.profileKnown&&b.available&&b.notes.length&&b.strength<=context.maxStrength&&(!light||b.strength<=1)&&(!quiet||b.strength<=2)&&!context.excludedIds.includes(b.id)&&!b.notes.some(n=>excluded.has(normal(n))));
 const rejected=new Set(context.rejectedPairs.map(([a,b])=>pairKey(collection,a,b)));
 const pairs=new Set<string>();
 for(let i=0;i<bottles.length;i++)for(let j=i+1;j<bottles.length;j++){
  const a=bottles[i],b=bottles[j],key=pairKey(collection,a.id,b.id);
  if(key&&!rejected.has(key)&&(!quiet||a.strength+b.strength<=2))pairs.add(key);
 }
 return [...pairs].sort();
}
export function evaluateLayering(raw:unknown,collection:LayerBottle[],context:LayerContext){
 const eligible=eligiblePairs(collection,context),expectedSlots=Math.min(3,eligible.length),parsed=layeringSchema.safeParse(raw);
 const pairKeys:string[]=[],violations:string[]=[],noteViolations:string[]=[],commaListViolations:string[]=[];
 if(!parsed.success)return {schemaValid:false,constraintsValid:false,notesValid:false,commaListGrounded:false,coverageValid:false,abstentionValid:expectedSlots===0?false:null,eligibleCount:eligible.length,expectedSlots,pairKeys,firstPair:null,violations:['invalid_schema'],noteViolations,commaListViolations};
 let firstPair:string|null=null;
 for(const [index,combo] of parsed.data.combos.entries()){
  const key=pairKey(collection,combo.a,combo.b);
  if(!key||!eligible.includes(key))violations.push('ineligible_pair:'+combo.a+'+'+combo.b);
  else if(pairKeys.includes(key))violations.push('duplicate_pair:'+combo.a+'+'+combo.b);
  else{pairKeys.push(key);if(index===0)firstPair=key;}
  for(const [id,note] of [[combo.a,combo.noteA],[combo.b,combo.noteB]]){
   const bottle=collection.find(item=>item.id===id);
   if(!bottle?.notes.some(value=>normal(value)===normal(note)))noteViolations.push(id+':'+note);
   // Diagnostic only: do not relax the original one-verbatim-note contract.
   for(const token of note.split(','))if(!token.trim()||!bottle?.notes.some(value=>normal(value)===normal(token)))commaListViolations.push(id+':'+token.trim());
  }
 }
 return {schemaValid:true,constraintsValid:violations.length===0,notesValid:noteViolations.length===0,commaListGrounded:commaListViolations.length===0,coverageValid:parsed.data.combos.length===expectedSlots&&pairKeys.length===expectedSlots,abstentionValid:expectedSlots===0?parsed.data.combos.length===0:null,eligibleCount:eligible.length,expectedSlots,pairKeys,firstPair,violations,noteViolations,commaListViolations};
}
export function compareLayering(left:ReturnType<typeof evaluateLayering>,right:ReturnType<typeof evaluateLayering>){
 if(left.eligibleCount!==right.eligibleCount)throw new Error('Layering cases must share the same oracle.');
 const shared=left.pairKeys.filter(key=>right.pairKeys.includes(key));
 const union=new Set([...left.pairKeys,...right.pairKeys]);
 return {shared,overlapAt3:left.expectedSlots?shared.length/left.expectedSlots:0,returnedSetJaccard:union.size?shared.length/union.size:null,anySame:shared.length>0,topOneSame:left.firstPair!==null&&left.firstPair===right.firstPair,discretionary:left.eligibleCount>3};
}
