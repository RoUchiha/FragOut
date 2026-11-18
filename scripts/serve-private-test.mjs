import {createPrivateKey} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:https';
import {createRequire} from 'node:module';
import {BlockList,isIPv4} from 'node:net';
import {networkInterfaces} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {privateDataPath} from '../src/lib/private-path.ts';

const [host,portText,certificate,database]=process.argv.slice(2),port=Number(portText);
const socket=Object.values(networkInterfaces()).flat().find(item=>item?.address===host&&!item.internal);
if(!isIPv4(host)||!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)||!socket?.cidr||!Number.isInteger(port)||port<1024||port>65535)throw new Error('Use an active private LAN address and an unprivileged port.');
const appDir=fileURLToPath(new URL('../',import.meta.url)),authority=host+':'+port,testDatabase=privateDataPath(resolve(database));
// No production, backup, deployment or provider credential is inherited.
for(const key of Object.keys(process.env))if(/(?:TOKEN|PASSWORD|SECRET|DATABASE|VAULT|API_KEY|ACCESS_KEY)/i.test(key)||key.startsWith('VERCEL'))delete process.env[key];
process.chdir(appDir);process.env.NODE_ENV='production';process.env.FRAGOUT_ENVIRONMENT='staging';
process.env.FRAGOUT_PUBLIC_ORIGIN='https://'+authority;process.env.FRAGOUT_DB=testDatabase;
process.env.FRAGOUT_OLLAMA_URL='http://127.0.0.1:11434';process.env.FRAGOUT_ACCESS_LOGS='true';
const peers=new BlockList();peers.addSubnet(host,Number(socket.cidr.split('/')[1]),'ipv4');
const next=createRequire(join(appDir,'package.json'))('next'),app=next({dev:false,dir:appDir,hostname:host,port});
await app.prepare();const handle=app.getRequestHandler();
const der=Buffer.from(readFileSync(0,'ascii').trim(),'base64'),key=createPrivateKey({key:der,format:'der',type:'pkcs8'});der.fill(0);
const server=createServer({key:key.export({format:'pem',type:'pkcs8'}),cert:readFileSync(certificate),minVersion:'TLSv1.2'},async(req,res)=>{
 const peer=req.socket.remoteAddress;
 if(!peer||!isIPv4(peer)||!peers.check(peer,'ipv4')||req.headers.host!==authority||!req.url?.startsWith('/')||req.url.startsWith('//')){res.writeHead(421,{'Cache-Control':'no-store'}).end();return;}
 delete req.headers.forwarded;req.headers['x-forwarded-for']=peer;req.headers['x-forwarded-host']=authority;req.headers['x-forwarded-port']=portText;req.headers['x-forwarded-proto']='https';
 try{await handle(req,res);}catch{if(!res.headersSent)res.writeHead(503,{'Cache-Control':'no-store','Content-Type':'application/json'});res.end('{"error":"Temporarily unavailable. Try again shortly."}');}
});
server.headersTimeout=10000;server.requestTimeout=180000;server.keepAliveTimeout=5000;server.maxHeadersCount=64;
server.listen(port,host,()=>console.log('Private FragOut test app: https://'+authority+'/mobile'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>void app.close().finally(()=>process.exit(0))));
