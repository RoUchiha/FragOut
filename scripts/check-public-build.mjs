import assert from 'node:assert/strict';
import {readdir,readFile,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
let traces=0,assets=0;
const privateFile=path=>/(^|[\\/])(data|\.git)([\\/]|$)|(^|[\\/])credential-key$|\.sqlite(?:-|$)|(^|[\\/])\.env(?!\.example$)/i.test(path);
async function walk(folder,visit){for(const entry of await readdir(folder,{withFileTypes:true})){const path=join(folder,entry.name);assert.ok(!(await lstat(path)).isSymbolicLink(),'A generated/public file cannot be a link: '+path);if(entry.isDirectory())await walk(path,visit);else await visit(path);}}
// Deployment tools can copy every trace dependency, so private files must not be traced.
async function tracesIn(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const path=join(folder,entry.name);if(entry.isDirectory()&&!entry.isSymbolicLink())await tracesIn(path);else if(entry.isFile()&&entry.name.endsWith('.nft.json')){traces++;const trace=JSON.parse(await readFile(path,'utf8'));for(const file of trace.files)assert.ok(!privateFile(file),'Private file in deployment trace: '+file);}}}
await tracesIn(resolve('.next'));
await walk(resolve('public'),async path=>{assets++;assert.ok(!privateFile(path),'Private file in public assets: '+path);assert.ok(!path.endsWith('.map'),'Source map in public assets: '+path);});
assert.ok(traces>0&&assets>0,'Build and mobile export must exist before verifying publication boundaries.');
console.log(`Publication check passed: ${traces} traces and ${assets} public assets; no private database, keys, environment files or source maps.`);
