export async function readLimitedBody(response:Response,limit:number):Promise<Buffer|null> {
 const reader=response.body?.getReader();
 if(!reader) return null;
 const chunks:Uint8Array[]=[];
 let bytes=0;
 try {
  if(Number(response.headers.get('content-length'))>limit) {
   await reader.cancel();
   return null;
  }
  while(true) {
   const {done,value}=await reader.read();
   if(done) return Buffer.concat(chunks,bytes);
   bytes+=value.byteLength;
   if(bytes>limit) {
    await reader.cancel();
    return null;
   }
   chunks.push(value);
  }
 } finally {
  reader.releaseLock();
 }
}
