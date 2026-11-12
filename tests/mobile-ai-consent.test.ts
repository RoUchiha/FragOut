import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

type Provider = 'qwen' | 'openai' | 'claude';
type Element = { type: string; props: { children?: unknown; label?: string; disabled?: boolean; onPress?: () => void; onClose?: () => void; onChangeText?: (value: string) => void } };

function screen(name: 'Collection' | 'Outfit', provider: Provider) {
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
     return { selected: provider, candidates: [{}], profile: null };
    },
   };
   if (dependency === './capture') return {
    capturePhoto: async () => photo,
    discardPhoto: async (value: typeof photo | null) => { if (value) value.data = ''; },
   };
   if (dependency === './cloud-ai') return load('cloud-ai.ts');
   if (dependency === './ui') return new Proxy({ useUi: () => ({ styles: {}, colors: {} }) }, { get: (target, key) => key === 'useUi' ? target.useUi : key });
   if (dependency === 'react-native' || dependency === 'lucide-react-native') return new Proxy({}, { get: (_target, key) => key });
   return {};
  }});
  return module.exports;
 }
 const Screen = load(`${name}.tsx`).default;
 function render() {
  cursor = 0;
  const tree = Screen({ state: { bottles: [] }, onError: () => {}, notify: () => {} });
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
