import {randomBytes} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {contentPolicy,requestPolicy} from './lib/security';

export function proxy(req:NextRequest){
 const policy=requestPolicy(req.nextUrl,req.headers);
 if(policy.status===426&&req.method==='GET'&&!req.nextUrl.pathname.startsWith('/api/'))return NextResponse.redirect(new URL(req.nextUrl.pathname+req.nextUrl.search,policy.origin),308);
 if(policy.status!==200)return NextResponse.json({error:policy.error},{status:policy.status,headers:{'Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}});
 if(['/mobile/index.html','/mobile/'].includes(req.nextUrl.pathname)){
  const url=req.nextUrl.clone();url.pathname='/mobile';return NextResponse.redirect(url,307);
 }
 const nonce=randomBytes(24).toString('base64'),csp=contentPolicy(nonce,process.env.NODE_ENV==='development');
 const headers=new Headers(req.headers);headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',csp);
 const response=NextResponse.next({request:{headers}});
 if(req.nextUrl.pathname!=='/mobile')response.headers.set('Content-Security-Policy',req.nextUrl.pathname.startsWith('/api/')?"default-src 'none'; frame-ancestors 'none'; base-uri 'none'":csp);
 response.headers.set('Referrer-Policy','no-referrer');response.headers.set('Cross-Origin-Resource-Policy','same-origin');response.headers.set('Cross-Origin-Opener-Policy','same-origin');
 if(req.nextUrl.pathname.startsWith('/api/'))response.headers.set('Cache-Control','no-store');
 if(policy.secureCookie)response.headers.set('Strict-Transport-Security','max-age=31536000');
 return response;
}
export const config={matcher:'/:path*'};
