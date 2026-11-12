import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader:false,
  outputFileTracingExcludes:{'/*':['./data/**/*','./.env*','./**/*.sqlite','./**/*.sqlite-*','./**/credential-key','./mobile/native-dist/**/*','./mobile/node_modules/**/*']},
  serverExternalPackages: ['node:sqlite','postgres'],
  async rewrites(){return [{source:'/_expo/:path*',destination:'/mobile/_expo/:path*'}];},
  async headers() { return [{source:'/(.*)',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Referrer-Policy',value:'no-referrer'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Permissions-Policy',value:'camera=(self), geolocation=(self), microphone=(self)'}
  ]}]; }
};
export default config;
