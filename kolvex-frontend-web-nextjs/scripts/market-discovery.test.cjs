const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, AbortSignal, console, Date, Set, ...globals,
    process: { env: { NEXT_PUBLIC_BACKEND_API_URL: 'https://backend.example' } },
    require: name => { if (!Object.hasOwn(mocks, name)) throw new Error(`Missing mock ${name}`); return mocks[name]; },
  });
  return module.exports;
}
const validTicker = value => /^[A-Z][A-Z0-9.-]{0,9}$/.test(value);
const model = load('lib/marketDiscovery.ts', { './decision': { validTicker } });
const item = { symbol: 'PLTR', name: 'Palantir', price: 20, changePercent: 8, volume: 12e6,
  averageVolume: 4e6, volumeMultiple: 3, marketTime: 1793289600, sessionDate: '2026-10-29' };
const board = patch => ({ items: [item], sessionDate: item.sessionDate, fetchedAt: '2026-10-29T16:00:00Z', unavailable: false, stale: false, partial: false, ...patch });
const payload = () => ({ source: 'Yahoo Finance', movers: board(), active: board() });

test('contract accepts real partial/empty snapshots but rejects unsafe and malformed data', () => {
  assert.equal(model.isMarketDiscovery(payload()), true);
  assert.equal(model.isMarketDiscovery({ ...payload(), active: board({ items: [], unavailable: true, partial: true }) }), true);
  for (const patch of [{ symbol: '../AAPL' }, { price: NaN }, { changePercent: Infinity }, { volumeMultiple: -1 },
    { averageVolume: 0 }, { marketTime: null }, { sessionDate: '2026-10-28' }]) {
    assert.equal(model.isMarketDiscovery({ ...payload(), movers: board({ items: [{ ...item, ...patch }] }) }), false);
  }
  for (const value of [null, {}, { ...payload(), source: 'fake' }, { ...payload(), movers: board({ stale: null }) },
    { ...payload(), active: board({ fetchedAt: 'bad' }) }, { ...payload(), movers: board({ items: [item, item] }) }]) {
    assert.equal(model.isMarketDiscovery(value), false);
  }
});

test('retained browser state cannot display a ranking after the hard snapshot age cap', () => {
  const data = payload();
  const fetched = Date.parse(data.movers.fetchedAt);
  assert.equal(model.currentMarketDiscovery(data, fetched + 60_000), data);
  const expired = model.currentMarketDiscovery(data, fetched + 15 * 60_000 + 1);
  assert.equal(expired.movers.unavailable, true);
  assert.equal(expired.movers.items.length, 0);
  assert.equal(expired.movers.sessionDate, null);
  assert.equal(data.movers.items.length, 1, 'shared cache must not be mutated');
});

function proxy(fetch) {
  return load('app/api/market/discovery/route.ts', {
    'next/server': { NextResponse: Response }, '@/lib/marketDiscovery': model,
  }, { fetch }).GET({ signal: new AbortController().signal });
}
test('same-origin proxy preserves dated rankings, source flags and no-store end to end', async () => {
  const data = { ...payload(), movers: board({ stale: true, partial: true }) };
  const response = await proxy(async (url, options) => {
    assert.equal(url, 'https://backend.example/api/v1/market/discovery');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(data);
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual(await response.json(), data);
});
test('upstream failure, invalid payload and network timeout remain 503 instead of fake results', async () => {
  for (const fetch of [async () => Response.json({ detail: 'private upstream error' }, { status: 500 }),
    async () => Response.json({ stocks: [] }), async () => { throw new Error('timeout'); }]) {
    const response = await proxy(fetch);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await response.json(), { error: 'Stock discovery unavailable' });
  }
});
test('browser loader validates response and forwards cancellation without caching HTTP failures', async () => {
  const signal = new AbortController().signal;
  const loader = load('lib/marketDiscovery.ts', { './decision': { validTicker } }, { fetch: async (url, options) => {
    assert.equal(url, '/api/market/discovery');
    assert.equal(options.signal, signal);
    assert.equal(options.cache, 'no-store');
    return Response.json(payload());
  } });
  assert.deepEqual(JSON.parse(JSON.stringify(await loader.fetchMarketDiscovery(signal))), payload());
  for (const response of [Response.json({}, { status: 503 }), Response.json({})]) {
    const bad = load('lib/marketDiscovery.ts', { './decision': { validTicker } }, { fetch: async () => response });
    await assert.rejects(bad.fetchMarketDiscovery(signal));
  }
});
