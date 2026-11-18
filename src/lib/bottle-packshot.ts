import type {Sharp} from 'sharp';

export async function looksLikePackshot(photo:Sharp,detailed:boolean) {
 const side=64;
 const pixels=await photo.clone().resize(side,side,{fit:'fill'}).toColourspace('srgb').ensureAlpha().raw().toBuffer();
 let transparent=0;
 for(let offset=3;offset<pixels.length;offset+=4) if(pixels[offset]<25) transparent++;
 const cutout=transparent>=side*side*0.35;
 if(!detailed&&!cutout) return false;
 const rows=new Uint8Array(side);
 const columns=new Uint8Array(side);
 let top=side,bottom=-1,left=side,right=-1;
 for(let y=0;y<side;y++) {
  let first=side,last=-1;
  for(let x=0;x<side;x++) {
   const offset=4*(y*side+x);
   const alpha=pixels[offset+3];
   const foreground=cutout?alpha>=120:(255-Math.min(pixels[offset],pixels[offset+1],pixels[offset+2]))*alpha>=27*255;
   if(!foreground) continue;
   first=Math.min(first,x);
   last=x;
   columns[x]++;
  }
  if(last<0) continue;
  rows[y]=last-first+1;
  top=Math.min(top,y);
  bottom=y;
  left=Math.min(left,first);
  right=Math.max(right,last);
 }
 const height=bottom-top+1;
 const width=right-left+1;
 if(top<2||left<2||bottom>side-3||right>side-3||height<22||width<8||width>50||Math.abs(left+right-side+1)>15) return false;
 const subject=[rows.slice(top,bottom+1),columns.slice(left,right+1)];
 if(subject.some(axis=>axis.some((count,i)=>!count&&!axis[i+1]))) return false;
 const upperRows=rows.slice(top+1,top+1+Math.max(4,Math.round(height*0.1))).sort();
 const cap=upperRows[Math.floor((upperRows.length-1)/2)];
 const body=Math.max(...rows.slice(top+Math.round(height*0.35),top+Math.round(height*0.72)));
 return cap>=2&&cap<=body*(detailed?0.94:0.83);
}
