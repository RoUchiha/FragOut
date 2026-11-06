'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="boot-screen"><h1>Let’s try that again.</h1><p>FragOut couldn’t load this view. Your saved collection is still on this computer.</p><button className="button primary" onClick={reset}>Try again</button></main>;}
