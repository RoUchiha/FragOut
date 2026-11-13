import {z} from 'zod';
import {rankSolo,rankCombos} from './engine.ts';
import type {Bottle,OutfitProfile,PairRecord,Preferences,WearContext} from './types.ts';
const strings=(max:number,length:number)=>z.array(z.string().trim().max(length)).max(max);
export const outfitSchema=z.object({summary:z.string().trim().max(300),garments:strings(10,80),colors:strings(8,30),styleTags:z.array(z.enum(['casual','tailored','minimal','sporty','evening','streetwear','romantic','outdoors'])).max(8),formality:z.enum(['casual','smart','formal']),palette:z.enum(['light','dark','bright','neutral','mixed']),hasOutfit:z.boolean(),uncertainty:strings(5,160)}).strict();
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
const garmentWords=/\b(t-?shirts?|shirts?|blouses?|tops?|polos?|blazers?|suits?|tuxedos?|dresses?|skirt[s]?|jeans|trousers|pants|shorts|hoodies?|sweaters?|jumpers?|jackets?|coats?|sneakers?|trainers?|boots?|loafers?|heels?|chinos|leggings|tracksuits?|shoes?|socks?|sandals?|scarves?|scarfs?|hats?|caps?|ties?|cardigans?|vests?|uniforms?|outfits?|bodysuits?|jumpsuits?|abaya[s]?|kimonos?)\b/i;
const colorWords=/\b(black|white|grey|gray|navy|blue|green|red|pink|yellow|orange|beige|cream|brown|purple|burgundy|olive|tan|teal|gold|silver)\b/gi;
const unique=(items:string[])=>[...new Map(items.map(s=>[s.toLowerCase(),s])).values()];
const paletteFor=(colors:string[]):OutfitProfile['palette']=>{
 if(colors.some(color=>['red','yellow','pink','orange','purple'].includes(color)))return 'bright';
 if(colors.length&&colors.every(color=>['black','navy','burgundy','brown'].includes(color)))return 'dark';
 if(colors.length&&colors.every(color=>['white','cream','beige'].includes(color)))return 'light';
 return 'neutral';
};
export const unidentifiedOutfit:OutfitProfile={summary:'',garments:[],colors:[],styleTags:[],formality:'casual',palette:'neutral',hasOutfit:false,uncertainty:[]};

export function parseOutfitText(text:string):OutfitProfile {
 const input=text.trim().slice(0,1800);
 const positive=input.toLowerCase().replace(/\b(?:no|without|not wearing|don['’]t wear)\b[^.!?;]*(?=[.!?;]|$)/g,'');
 const garments=unique(positive.match(new RegExp(garmentWords.source,'g'))??[]).slice(0,10);
 if(!garments.length)return unidentifiedOutfit;
 const colors=unique(positive.match(colorWords)??[]).slice(0,8);
 const tags:OutfitProfile['styleTags']=[];
 if(/\b(tuxedos?|suits?|blazers?|tailored)\b/.test(positive))tags.push('tailored');
 if(/\b(hoodies?|jeans|t-?shirts?|casual|sneakers?|trainers?)\b/.test(positive))tags.push('casual');
 if(/\b(sporty|gym|tracksuits?|leggings|athletic)\b/.test(positive))tags.push('sporty');
 if(/\b(minimal|monochrome)\b/.test(positive))tags.push('minimal');
 if(/\b(evening|dinner|party|club)\b/.test(positive))tags.push('evening');
 if(/\b(streetwear|oversized)\b/.test(positive))tags.push('streetwear');
 if(/\b(floral|romantic|lace)\b/.test(positive))tags.push('romantic');
 if(/\b(hiking|outdoors|trail)\b/.test(positive))tags.push('outdoors');
 return {summary:input.slice(0,300),garments,colors,styleTags:tags,formality:/\b(tuxedos?|formal|suits?)\b/.test(positive)?'formal':/\b(smart|tailored|blazers?)\b/.test(positive)?'smart':'casual',palette:paletteFor(colors),hasOutfit:true,uncertainty:[]};
}

export function reviewPhotoOutfit(candidate:OutfitProfile):OutfitProfile {
 if(!candidate.hasOutfit)return unidentifiedOutfit;
 const garments=unique(candidate.garments.filter(item=>garmentWords.test(item)));
 if(!garments.length)return unidentifiedOutfit;
 const colors=unique(candidate.colors.flatMap(color=>color.toLowerCase().match(colorWords)??[])).slice(0,8);
 const evidence=parseOutfitText(garments.join(', '));
 const summary=colors.length
  ? garments.join(', ')+'. Colors: '+colors.join(', ')+'.'
  : garments.join(', ')+'.';
 return {...evidence,summary:summary.slice(0,300),garments,colors,palette:paletteFor(colors),hasOutfit:true,
  uncertainty:['Check the clothing and colors against your photo before continuing.']};
}
function styleScore(b:Bottle,p:OutfitProfile){
 const family=(b.family+' '+b.notes.join(' ')).toLowerCase();let score=0;
 if((p.styleTags.includes('sporty')||p.styleTags.includes('casual'))&&!b.strengthUnknown&&b.strength===1)score+=4;
 if(p.styleTags.includes('tailored')||p.formality==='formal')score+=/wood|musk|iris|vetiver|cedar/.test(family)?4:0;
 if(p.styleTags.includes('evening'))score+=b.climate==='WARM'?4:0;
 if(p.styleTags.includes('romantic'))score+=/floral|rose|iris|musk/.test(family)?3:0;
 if(p.styleTags.includes('minimal')&&!b.strengthUnknown&&b.strength===1)score+=3;
 if(p.styleTags.includes('outdoors'))score+=/wood|fresh|citrus|sage/.test(family)?3:0;
 if(p.palette==='light'||p.palette==='bright')score+=b.climate==='FRESH'?2:0;
 return Math.min(8,score);
}
export function rankForOutfit(bottles:Bottle[],context:WearContext,prefs:Preferences,profile:OutfitProfile,mode:'solo'|'combo'|'both',evidenceMode:'evidence'|'single'|'experimental',records:PairRecord[],excludedPairs:string[][]=[]){
 if(!profile.hasOutfit)return {solo:[],combos:[]};
 const solo=mode==='combo'?[]:rankSolo(bottles,context,prefs,100).map(r=>{
  const style=styleScore(r.bottle,profile);
  const reason=style>0?'Style heuristic uses your reviewed clothing details and this fragrance profile.':'Uses your fragrance profile, occasion and preferences.';
  return {...r,score:r.score+style,reasons:[...r.reasons,{ruleId:'v1.outfit',text:reason}]};
 }).sort((a,b)=>b.score-a.score).slice(0,3);
 const combos=mode==='solo'?[]:rankCombos(bottles,context,prefs,evidenceMode,records,excludedPairs,Number.MAX_SAFE_INTEGER).map(r=>({...r,score:r.score+(styleScore(r.a,profile)+styleScore(r.b,profile))/2})).sort((a,b)=>b.score-a.score).slice(0,3);
 return {solo,combos};
}
