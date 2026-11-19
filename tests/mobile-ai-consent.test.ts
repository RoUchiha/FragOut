import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as collectionBrowse from '../src/lib/collection-browse.ts';
import * as catalogPhotos from '../src/lib/catalog-photos.ts';

type Provider = 'qwen' | 'openai' | 'claude';
type Element = { type: string; props: { children?: unknown; label?: string; disabled?: boolean; onPress?: () => void; onClose?: () => void; onChangeText?: (value: string) => void } };

function screen(name: 'Collection' | 'Outfit', provider: Provider, qwen?:{mode:'hosted';configured:boolean;destination:string;model:string;policyVersion:string}) {
 const hooks: unknown[] = [];
 const effects: (() => void | (() => void))[] = [];
 const cleanups: (() => void)[] = [];
 const requests: { path: string; body: { provider: Provider; image?: { data: string }; text?: string } }[] = [];
 const photo = { uri: 'file:///synthetic-cache/bottle.jpg', mime: 'image/jpeg', data: 'synthetic' };
 let cursor = 0;
 let current = true;
 const react = {
  createElement: (type: string, props: Element['props'], ...children: unknown[]): Element => ({ type, props: { ...props, children } }),
  useState<T>(initial: T | (() => T)) {
   const index = cursor++;
   if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? (initial as () => T)() : initial;
   return [hooks[index], (next: T) => { hooks[index] = next; }];
  },
  useRef<T>(initial: T) { const index = cursor++; return hooks[index] ??= { current: initial }; },
  useCallback<T>(callback: T) { return callback; },
  useEffect(effect: () => void | (() => void)) { const index = cursor++; if (!(index in hooks)) { hooks[index] = true; effects.push(effect); } },
 };
 function load(file: string): { default: (props: object) => Element } {
  const module = { exports: {} as { default: (props: object) => Element } };
  const source = readFileSync(new URL(`../mobile/src/${file}`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, require: (dependency: string) => {
   if (dependency === 'react') return react;
   if (dependency === './api') return {
    sessionScope: () => () => current,
    api: async (path: string, method: string, body: (typeof requests)[number]['body']) => {
     if (method === 'POST') requests.push({ path, body: structuredClone(body) });
     return { selected: provider, candidates: [{}], profile: null, qwen };
    },
   };
   if (dependency === './capture') return {
    capturePhoto: async () => photo,
    discardPhoto: async (value: typeof photo | null) => { if (value) value.data = ''; },
   };
   if (dependency === './cloud-ai') return load('cloud-ai.ts');
   if (dependency === '../../src/lib/collection-browse') return collectionBrowse;
   if (dependency === '../../src/lib/catalog-photos') return catalogPhotos;
   if (dependency === './ui') return new Proxy({ useUi: () => ({ styles: {}, colors: {} }) }, { get: (target, key) => key === 'useUi' ? target.useUi : key });
   if (dependency === 'react-native' || dependency === 'lucide-react-native') return new Proxy({}, { get: (_target, key) => key });
   return {};
  }});
  return module.exports;
 }
 const Screen = load(`${name}.tsx`).default;
 function render() {
  cursor = 0;
  const tree = Screen({ state: { bottles: [],history:[],preferences:{} }, onError: () => {}, notify: () => {} });
  for (const effect of effects.splice(0)) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
  return tree;
 }
 function visit(node: unknown, match: (element: Element) => boolean): Element | undefined {
  if (Array.isArray(node)) { for (const child of node) { const result = visit(child, match); if (result) return result; } return; }
  if (!node || typeof node !== 'object' || !('props' in node)) return;
  const element = node as Element;
  return match(element) ? element : visit(element.props.children, match);
 }
 function action(label: string) {
  const button = visit(render(), element => element.props.label === label);
  assert.ok(button?.props.onPress && !button.props.disabled, `Expected an enabled action labeled ${label}`);
  button.props.onPress();
 }
 function disclosure(pattern: RegExp) {
  return visit(render(), element => element.type === 'Text' && Array.isArray(element.props.children) && element.props.children.every(child => typeof child === 'string') && pattern.test(element.props.children.join('')));
 }
 function changeOutfitText(value: string) {
  const input = visit(render(), element => element.props.label === 'Or describe your outfit');
  assert.ok(input?.props.onChangeText);
  input.props.onChangeText(value);
 }
 const flush = () => new Promise<void>(resolve => setImmediate(resolve));
 render();
 return { action, changeOutfitText, disclosure, flush, photo, requests, changeSession: () => { current = false; }, closeSheet: () => visit(render(), element => element.type === 'Sheet')?.props.onClose?.(), unmount: () => cleanups.forEach(cleanup => cleanup()) };
}

const hostedQwen={mode:'hosted' as const,configured:true,destination:'Vercel AI Gateway',model:'alibaba/qwen3.8-27b',policyVersion:'qwen-cloud-v1'};
const qwenConsent={destination:hostedQwen.destination,model:hostedQwen.model,policyVersion:hostedQwen.policyVersion};
test('free Qwen disclosure names Groq and sends only its reviewed destination',async()=>{
 const qwen={...hostedQwen,destination:'Groq',model:'qwen/qwen3.8-27b',policyVersion:'qwen-groq-free-v1',cost:'free' as const,paidEnabled:false};
 const app=screen('Outfit','qwen',qwen);await app.flush();app.action('Take selfie');await app.flush();
 assert.ok(app.disclosure(/outfit photo.*Qwen Cloud.*Groq/i));assert.deepEqual(app.requests,[]);
 app.action('Send to Qwen Cloud');await app.flush();
 assert.deepEqual(app.requests,[{path:'outfit/analyze',body:{provider:'qwen',archivePhoto:false,image:{data:'synthetic',mime:'image/jpeg'},cloudConsent:{destination:'Groq',model:'qwen/qwen3.8-27b',policyVersion:'qwen-groq-free-v1'}}}]);
});
test('hosted Qwen bottle scanning waits for cloud permission and binds the approved destination',async()=>{
 const app=screen('Collection','qwen',hostedQwen);await app.flush();app.action('Scan bottle');await app.flush();
 assert.deepEqual(app.requests,[]);assert.ok(app.disclosure(/bottle photo.*Qwen Cloud/i));
 app.action('Send to Qwen Cloud');await app.flush();
 assert.deepEqual(app.requests,[{path:'vision/bottle',body:{provider:'qwen',image:{data:'synthetic',mime:'image/jpeg'},cloudConsent:qwenConsent}}]);
});
test('hosted Qwen selfies disclose cloud processing before the user sends the photo',async()=>{
 const app=screen('Outfit','qwen',hostedQwen);await app.flush();app.action('Take selfie');await app.flush();
 assert.deepEqual(app.requests,[]);assert.ok(app.disclosure(/outfit photo.*Qwen Cloud/i));
 app.action('Send to Qwen Cloud');await app.flush();
 assert.deepEqual(app.requests,[{path:'outfit/analyze',body:{provider:'qwen',archivePhoto:false,image:{data:'synthetic',mime:'image/jpeg'},cloudConsent:qwenConsent}}]);
});

test('a bottle scan clears its cached photo and waits for permission to send it to Anthropic', async () => {
 const app = screen('Collection', 'claude');
 await app.flush();
 app.action('Scan bottle');
 await app.flush();
 assert.equal(app.photo.data, '');
 assert.deepEqual(app.requests, []);
 assert.ok(app.disclosure(/bottle photo.*Anthropic.*label/i));
 app.action('Send to Anthropic (Claude)');
 await app.flush();
 assert.deepEqual(app.requests, [{ path: 'vision/bottle', body: { provider: 'claude', image: { data: 'synthetic', mime: 'image/jpeg' } } }]);
});

test('dismissing a bottle consent sheet or approving in a stale session sends nothing', async () => {
 for (const stale of [false, true]) {
  const app = screen('Collection', 'openai');
  await app.flush();
  app.action('Scan bottle');
  await app.flush();
  assert.ok(app.disclosure(/bottle photo.*OpenAI.*label/i));
  if (stale) { app.changeSession(); app.action('Send to OpenAI'); }
  else app.closeSheet();
  await app.flush();
  assert.equal(app.photo.data, '');
  assert.deepEqual(app.requests, []);
  app.unmount();
 }
});

test('a local bottle scan reads the label without a cloud consent prompt', async () => {
 const app = screen('Collection', 'qwen');
 await app.flush();
 app.action('Scan bottle');
 await app.flush();
 assert.equal(app.photo.data, '');
 assert.equal(app.disclosure(/FragOut will send/i), undefined);
 assert.deepEqual(app.requests, [{ path: 'vision/bottle', body: { provider: 'qwen', image: { data: 'synthetic', mime: 'image/jpeg' } } }]);
});

test('the outfit action names OpenAI and sends the photo and description disclosed above it', async () => {
 const app = screen('Outfit', 'openai');
 await app.flush();
 app.action('Choose photo');
 app.changeOutfitText('Synthetic outfit description');
 await app.flush();
 assert.ok(app.disclosure(/outfit photo and description.*OpenAI.*clothing/i));
 assert.deepEqual(app.requests, []);
 app.action('Send to OpenAI');
 await app.flush();
 assert.deepEqual(app.requests, [{ path: 'outfit/analyze', body: { provider: 'openai', archivePhoto: false, text: 'Synthetic outfit description', image: { data: 'synthetic', mime: 'image/jpeg' } } }]);
});
