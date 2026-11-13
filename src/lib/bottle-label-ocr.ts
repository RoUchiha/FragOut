import {dirname,join} from 'node:path';
import sharp from 'sharp';
import {createWorker,OEM,PSM,type Worker} from 'tesseract.js';
import english from '@tesseract.js-data/eng';
import type {ImageInput} from './outfit.ts';

const englishData = join(dirname(english.langPath), '4.0.0_best_int');

async function readPass(worker:Worker,jpeg:Buffer,threshold:boolean){
 const image = sharp(jpeg).resize({width:1250,height:1550,fit:'inside'}).grayscale();
 const pixels = await (threshold?image.threshold(165):image).png().toBuffer();
 try {
  const {data} = await worker.recognize(pixels,{}, {tsv:true,text:false});
  const lines = new Map<string,string[]>();
  for (const row of data.tsv?.split('\n')??[]) {
   const [level,page,block,paragraph,line,,,,,,confidence,word] = row.split('\t');
   if (level!=='5'||Number(confidence)<65||!word?.trim())continue;
   const key = [page,block,paragraph,line].join(':');
   const words = lines.get(key)??[];
   words.push(word.trim());
   lines.set(key,words);
  }
  return [...lines.values()].map(words=>words.join(' ')).join('\n');
 } finally { pixels.fill(0); }
}

export async function readBottleLabel(image:ImageInput):Promise<string[]> {
 const jpeg=Buffer.from(image.data,'base64');
 let worker:Worker|undefined;
 let timer:ReturnType<typeof setTimeout>|undefined;
 let ended=false;
 const read=async()=>{
  worker=await createWorker('eng',OEM.LSTM_ONLY,{langPath:englishData,cacheMethod:'none',errorHandler:()=>{}});
  if(ended){await worker.terminate();return [];}
  await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT});
  return [await readPass(worker,jpeg,false),await readPass(worker,jpeg,true)].filter(Boolean);
 };
 try {
  return await Promise.race([read(),new Promise<never>((_,reject)=>{
   timer=setTimeout(()=>reject(new Error('Bottle label reading timed out.')),20000);
  })]);
 } finally {
  ended=true;
  clearTimeout(timer);
  jpeg.fill(0);
  await worker?.terminate();
 }
}
