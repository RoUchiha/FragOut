import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';

const project=fileURLToPath(new URL('../',import.meta.url)),work=resolve(project,'..','..','work');
await mkdir(work,{recursive:true});
const directory=await mkdtemp(join(work,'security-lab-')),database=join(directory,'state.sqlite');
const port=Number(process.env.FRAGOUT_SECURITY_PORT??3210),base=`http://127.0.0.1:${port}`;
const profile={summary:'A white shirt and navy trousers.',garments:['shirt','trousers'],colors:['white','navy'],styleTags:['casual'],formality:'smart',palette:'neutral',hasOutfit:true,uncertainty:[]};
const inputs=[],delayed=new Map();let calls=0;
const model=createServer(async(req,res)=>{
 const path=req.url??'';
 if(path==='/api/tags'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({models:[{name:'qwen3-vl:2b-instruct'}]}));return;}
 if(path==='/__status'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({calls,delayed:[...delayed.keys()]}));return;}
 if(path.startsWith('/__release/')){delayed.get(path.slice('/__release/'.length))?.();res.end('released');return;}
 if(path==='/__inputs'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(inputs));return;}
 if(path!=='/api/chat'){res.statusCode=404;res.end();return;}
 const chunks=[];for await(const chunk of req)chunks.push(chunk);
 const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));calls++;inputs.push(input);
 const text=input.messages?.at(-1)?.content??'',tag=text.match(/DELAY-([A-Z]+)/)?.[1];
 if(tag)await new Promise(done=>delayed.set(tag,()=>{delayed.delete(tag);done();}));
 const bottle=input.messages?.[0]?.content?.includes('ONE fragrance bottle');
 const output=bottle?{candidates:[{brand:'Synthetic house',name:'Synthetic label',concentration:'EDP',confidence:'uncertain',clue:'Synthetic test fixture only.'}],message:'Check the exact label before saving.'}:text.includes('INJECT_PRODUCT_IDS')?{...profile,fragranceIds:['unowned-injected-id']}:profile;
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify({message:{content:JSON.stringify(output)}}));
});
await new Promise(done=>model.listen(0,'127.0.0.1',done));
const modelBase=`http://127.0.0.1:${model.address().port}`;
const env={...process.env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',FRAGOUT_DB:database,FRAGOUT_VAULT_KEY:randomBytes(32).toString('base64'),FRAGOUT_OLLAMA_URL:modelBase,FRAGOUT_SECURE_COOKIES:'false'};
delete env.FRAGOUT_PUBLIC_ORIGIN;delete env.FRAGOUT_ALLOW_LAN_HTTP;
const child=spawn(process.execPath,[join(project,'node_modules','next','dist','bin','next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:project,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
child.stdout.on('data',chunk=>process.stdout.write(chunk));child.stderr.on('data',chunk=>process.stderr.write(chunk));
let stopped=false;
async function stop(){if(stopped)return;stopped=true;for(const release of delayed.values())release();child.kill();model.closeAllConnections();await new Promise(done=>model.close(done));inputs.length=0;}
process.on('SIGINT',()=>void stop().then(()=>process.exit(0)));process.on('SIGTERM',()=>void stop().then(()=>process.exit(0)));
for(let i=0;i<80;i++){
 try{const response=await fetch(base+'/api/health');if(response.ok)break;}catch{}
 if(child.exitCode!==null)throw new Error('Isolated app exited before startup.');
 if(i===79)throw new Error('Isolated app did not start.');await new Promise(done=>setTimeout(done,100));
}
const manifest={base,modelBase,database,directory,createdAt:new Date().toISOString()};
const manifestFile=join(work,'security-lab-run.json');await writeFile(manifestFile,JSON.stringify(manifest,null,2));
console.log('SECURITY_LAB_READY '+JSON.stringify({base,manifestFile,syntheticOnly:true,externalProviderCalls:false}));
if(process.argv.includes('--test')){
 const test=spawn(process.execPath,['tests/security-http.mjs'],{cwd:project,env:{...process.env,FRAGOUT_SECURITY_RUN:manifestFile},windowsHide:true,stdio:'inherit'});
 const code=await new Promise(done=>test.on('exit',done));await stop();process.exitCode=code??1;
}
