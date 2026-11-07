import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['node:sqlite'],
  async rewrites(){return [{source:'/mobile',destination:'/mobile/index.html'},{source:'/_expo/:path*',destination:'/mobile/_expo/:path*'}];},
  async headers() { return [{source:'/(.*)',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Permissions-Policy',value:'camera=(self), geolocation=(self), microphone=(self)'}
  ]}]; }
};
export default config;
