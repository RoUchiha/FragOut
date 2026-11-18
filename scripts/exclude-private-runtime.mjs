// Next's platform-specific glob handling must not make private runtime files
// deployment inputs. Apply the configured publication boundary portably.
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
let excluded=0;
const privateFile=path=>/(^|[\\/])(data|\.git)([\\/]|$)|(^|[\\/])credential-key$|\.sqlite(?:-|$)|(^|[\\/])\.env(?!\.example$)/i.test(path);
async function walk(folder){
 for(const entry of await readdir(folder,{withFileTypes:true})){
  const path=join(folder,entry.name);
  if(entry.isDirectory()&&!entry.isSymbolicLink())await walk(path);
  else if(entry.isFile()&&entry.name.endsWith('.nft.json')){
   const trace=JSON.parse(await readFile(path,'utf8')),files=trace.files.filter(file=>!privateFile(file));
   if(files.length!==trace.files.length){excluded+=trace.files.length-files.length;await writeFile(path,JSON.stringify({...trace,files}));}
  }
 }
}
await walk(resolve('.next'));
console.log('Excluded '+excluded+' private runtime paths from deployment inputs.');
