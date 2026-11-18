import type {Metadata,Viewport} from 'next';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/manrope';
import './globals.css';
import {runtimeEnvironment} from '@/lib/environment';
export const metadata:Metadata={title:'FragOut',description:'Manage your fragrance collection and choose what to wear.',manifest:'/manifest.webmanifest',icons:{icon:'/icon.svg',apple:'/icon.svg'},appleWebApp:{capable:true,statusBarStyle:'default',title:'FragOut'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#f7f8f2'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{runtimeEnvironment()==='staging'&&<aside className="test-environment" role="status">Private test environment</aside>}{children}</body></html>;}
