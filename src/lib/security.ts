const loopback=(hostname:string)=>['localhost','127.0.0.1','[::1]'].includes(hostname.toLowerCase());
const privateLan=(hostname:string)=>/^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/.test(hostname);
export function requestPolicy(url:URL,headers:Headers,configured=process.env.FRAGOUT_PUBLIC_ORIGIN){
 let publicUrl:URL|undefined;
 if(configured){
  publicUrl=new URL(configured);
  const developmentLan=process.env.NODE_ENV==='development'&&process.env.FRAGOUT_ALLOW_LAN_HTTP==='true'&&publicUrl.protocol==='http:'&&privateLan(publicUrl.hostname);
  if(publicUrl.username||publicUrl.password||publicUrl.search||publicUrl.hash||publicUrl.pathname!=='/'||(publicUrl.protocol!=='https:'&&!loopback(publicUrl.hostname)&&!developmentLan))throw new Error('Configure a secure public origin without a path.');
 }
 const reject=(status:number,error:string)=>({status,error,secureCookie:false,origin:''});
 let authority:URL;try{authority=new URL(url.protocol+'//'+(headers.get('host')??url.host));}catch{return reject(421,'Unrecognized request host.');}
 if(authority.username||authority.password||authority.pathname!=='/'||authority.search||authority.hash)return reject(421,'Unrecognized request host.');
 let origin:string;
 if(loopback(authority.hostname))origin=authority.origin;
 else if(publicUrl&&new URL(publicUrl.protocol+'//'+authority.host).host===publicUrl.host){
  if(publicUrl.protocol==='https:'&&url.protocol!=='https:')return {status:426,error:'HTTPS is required for this server.',secureCookie:true,origin:publicUrl.origin};
  origin=publicUrl.origin;
 }
 else return reject(421,'Unrecognized request host.');
 const incoming=headers.get('origin');
 if(incoming!==null&&incoming!==origin)return reject(403,'This request must come from FragOut.');
 if(url.pathname.startsWith('/api/')&&headers.get('sec-fetch-site')==='cross-site')return reject(403,'Cross-site data requests are not accepted.');
 return {status:200,error:'',origin,secureCookie:origin.startsWith('https:')||process.env.FRAGOUT_SECURE_COOKIES==='true'};
}

export function contentPolicy(nonce:string,development=false){
 return ["default-src 'self'",`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development?" 'unsafe-eval'":''}`,"style-src 'self' 'unsafe-inline'","img-src 'self' blob: data:","font-src 'self' data:",`connect-src 'self'${development?' ws:':''}`,"worker-src 'self' blob:","media-src 'self' blob:","object-src 'none'","base-uri 'none'","form-action 'self'","frame-ancestors 'none'"].join('; ');
}

export function localModelUrl(value=process.env.FRAGOUT_OLLAMA_URL??'http://127.0.0.1:11434'){
 const url=new URL(value);
 if(!loopback(url.hostname)||!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('The local model endpoint must be a loopback origin.');
 return url.origin;
}
