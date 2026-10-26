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
  }).outputText, { module, exports: module.exports, Date, Map, AbortSignal, require: name => mocks[name], ...globals });
  return module.exports;
}
const observations = load('lib/marketObservations.ts');
const instruments = load('lib/marketBenchmarks.ts');
const get = fetch => load('app/api/market/observations/[series]/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/marketObservations': observations,
}, { fetch }).GET;
const request = { signal: new AbortController().signal };

test('reference instruments are covered once and FRED series never enter stock quote batches', () => {
  const symbols = Array.from(instruments.MARKET_INSTRUMENTS, item => item.symbol);
  assert.equal(symbols.length, new Set(symbols).size);
  for (const symbol of ['IXP', 'XLY', 'XLP', 'XLE', 'KBWB', 'XLU', 'IYR', 'XLK', 'XLV', 'ITA', 'IAK', 'SOXX', 'IGV', 'IWD', 'IWF', 'MAGS', 'RSP', 'SPHB', 'TLT', '^MOVE', 'GC=F', 'CL=F', 'BTC-USD', 'DX-Y.NYB']) {
    assert.ok(instruments.MARKET_QUOTE_SYMBOLS.includes(symbol), symbol);
  }
  for (const symbol of observations.FRED_MARKET_SERIES) {
    assert.ok(symbols.includes(symbol));
    assert.ok(!instruments.MARKET_QUOTE_SYMBOLS.includes(symbol));
  }
  assert.equal(instruments.isMarketIndex('MAGS'), false);
});

test('missing observations are omitted while zero and negative rates are preserved', () => {
  const csv = '\uFEFFobservation_date,DGS2\n2026-10-23,0\n2026-10-22,.\n2026-10-21,-0.1\n2026-10-20,\n2026-10-19,NaN';
  assert.deepEqual(JSON.parse(JSON.stringify(observations.parseMarketObservations(csv, 'DGS2'))), [
    { date: '2026-10-21', value: -0.1 }, { date: '2026-10-23', value: 0 },
  ]);
  assert.throws(() => observations.parseMarketObservations('<html>error</html>', 'DGS2'));
});

test('daily range ends at the actual release date, preserving the prior observation for 1D', () => {
  const points = ['2026-07-01', '2026-09-01', '2026-10-01', '2026-10-16', '2026-10-22', '2026-10-23'].map((date, value) => ({ date, value }));
  assert.deepEqual(observations.observationRange(points, '1D'), points.slice(-2));
  assert.deepEqual(observations.observationRange(points, '1W'), points.slice(-3));
  assert.deepEqual(observations.observationRange(points, '1M'), points.slice(-4));
  assert.deepEqual(observations.observationRange(points, '3M'), points.slice(1));
});

test('QTD and YTD include the previous period close rather than the first new-period close', () => {
  const points = ['2025-12-30', '2025-12-31', '2026-01-02', '2026-09-30', '2026-10-01', '2026-10-23'].map((date, value) => ({ date, value }));
  assert.deepEqual(observations.observationRange(points, 'YTD', '2026-10-26'), points.slice(1));
  assert.deepEqual(observations.observationRange(points, 'QTD', '2026-10-26'), points.slice(3));
  assert.equal(observations.marketRangeBaseline(points.slice(3), 'QTD', '2026-10-26'), 3);
  assert.equal(observations.marketRangeBaseline(points.slice(4), 'QTD', '2026-10-26'), undefined);
  assert.equal(observations.observationRange(points, 'YTD', '2027-01-01').length, 0);
});

test('calendar ranges use New York dates, handle every quarter and preserve leap-year boundaries', () => {
  assert.equal(observations.marketCalendarDate(new Date('2026-01-01T01:00:00Z')), '2025-12-31');
  for (const [asOf, expected] of [['2026-01-03', '2026-01-01'], ['2026-04-01', '2026-04-01'], ['2026-07-05', '2026-07-01'], ['2026-12-31', '2026-10-01']]) {
    assert.equal(observations.marketRangeBoundary('QTD', asOf, asOf), expected);
  }
  assert.equal(observations.marketRangeBoundary('1Y', '2024-02-29'), '2023-02-28');
  const points = ['2025-10-22', '2025-10-23', '2025-10-24', '2026-10-23'].map((date, value) => ({ date, value }));
  assert.deepEqual(observations.observationRange(points, '1Y'), points);
  assert.equal(observations.marketRangeBaseline(points, '1Y'), 0);
  assert.ok(observations.MARKET_RANGES.some(range => range.key === '1Y' && range.period === '2y'));
  assert.ok(observations.MARKET_RANGES.some(range => range.key === 'QTD'));
  assert.ok(observations.MARKET_RANGES.some(range => range.key === 'YTD'));
});

test('each daily series uses a fixed FRED URL, actual dates and percentage units without scaling', async () => {
  for (const series of observations.FRED_MARKET_SERIES) {
    const route = get(async (url, options) => {
      assert.ok(url.startsWith(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${series}&cosd=`));
      assert.equal(options.next.revalidate, 21600);
      return new Response(`observation_date,${series}\n2026-10-22,3.4\n2026-10-23,.`);
    });
    const response = await route(request, { params: { series } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).history, [{ date: '2026-10-22', value: 3.4 }]);
  }
});

test('unknown series are rejected without fetching, and outages never become zero prices', async () => {
  let called = false;
  const route = get(async () => { called = true; throw new Error('Unavailable'); });
  for (const series of ['AAPL', '../DGS2', 'DGS2&x=y']) {
    assert.equal((await route(request, { params: { series } })).status, 400);
  }
  assert.equal(called, false);
  assert.equal((await route(request, { params: { series: 'DGS2' } })).status, 503);
  for (const csv of ['observation_date,DGS2\n2026-10-23,.', '<html>error</html>']) {
    assert.equal((await get(async () => new Response(csv))(request, { params: { series: 'DGS2' } })).status, 503);
  }
});
