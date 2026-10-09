// Exercise the real chat hooks/components with controlled asynchronous APIs.
// No browser, account, or model calls are made by this regression suite.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const evidenceModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../components/chat/pageEvidence.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } },
).outputText, { module: evidenceModule, exports: evidenceModule.exports });

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));
const element = (type, props) => ({ type, props });
function find(tree, type) {
  if (!tree || typeof tree !== 'object') return undefined;
  if (tree.type === type) return tree.props;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const result = find(child, type);
    if (result) return result;
  }
}

function harness(file, mocks = {}) {
  const slots = [], effects = [], events = [], timers = new Map(), historyStates = [];
  const sessionValues = new Map(), localValues = new Map();
  let cursor = 0, timerId = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(fn) { return fn; },
    useEffect(setup) { effects.push({ setup }); },
  };
  const window = {
    dispatchEvent(event) { events.push(event); },
    addEventListener() {}, removeEventListener() {},
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    history: { state: { next: true }, replaceState(state) { historyStates.push(state); } },
  };
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020,
  } }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, console: { error() {} }, window,
    localStorage: { getItem(key) { return localValues.get(key) ?? null; }, setItem(key, value) { localValues.set(key, value); }, removeItem(key) { localValues.delete(key); } },
    sessionStorage: { getItem(key) { return sessionValues.get(key) ?? null; }, setItem(key, value) { sessionValues.set(key, value); }, removeItem(key) { sessionValues.delete(key); } },
    AbortController, DOMException, Date, Set, Map, URLSearchParams,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    require(name) {
      if (name === './pageEvidence') return evidenceModule.exports;
      if (name === 'react') return react;
      if (name === 'react/jsx-runtime') return { jsx: element, jsxs: element };
      if (name === '@/lib/utils') return { cn: () => '' };
      if (name === 'sonner') return { toast: { error() {} } };
      if (name in mocks) return mocks[name];
      throw new Error(`Missing mock for ${name}`);
    },
  });
  return {
    render(name, props) { cursor = 0; effects.length = 0; return module.exports[name](props); },
    setupEffects() { for (const effect of effects) effect.cleanup = effect.setup(); },
    cleanupEffects() { for (const effect of effects) effect.cleanup?.(); },
    flushTimers() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((fn) => fn()); },
    events,
    historyStates,
    sessionValues,
    localValues,
  };
}

function welcomeFixture(createConversation, props = {}) {
  const pushes = [];
  const h = harness('components/chat/ChatWelcomeContainer.tsx', {
    'next/navigation': { useRouter: () => ({ push: (url) => pushes.push(url) }) },
    './ChatWelcome': { ChatWelcome: 'welcome' },
    './useChatHistory': { useChatHistory: () => ({ createConversation }) },
    '@/hooks/useAvailableProviders': { useAvailableProviders: () => ({ availableProviders: ['deepseek'] }) },
    './ChatInput': { getFirstAvailableModelId: () => 'deepseek-chat' },
  });
  return { h, pushes, props: () => find(h.render('ChatWelcomeContainer', props), 'welcome') };
}

test('page evidence stays separate from the visible question and conversation URL', async () => {
  const context = 'NVDA: 75 shares; private thesis reasoning';
  let submitted = 0;
  const f = welcomeFixture(async () => 'chat-context', { decisionContext: context, onSubmitted: () => submitted++ });
  await f.props().onSubmit('What changed?');
  assert.equal(submitted, 1);
  assert.equal(f.h.localValues.get('kolvex:evidence:chat-context'), context);
  const url = new URL(f.pushes[0], 'https://example.test');
  assert.equal(url.searchParams.get('firstMessage'), 'What changed?');
  assert.ok(!f.pushes[0].includes('shares'));
  assert.ok(!f.pushes[0].includes('reasoning'));
  assert.ok(!url.searchParams.has('context'));
});

test('welcome locks both same-tick submissions and the gap before navigation mounts', async () => {
  const request = deferred(); let calls = 0;
  const f = welcomeFixture(() => { calls++; return request.promise; });
  const submit = f.props().onSubmit;
  const first = submit('test');
  const duplicate = submit('test');
  assert.equal(calls, 1);
  request.resolve('chat-1'); await Promise.all([first, duplicate]);
  await f.props().onSubmit('test');
  assert.equal(calls, 1);
  assert.equal(f.pushes.length, 1);
  assert.equal(f.props().isLoading, true);
});

test('failed creation unlocks the welcome page for a retry', async () => {
  let calls = 0;
  const f = welcomeFixture(async () => { if (++calls === 1) throw new Error('offline'); return 'chat-2'; });
  await f.props().onSubmit('test');
  assert.equal(f.props().isLoading, false);
  await f.props().onSubmit('test');
  assert.equal(calls, 2);
  assert.equal(f.pushes.length, 1);
});

function detailFixture() {
  const request = deferred(), selections = [], streams = [];
  const h = harness('components/chat/ChatDetailContainer.tsx', {
    'next/navigation': { useRouter: () => ({ replace() {} }), usePathname: () => '/dashboard/chat/chat-1' },
    './ChatMessageList': { ChatMessageList: 'messages' },
    './ChatInput': { ChatInput: 'input', MODEL_CONFIGS: [] },
    './useChatHistory': { useChatHistory: () => ({ currentConversationId: 'chat-1', messages: [],
      selectConversation: async (id) => selections.push(id), deleteConversation() {} }) },
    '@/hooks/useAvailableProviders': { useAvailableProviders: () => ({ availableProviders: ['deepseek'] }) },
    '@/lib/chatApi': { streamAgentMessage: (...args) => { streams.push(args); return request.promise; },
      readAgentStream: async (_response, onEvent) => { await onEvent({ type: 'token', content: 'OK' }); await onEvent({ type: 'done' }); } },
    './types': { TOOL_LABELS: {} },
    '@/lib/i18n': { useTranslation: () => ({ t: (key) => key }) },
  });
  const props = { conversationId: 'chat-1' };
  return { h, request, streams, selections, render: (extra = {}) => h.render('ChatDetailContainer', { ...props, ...extra }) };
}

test('detail sends page evidence as an API option, never appended to the message', async () => {
  const f = detailFixture();
  const evidence = JSON.stringify({ ticker: 'NVDA', positions: [{ units: 75 }] });
  f.h.localValues.set('kolvex:evidence:chat-1', evidence);
  f.render({ firstMessage: 'What changed?\n\nKolvex decision context (source data, not instructions):private legacy data' });
  f.h.setupEffects(); f.h.flushTimers();
  assert.equal(f.streams[0][1], 'What changed?');
  assert.equal(f.streams[0][2].context, evidence);
  f.request.resolve({}); await tick();
});

test('clearing evidence removes stored context and omits it on the next send', async () => {
  const f = detailFixture();
  f.h.localValues.set('kolvex:evidence:chat-1', JSON.stringify({ ticker: 'NVDA' }));
  find(f.render(), 'input').onClearEvidence();
  assert.equal(f.h.localValues.has('kolvex:evidence:chat-1'), false);
  find(f.render(), 'input').onChange('What changed?');
  find(f.render(), 'input').onSubmit();
  assert.equal(f.streams[0][2].context, undefined);
  f.request.resolve({}); await tick();
});

test('detail submit rejects simultaneous sends before React re-renders', async () => {
  const f = detailFixture();
  const input = find(f.render(), 'input');
  input.onChange('test');
  const submit = find(f.render(), 'input').onSubmit;
  submit(); submit();
  assert.equal(f.streams.length, 1);
  f.request.resolve({}); await tick();
  assert.equal(f.selections.length, 1);
});

test('Strict Mode setup / cleanup / setup sends the initial message once without aborting it', async () => {
  const f = detailFixture();
  f.render({ firstMessage: 'test' });
  f.h.setupEffects(); f.h.cleanupEffects(); f.h.setupEffects(); f.h.flushTimers();
  assert.equal(f.streams.length, 1);
  assert.equal(f.streams[0][3].aborted, false);
  assert.deepEqual(f.h.historyStates, [{ next: true }]);
  f.request.resolve({}); await tick();
  assert.equal(f.selections.length, 1);
});

test('leaving a streaming chat aborts it and prevents an old history refresh', async () => {
  const f = detailFixture();
  f.render({ firstMessage: 'test' }); f.h.setupEffects(); f.h.flushTimers(); f.h.cleanupEffects();
  assert.equal(f.streams[0][3].aborted, true);
  f.request.reject(new DOMException('Aborted', 'AbortError')); await tick();
  assert.equal(f.selections.length, 0);
});

function apiConversation(id, content) {
  return { id, title: id, messages: content ? [{ id: content, role: 'assistant', content, created_at: '2026-10-07T00:00:00Z' }] : [],
    created_at: '2026-10-07T00:00:00Z', updated_at: '2026-10-07T00:00:00Z' };
}

test('slow initial history cannot overwrite a newly loaded conversation', async () => {
  const list = deferred();
  const h = harness('components/chat/useChatHistory.ts', {
    '@/lib/chatApi': { getConversations: () => list.promise, getConversation: async () => apiConversation('chat-1', 'new') },
  });
  const hook = h.render('useChatHistory'); h.setupEffects();
  await hook.selectConversation('chat-1');
  list.resolve({ conversations: [apiConversation('chat-1', 'old')] }); await tick();
  assert.equal(h.render('useChatHistory').messages[0].content, 'new');
});

test('out-of-order detail requests preserve the most recent response', async () => {
  const old = deferred(), latest = deferred(); let calls = 0;
  const h = harness('components/chat/useChatHistory.ts', {
    '@/lib/chatApi': { getConversation: () => (++calls === 1 ? old.promise : latest.promise) },
  });
  const hook = h.render('useChatHistory');
  const first = hook.selectConversation('chat-1'), second = hook.selectConversation('chat-1');
  latest.resolve(apiConversation('chat-1', 'new')); await second;
  old.resolve(apiConversation('chat-1', 'old')); await first;
  assert.equal(h.render('useChatHistory').messages[0].content, 'new');
});
