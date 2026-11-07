import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {NextRequest,NextResponse} from 'next/server';
import {contentPolicy,requestPolicy} from '@/lib/security';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const policy=requestPolicy(req.nextUrl,req.headers);
 if(policy.status!==200)return NextResponse.json({error:policy.error},{status:policy.status});
 const nonce=randomBytes(24).toString('base64'),html=await readFile(join(process.cwd(),'public','mobile','index.html'),'utf8');
 const protectedHtml=html.replace(/<script\b/gi,`<script nonce="${nonce}"`);
 return new NextResponse(protectedHtml,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':contentPolicy(nonce,process.env.NODE_ENV==='development'),'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin'}});
}
