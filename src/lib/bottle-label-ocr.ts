import {join} from 'node:path';
import sharp from 'sharp';
import type {Worker} from 'tesseract.js';
import type {ImageInput} from './outfit.ts';
import {parseOcrTsv,supplementShortLines} from './bottle-ocr-lines.ts';

const englishData = join(process.cwd(),'node_modules','@tesseract.js-data','eng','4.0.0_best_int');

async function readPass(worker:Worker,jpeg:Buffer,threshold:false|number){
 const image = sharp(jpeg).resize({width:1250,height:1550,fit:'inside'}).grayscale();
  const pixels = await (threshold?image.threshold(threshold):image).png().toBuffer();
 try {
  const {data} = await worker.recognize(pixels,{}, {tsv:true,text:false});
  return parseOcrTsv(data.tsv??'');
 } finally { pixels.fill(0); }
}

export async function readBottleLabel(image:ImageInput):Promise<string[]> {
 const jpeg=Buffer.from(image.data,'base64');
 let worker:Worker|undefined;
 let timer:ReturnType<typeof setTimeout>|undefined;
 let ended=false;
 const read=async()=>{
  const {createWorker,OEM,PSM}=await import('tesseract.js');
  worker=await createWorker('eng',OEM.LSTM_ONLY,{langPath:englishData,cacheMethod:'none',errorHandler:()=>{}});
  if(ended){await worker.terminate();return [];}
  await worker.setParameters({tessedit_pageseg_mode:PSM.SPARSE_TEXT});
  const primary=[await readPass(worker,jpeg,false),await readPass(worker,jpeg,165)],extra=await readPass(worker,jpeg,200);
  return [...new Set([...primary,extra].map(pass=>pass.lines.map(line=>line.text).join('\n')).concat(primary.map(pass=>supplementShortLines(pass.lines,extra.words))).filter(Boolean))];
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
