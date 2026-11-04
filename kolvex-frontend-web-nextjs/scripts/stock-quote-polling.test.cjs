const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const createCache = require('./helpers/client-cache.cjs');

function fixture() {
  const listeners = new Map(), timers = new Set(), cleanup = [], requests = [];
  let refreshes = 0, resource;
  const document = { hidden: false, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
  const window = { addEventListener: document.addEventListener, removeEventListener: document.removeEventListener };
  window.setInterval = (fn, interval) => { assert.equal(interval, 15_000); timers.add(fn); return fn; };
  window.clearInterval = fn => timers.delete(fn);
  const cache = createCache();
  const fetch = async (url, options) => {
    requests.push({ url, options });
    return Response.json({ symbol: 'NVDA', price: 203.36, changePercent: -1.6111 });
  };
  let stockApi;
  function compile(file) {
    const module = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(source, { module, exports: module.exports, document, window, fetch,
      setInterval(fn, interval) { assert.equal(interval, 15_000); timers.add(fn); return fn; },
      clearInterval(fn) { timers.delete(fn); },
      require(key) {
        if (key === 'react') return { useEffect: fn => cleanup.push(fn()) };
        if (key === './clientCache') return cache;
        if (key === './quoteSnapshots') return compile('lib/quoteSnapshots.ts');
        if (key === './useVisiblePolling') return compile('hooks/useVisiblePolling.ts');
        if (key === './useMarketQuotes') return {};
        if (key === '@/lib/stockApi') return stockApi;
        if (key === './useCachedResource') return { useCachedResource(key, loader, options) {
          resource = { key, loader, options };
          return { data: { symbol: 'NVDA', price: 203.36 }, loading: false, refreshing: false, error: null, refresh() { refreshes++; } };
        } };
        throw Error(key);
      },
    });
    return module.exports;
  }
  stockApi = compile('lib/stockApi.ts');
  const hooks = compile('hooks/useStockData.ts');
  return { hooks, timers, listeners, document, requests, resource: () => resource,
    refreshes: () => refreshes, unmount: () => cleanup.forEach(fn => fn?.()) };
}

test('quotes poll every 15 seconds, pause while hidden and refresh on return or reconnect', async () => {
  const h = fixture();
  assert.equal(h.hooks.useStockQuote(' nvda ').data.price, 203.36);
  assert.equal(h.resource().key, '/api/stocks?action=quote&symbol=NVDA');
  await h.resource().loader(new AbortController().signal);
  assert.equal(h.requests[0].options.cache, 'no-store');
  assert.equal(h.requests[0].url, h.resource().key);
  assert.equal(h.timers.size, 1);
  [...h.timers][0]();
  assert.equal(h.refreshes(), 1);
  h.document.hidden = true;
  [...h.timers][0]();
  h.listeners.get('visibilitychange')();
  assert.equal(h.refreshes(), 1);
  h.document.hidden = false;
  for (const key of ['visibilitychange', 'focus', 'online']) h.listeners.get(key)();
  assert.equal(h.refreshes(), 4);
  h.unmount();
  assert.equal(h.timers.size, 0);
  assert.equal(h.listeners.size, 0);
});

test('historical snapshots disable live quote network requests and polling', async () => {
  const h = fixture();
  assert.equal(h.hooks.useStockQuote('NVDA', 15_000, false).data, null);
  await h.resource().loader(new AbortController().signal);
  assert.equal(h.requests.length, 0);
  assert.equal(h.timers.size, 0);
  assert.equal(h.listeners.size, 0);
  h.unmount();
});
