const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, deps = {}, globals = {}) {
  const exports = {};
  const clientCache = require("./helpers/client-cache.cjs")();
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: name => { if (name === "@/lib/clientCache" || name === "./clientCache") return clientCache;
    if (name in deps) return deps[name];
    throw Error(name);
  }, URL, AbortSignal, AbortController, process: { env: {} }, ...globals });
  return exports;
}
const article = (id, time = 1) => ({ uuid: id, title: `Headline ${id}`, link: `https://example.com/${id}`, publish_time: time, publisher: 'Source' });

test('stock client sorts latest first, removes duplicate/unsafe articles and forwards cancellation', async () => {
  const controller = new AbortController();
  const api = load('lib/stockApi.ts', {}, { fetch: async (url, options) => {
    assert.equal(url, '/api/market/news/BRK.B');
    assert.equal(options.signal, controller.signal);
    assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => ({ news: [article('old'), article('new', 3), article('new', 3), { ...article('bad'), link: 'javascript:alert(1)' }, { ...article('empty'), title: '' }] }) };
  }});
  assert.equal((await api.getStockNews('BRK.B', controller.signal)).map(a => a.uuid).join(','), 'new,old');
});

test('stock client distinguishes malformed responses and upstream failures from empty news', async () => {
  for (const response of [{ ok: false }, { ok: true, json: async () => ({}) }]) {
    const api = load('lib/stockApi.ts', {}, { fetch: async () => response });
    await assert.rejects(api.getStockNews('NVDA'));
  }
  const api = load('lib/stockApi.ts', {}, { fetch: async () => ({ ok: true, json: async () => ({ news: [] }) }) });
  assert.equal((await api.getStockNews('NVDA')).length, 0);
});

test('stock news proxy validates symbols, bypasses cache, bounds request time and rejects malformed payloads', async () => {
  let calls = 0;
  const route = load('app/api/market/news/[symbol]/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers }) } },
  }, { fetch: async (url, options) => {
    calls++;
    assert.equal(url, 'http://localhost:8080/api/v1/market/news/NVDA');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal);
    return { ok: true, json: async () => calls === 1 ? { news: [article('a')] } : {} };
  }});
  assert.equal((await route.GET(null, { params: { symbol: '../bad' } })).status, 400);
  assert.equal(calls, 0);
  const result = await route.GET(null, { params: { symbol: 'nvda' } });
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal((await route.GET(null, { params: { symbol: 'NVDA' } })).status, 502);
});

function harness() {
  let slots = [], cursor = 0, effects = [], pending = [];
  const requests = [], timers = new Map(), events = new Map();
  let timerId = 0;
  const surface = { hidden: false, addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) };
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useCallback(fn) { cursor++; return fn; },
    useEffect(fn, deps) { const i = cursor++; const previous = effects[i]; if (!previous || deps.some((d, n) => d !== previous.deps[n])) pending.push(() => { previous?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); },
  };
  const hook = load('components/decision/useStockNews.ts', {
    react,
    '@/lib/stockApi': { getStockNews: (ticker, signal) => new Promise((resolve, reject) => requests.push({ ticker, signal, resolve, reject })) },
  }, {
    document: surface, window: surface,
    setInterval: fn => { timers.set(++timerId, fn); return timerId; }, clearInterval: id => timers.delete(id),
    setTimeout: () => 0, clearTimeout: () => {},
  });
  return { requests, surface, events,
    render(ticker = 'NVDA') { cursor = 0; const result = hook.useStockNews(ticker); const work = pending; pending = []; work.forEach(fn => fn()); return result; },
    tick() { timers.forEach(fn => fn()); },
    unmount() { effects.forEach(effect => effect?.cleanup?.()); },
  };
}
const settle = () => new Promise(setImmediate);

test('ticker changes detach old readers and ignore their late results', async () => {
  const h = harness(); h.render(); h.render('AAPL');
  assert.equal(h.requests[0].signal.aborted, false, "shared request can finish warming the cache");
  h.requests[1].resolve([article('apple')]); await settle();
  h.requests[0].resolve([article('nvidia')]); await settle();
  assert.equal(h.render('AAPL').articles[0].uuid, 'apple');
  h.unmount();
});

test('refresh failures preserve articles, retry recovers and hidden tabs do not poll', async () => {
  const h = harness(); h.render();
  h.requests[0].resolve([article('saved')]); await settle();
  h.surface.hidden = true; h.tick(); assert.equal(h.requests.length, 1);
  h.surface.hidden = false; h.tick(); h.tick(); assert.equal(h.requests.length, 2);
  h.requests[1].reject(Error('offline')); await settle();
  let state = h.render(); assert.equal(state.error, true); assert.equal(state.articles[0].uuid, 'saved');
  state.refresh(); h.render(); h.requests[2].resolve([article('fresh')]); await settle();
  state = h.render(); assert.equal(state.error, false); assert.equal(state.articles[0].uuid, 'fresh');
  h.unmount(); assert.equal(h.events.size, 0);
});
