export interface OcrLine {text:string;left:number;right:number;top:number;bottom:number}
export interface OcrWord extends OcrLine {confidence:number}
export function parseOcrTsv(tsv:string){
 const words:OcrWord[]=[],lines=new Map<string,OcrLine>();
 for(const row of tsv.split('\n')){
  const fields=row.split('\t'),[level,page,block,paragraph,line]=fields,text=fields[11]?.trim();
  if(level!=='5'||!text)continue;
  const [left,top,width,height,confidence]=fields.slice(6,11).map(Number);
  if(![left,top,width,height,confidence].every(Number.isFinite)||Math.min(left,top,width,height,confidence)<0)continue;
  const word={text,left,right:left+width,top,bottom:top+height,confidence};words.push(word);
  if(confidence<65)continue;
  const key=[page,block,paragraph,line].join(':'),previous=lines.get(key);
  lines.set(key,previous?{text:previous.text+' '+text,left:Math.min(previous.left,left),right:Math.max(previous.right,word.right),top:Math.min(previous.top,top),bottom:Math.max(previous.bottom,word.bottom)}:word);
 }
 return {lines:[...lines.values()],words};
}
export function supplementShortLines(base:OcrLine[],additional:OcrWord[]){
 const output:string[]=[];
 for(let i=0;i<base.length;i++){
  const previous=base[i],next=base[i+1];output.push(previous.text);if(!next)continue;
  const py=(previous.top+previous.bottom)/2,ny=(next.top+next.bottom)/2;
  const height=Math.max(previous.bottom-previous.top,next.bottom-next.top);
  const left=Math.max(previous.left,next.left),right=Math.min(previous.right,next.right);
  if(height<=0||ny<=py||ny-py>height*3||right<=left)continue;
  const candidates=additional.filter(word=>{
   const x=(word.left+word.right)/2,y=(word.top+word.bottom)/2;
   const alreadyRead=base.some(line=>line.text.split(/\s+/).some(token=>token.toLowerCase()===word.text.toLowerCase())&&y>=line.top&&y<=line.bottom);
   return !alreadyRead&&word.confidence>=85&&/^[A-Za-z]{1,3}$/.test(word.text)&&word.right-word.left<=right-left&&x>=left&&x<=right&&y>py&&y<ny;
  });
  // Conflicting/multiple tiny words remain unknown. Never fill from a catalog.
  if(candidates.length===1)output.push(candidates[0].text);
 }
 return output.join('\n');
}
