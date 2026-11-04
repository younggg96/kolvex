const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const createCache = require('./helpers/client-cache.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(provider) {
  let now = 100_000, cursor = 0;
  const slots = [], effects = [], timers = new Set(), listeners = new Map(), requests = [];
  const cache = createCache({ Date: { now: () => now } });
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    useCallback(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { fn, deps }; return slots[i].fn; },
    useEffect(fn, deps) { const i = cursor++; if (!slots[i] || !same(slots[i].deps, deps)) { const previous = slots[i]; slots[i] = { deps }; effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = fn(); }); } },
  };
  const document = { hidden: false, addEventListener(key, fn) { listeners.set(key, fn); }, removeEventListener(key) { listeners.delete(key); } };
  const window = { addEventListener: document.addEventListener, removeEventListener: document.removeEventListener,
    setInterval(fn, ms) { assert.equal(ms, 15_000); timers.add(fn); return fn; }, clearInterval(fn) { timers.delete(fn); } };
  const modules = new Map();
  function compile(file) {
    if (modules.has(file)) return modules.get(file);
    const module = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(source, { module, exports: module.exports, AbortController, document, window,
      fetch: async (url, options) => { requests.push({ url, options }); return provider(url, options); },
      require(key) {
        if (key === 'react') return react;
        if (/clientCache$/.test(key)) return cache;
        const relative = key.startsWith('@/') ? key.slice(2) : path.join(path.dirname(file), key);
        return compile(`${relative}.ts`);
      },
    });
    modules.set(file, module.exports);
    return module.exports;
  }
  const { useMarketQuotes } = compile('hooks/useMarketQuotes.ts');
  const snapshots = compile('lib/quoteSnapshots.ts');
  return {
    cache, snapshots, requests, timers, listeners, document,
    advance(ms) { now += ms; },
    render(symbols = ['NVDA'], enabled = true, token = 0) { cursor = 0; return useMarketQuotes(symbols, enabled, token); },
    effects() { effects.splice(0).forEach(fn => fn()); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
const quote = (symbol, price = 203.36, marketTime = 100) => ({ symbol, price, marketTime, change: -3.33, changePercent: -1.61 });
const symbolsAt = url => new URL(url, 'https://kolvex.example').searchParams.get('symbols').split(',');

test('lists share detail updates immediately; polling pauses when hidden and resumes on return', async () => {
  let price = 203.36, time = 100;
  const h = fixture(url => Response.json(symbolsAt(url).map(symbol => quote(symbol, price, time))));
  h.render([' nvda ', 'NVDA']); h.effects(); await tick();
  assert.equal(h.render().quotes.NVDA.price, 203.36);
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].options.cache, 'no-store');
  h.snapshots.publishQuote(quote('NVDA', 204, 101));
  assert.equal(h.render().quotes.NVDA.price, 204);
  assert.equal(h.requests.length, 1, 'a sibling update must not cause a fetch loop');
  h.document.hidden = true; h.advance(16_000);
  [...h.timers][0](); h.render(); h.effects(); await tick();
  assert.equal(h.requests.length, 1);
  h.document.hidden = false; price = 205; time = 102;
  h.listeners.get('visibilitychange')(); h.render(); h.effects(); await tick();
  assert.equal(h.render().quotes.NVDA.price, 205);
  h.unmount(); assert.equal(h.timers.size, 0); assert.equal(h.listeners.size, 0);
});

test('refresh failures retain genuine last quotes and missing symbols stay unavailable', async () => {
  let offline = false;
  const h = fixture(() => offline ? Response.json({}, { status: 503 }) : Response.json([quote('NVDA')]));
  h.render(); h.effects(); await tick();
  offline = true;
  h.render().refresh(); h.render(); h.effects(); await tick();
  const state = h.render();
  assert.equal(state.quotes.NVDA.price, 203.36);
  assert.equal(state.unavailable, true);
  assert.equal(state.loading, false);
  h.unmount();
});

test('switching symbols prevents a late reply from replacing the new list', async () => {
  let finish;
  const h = fixture(url => symbolsAt(url).includes('NVDA') ? new Promise(resolve => { finish = resolve; }) : Response.json([quote('AMD', 180)]));
  h.render(); h.effects();
  assert.equal(h.render(['AMD']).quotes.NVDA, undefined); h.effects(); await tick();
  finish(Response.json([quote('NVDA')])); await tick();
  const state = h.render(['AMD']);
  assert.equal(state.quotes.AMD.price, 180);
  assert.equal(state.quotes.NVDA, undefined);
  h.unmount();
});

test('disabled lists make no requests and complete batches survive bounded cache eviction', async () => {
  const h = fixture(url => Response.json(symbolsAt(url).map(symbol => quote(symbol))));
  h.render(['NVDA'], false); h.effects(); await tick();
  assert.equal(h.requests.length, 0);
  const symbols = Array.from({ length: 180 }, (_, i) => `S${i}`);
  h.render(symbols); h.effects(); await tick(); await tick();
  assert.equal(Object.keys(h.render(symbols).quotes).length, 180);
  assert.equal(h.render(symbols).unavailable, false);
  h.unmount();
});
