import {z} from 'zod';
import {rankSolo,rankCombos} from './engine.ts';
import type {Bottle,OutfitProfile,PairRecord,Preferences,WearContext} from './types.ts';
const strings=(max:number,length:number)=>z.array(z.string().trim().max(length)).max(max);
export const outfitSchema=z.object({summary:z.string().trim().max(300),garments:strings(10,80),colors:strings(8,30),styleTags:z.array(z.enum(['casual','tailored','minimal','sporty','evening','streetwear','romantic','outdoors'])).max(8),formality:z.enum(['casual','smart','formal']),palette:z.enum(['light','dark','bright','neutral','mixed']),hasOutfit:z.boolean(),uncertainty:strings(5,160)}).strict();
export const bottleCaptureSchema=z.object({candidates:z.array(z.object({brand:z.string().trim().max(100),name:z.string().trim().max(120),concentration:z.enum(['EDT','EDP','PARFUM','ELIXIR','OIL','OTHER','UNKNOWN']),confidence:z.enum(['likely','uncertain']),clue:z.string().max(200)}).strict()).max(3),message:z.string().max(300)}).strict();
export const imageSchema=z.object({mime:z.enum(['image/jpeg','image/png','image/webp']),data:z.string().min(12).max(4*1024*1024)}).strict();
export type ImageInput=z.infer<typeof imageSchema>;
export function validateImage(input:unknown){
 const image=imageSchema.parse(input);
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)||image.data.length%4!==0)throw new Error('Invalid image encoding.');
 const bytes=Buffer.from(image.data,'base64');if(bytes.length>3*1024*1024)throw new Error('Use an image under 3 MB.');
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 const webp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!(image.mime==='image/jpeg'&&jpeg||image.mime==='image/png'&&png||image.mime==='image/webp'&&webp))throw new Error('Image type does not match its contents.');
 return bytes;
}
export function parseOutfitText(text:string):OutfitProfile {
 const input=text.trim().slice(0,1800),low=input.toLowerCase();
 const garments=low.match(/\b(t-?shirt|shirt|blazer|suit|tuxedo|dress|skirt|jeans|trousers|pants|shorts|hoodie|sweater|jumper|jacket|coat|sneakers|trainers|boots|loafers|heels|linen|chinos|leggings|tracksuit)\b/g)??[];
 const colors=low.match(/\b(black|white|grey|gray|navy|blue|green|red|pink|yellow|orange|beige|cream|brown|purple|burgundy|olive)\b/g)??[];
 const tags:OutfitProfile['styleTags']=[];
 if(/suit|tuxedo|blazer|tailor|loafers|formal/.test(low))tags.push('tailored');
 if(/hoodie|jeans|t-?shirt|casual|sneakers|trainers/.test(low))tags.push('casual');
 if(/sport|gym|tracksuit|leggings|athletic/.test(low))tags.push('sporty');
 if(/minimal|simple|monochrome|plain/.test(low))tags.push('minimal');
 if(/evening|dinner|party|club/.test(low))tags.push('evening');
 if(/street|oversized|hoodie/.test(low))tags.push('streetwear');
 if(/floral|romantic|lace/.test(low))tags.push('romantic');
 if(/hiking|outdoors|trail/.test(low))tags.push('outdoors');
 return {summary:input.slice(0,300),garments:[...new Set(garments)],colors:[...new Set(colors)],styleTags:tags,formality:/tuxedo|formal|\bsuit\b/.test(low)?'formal':tags.includes('tailored')?'smart':'casual',palette:colors.some(c=>['red','yellow','pink','orange','purple'].includes(c))?'bright':colors.length&&colors.every(c=>['black','navy','burgundy','brown'].includes(c))?'dark':colors.length&&colors.every(c=>['white','cream','beige'].includes(c))?'light':'neutral',hasOutfit:garments.length>0,uncertainty:['Interpreted from your text with offline rules.']};
}
function styleScore(b:Bottle,p:OutfitProfile){
 const family=(b.family+' '+b.notes.join(' ')).toLowerCase();let score=0;
 if(p.styleTags.includes('sporty')||p.styleTags.includes('casual'))score+=b.strength===1?4:0;
 if(p.styleTags.includes('tailored')||p.formality==='formal')score+=/wood|musk|iris|vetiver|cedar/.test(family)?4:0;
 if(p.styleTags.includes('evening'))score+=b.climate==='WARM'?4:0;
 if(p.styleTags.includes('romantic'))score+=/floral|rose|iris|musk/.test(family)?3:0;
 if(p.styleTags.includes('minimal'))score+=b.strength===1?3:0;
 if(p.styleTags.includes('outdoors'))score+=/wood|fresh|citrus|sage/.test(family)?3:0;
 if(p.palette==='light'||p.palette==='bright')score+=b.climate==='FRESH'?2:0;
 return Math.min(8,score);
}
export function rankForOutfit(bottles:Bottle[],context:WearContext,prefs:Preferences,profile:OutfitProfile,mode:'solo'|'combo'|'both',evidenceMode:'evidence'|'single'|'experimental',records:PairRecord[],excludedPairs:string[][]=[]){
 if(!profile.hasOutfit)return {solo:[],combos:[]};
 const solo=mode==='combo'?[]:rankSolo(bottles,context,prefs,100).map(r=>({...r,score:r.score+styleScore(r.bottle,profile),reasons:[...r.reasons,{ruleId:'v1.outfit',text:`Style heuristic: ${profile.styleTags.join(', ')||profile.formality} outfit with your ${r.bottle.family||'personal scent'} profile. Clothing does not prove scent compatibility.`}]})).sort((a,b)=>b.score-a.score).slice(0,3);
 const combos=mode==='solo'?[]:rankCombos(bottles,context,prefs,evidenceMode,records,excludedPairs,Number.MAX_SAFE_INTEGER).map(r=>({...r,score:r.score+(styleScore(r.a,profile)+styleScore(r.b,profile))/2})).sort((a,b)=>b.score-a.score).slice(0,3);
 return {solo,combos};
}
