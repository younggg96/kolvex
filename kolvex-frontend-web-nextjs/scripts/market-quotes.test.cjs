const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, fetch, cache = new Map()) {
  const module = { exports: {} };
  const clientCache = require("./helpers/client-cache.cjs")();
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module, exports: module.exports, fetch, AbortSignal, console: { error() {} },
    process: { env: { NEXT_PUBLIC_BACKEND_API_URL: 'https://backend.example' } },
    require(name) {
      if (name === "./clientCache") return clientCache;
      if (name === 'next/server') return { NextResponse: Response };
      if (name === '@/lib/cache') return { quoteCache: cache, chartCache: new Map(), overviewCache: new Map(), CACHE_TTL: { QUOTE: 15, CHART: 300, OVERVIEW: 600 }, QUOTE_CACHE_CONTROL: 'quote-cache-control', getCacheKey: (...parts) => parts.join(':') };
      throw Error(name);
    },
  });
  return module.exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const quote = symbol => ({ symbol, price: 100, change: 1, changePercent: 1 });
const request = symbols => ({ nextUrl: new URL(`https://kolvex.example/api/stocks?action=multiple&symbols=${encodeURIComponent(symbols.join(','))}`) });

test('creator coverage uses small bounded concurrent requests and includes every ticker', async () => {
  let active = 0, maximum = 0;
  const seen = [];
  const { loadMarketQuotes } = load('lib/marketQuotes.ts', async url => {
    const symbols = new URL(url, 'https://kolvex.example').searchParams.get('symbols').split(',');
    assert.ok(symbols.length <= 5);
    seen.push(...symbols); maximum = Math.max(maximum, ++active);
    await tick(); active--;
    return Response.json(symbols.map(quote));
  });
  const symbols = Array.from({ length: 27 }, (_, index) => `S${index}`);
  const result = await loadMarketQuotes([...symbols, 's0', ' S1 '], new AbortController().signal, () => {});
  assert.equal(maximum, 3);
  assert.deepEqual(seen.sort(), [...symbols].sort());
  assert.equal(Object.keys(result.quotes).length, 27);
  assert.equal(result.unavailable, false);
});
test('fast batches render before a slow batch and a failed batch cannot erase successful prices', async () => {
  let finishSlow, slowCalls = 0;
  const batches = [];
  const { loadMarketQuotes } = load('lib/marketQuotes.ts', async url => {
    const symbols = new URL(url, 'https://kolvex.example').searchParams.get('symbols').split(',');
    if (symbols.includes('SPCX')) {
      if (slowCalls++) return Response.json({}, { status: 503 });
      return new Promise(resolve => { finishSlow = resolve; });
    }
    return Response.json(symbols.map(quote));
  });
  const pending = loadMarketQuotes(['SPCX','A','B','C','D','MU','AMD','TSM'], new AbortController().signal, batch => batches.push(batch));
  await tick();
  assert.equal(batches[0].MU.price, 100);
  assert.equal(batches[0].AMD.price, 100);
  finishSlow(Response.json({ error: 'upstream timeout' }, { status: 503 }));
  const result = await pending;
  assert.equal(result.quotes.TSM.price, 100);
  assert.equal(result.unavailable, true);
  assert.equal(result.quotes.SPCX, undefined);
});
test('aborted list requests cannot publish prices into the newly selected list', async () => {
  let finish;
  const { loadMarketQuotes } = load('lib/marketQuotes.ts', () => new Promise(resolve => { finish = resolve; }));
  const controller = new AbortController(); let published = 0;
  const pending = loadMarketQuotes(['MU'], controller.signal, () => published++);
  controller.abort(); finish(Response.json([quote('MU')]));
  await pending;
  assert.equal(published, 0);
});
test('partial upstream responses retain good cached quotes and omit invalid prices', async () => {
  const cache = new Map([['quote:NVDA', quote('NVDA')]]);
  const api = load('app/api/stocks/route.ts', async () => Response.json({
    MU: { symbol: 'MU', current_price: 180, change: 2, change_percent: 1 },
    AMD: { symbol: 'AMD', current_price: 0 }, SPCX: { error: 'Unavailable' },
  }), cache);
  const response = await api.GET(request(['NVDA','MU','AMD','SPCX']));
  const data = await response.json();
  assert.deepEqual(data.map(item => item.symbol), ['NVDA','MU']);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(cache.has('quote:AMD'), false);
});
test('an upstream outage preserves cached prices, with 503 when there are none', async () => {
  for (const cached of [true, false]) {
    const cache = new Map(cached ? [['quote:NVDA', quote('NVDA')]] : []);
    const api = load('app/api/stocks/route.ts', async () => { throw Error('Timeout'); }, cache);
    const response = await api.GET(request(['NVDA','MU']));
    assert.equal(response.status, cached ? 200 : 503);
    if (cached) assert.deepEqual(await response.json(), [quote('NVDA')]);
  }
});

test('returning to a market list reuses fresh per-symbol prices; manual refresh still reaches the network', async () => {
  let calls = 0;
  const api = load('lib/marketQuotes.ts', async url => {
    calls++;
    const symbols = new URL(url, 'https://kolvex.example').searchParams.get('symbols').split(',');
    return Response.json(symbols.map(quote));
  });
  const signal = new AbortController().signal;
  await api.loadMarketQuotes(['NVDA', 'AAPL'], signal, () => {});
  assert.equal(calls, 1);
  let painted;
  await api.loadMarketQuotes(['AAPL'], signal, batch => { painted = batch; });
  assert.equal(calls, 1);
  assert.equal(painted.AAPL.price, 100);
  await api.loadMarketQuotes(['AAPL'], signal, () => {}, true);
  assert.equal(calls, 2);
});

test('partial batches automatically retry only missing prices', async () => {
  const seen = [];
  const api = load('lib/marketQuotes.ts', async url => {
    const symbols = new URL(url, 'https://kolvex.example').searchParams.get('symbols').split(',');
    seen.push(symbols);
    return Response.json(seen.length === 1 ? [quote('AAPL')] : symbols.map(quote));
  });
  const result = await api.loadMarketQuotes(['AAPL', 'MU', 'AMD'], new AbortController().signal, () => {});
  assert.deepEqual(seen, [['AAPL', 'AMD', 'MU'], ['AMD', 'MU']]);
  assert.equal(result.unavailable, false);
  assert.equal(result.quotes.AAPL.price, 100);
});
test('an entirely failed batch is retried once with a bounded final failure', async () => {
  let calls = 0;
  const api = load('lib/marketQuotes.ts', async () => { calls++; return Response.json({}, { status: 503 }); });
  const result = await api.loadMarketQuotes(['MU'], new AbortController().signal, () => {});
  assert.equal(calls, 2);
  assert.equal(result.unavailable, true);
});

test('quote requests to the backend bypass the Next Data Cache', async () => {
  const seen = [];
  const backend = async (url, init = {}) => {
    seen.push({ url: String(url), cache: init.cache });
    return Response.json(String(url).includes('/quotes?')
      ? { NVDA: { symbol: 'NVDA', current_price: 180 } }
      : { symbol: 'MU', current_price: 180, data: [] });
  };
  const stocks = load('app/api/stocks/route.ts', backend);
  const single = await stocks.GET({ nextUrl: new URL('https://kolvex.example/api/stocks?action=quote&symbol=MU') });
  const batch = await stocks.GET(request(['NVDA']));
  await load('app/api/market/indices/route.ts', backend).GET();
  const quoteRequests = seen.filter(({ url }) => /\/market\/quotes?[/?]/.test(url));
  assert.equal(quoteRequests.length, 5);
  for (const { url, cache } of quoteRequests) assert.equal(cache, 'no-store', url);
  assert.equal(single.headers.get('Cache-Control'), 'quote-cache-control');
  assert.equal(batch.headers.get('Cache-Control'), 'quote-cache-control');
});

test('chart, overview and index history requests also bypass the Next Data Cache', async () => {
  const seen = [];
  const backend = async (url, init = {}) => {
    seen.push({ url: String(url), cache: init.cache });
    return Response.json({ symbol: 'MU', current_price: 180, data: [] });
  };
  const stocks = load('app/api/stocks/route.ts', backend);
  await stocks.GET({ nextUrl: new URL('https://kolvex.example/api/stocks?action=chart&symbol=MU') });
  await stocks.GET({ nextUrl: new URL('https://kolvex.example/api/stocks?action=overview&symbol=MU') });
  await load('app/api/market/indices/route.ts', backend).GET();
  const upstream = seen.filter(({ url }) => /\/market\/(intraday|overview|history)\//.test(url));
  assert.equal(upstream.length, 5);
  for (const { url, cache } of upstream) assert.equal(cache, 'no-store', url);
});
