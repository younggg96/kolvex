const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Same transpile+vm harness as scripts/chart-advanced-indicators.test.cjs: the module is pure,
// so it can be exercised without a bundler. date-fns resolves to the real package through the
// sandbox's `require`.
function compile(file) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require, console });
  return module.exports;
}

const range = compile('lib/chart/range.ts');
const { historyParamsFor, defaultRangeForWindow, windowStartFor, priceRanges, rangeStartDay, rangeScrollDays } = range;

// Fixed clock so the tests never depend on the day they run on.
const TODAY = new Date(2026, 9, 30); // 2026-10-30

test('every fixed range maps to yfinance params that cover its window', () => {
  const expected = {
    '1D': { period: '1d', interval: '5m' },
    '1W': { period: '5d', interval: '15m' },
    '1M': { period: '1mo', interval: '1d' },
    '3M': { period: '3mo', interval: '1d' },
    '6M': { period: '6mo', interval: '1d' },
    YTD: { period: 'ytd', interval: '1d' },
    '1Y': { period: '1y', interval: '1d' },
    '5Y': { period: '5y', interval: '1wk' },
    ALL: { period: 'max', interval: '1mo' },
  };
  assert.deepEqual([...priceRanges].sort(), Object.keys(expected).sort(), 'priceRanges lists exactly the fixed ranges');
  for (const [key, params] of Object.entries(expected)) {
    assert.deepEqual({ ...historyParamsFor(key, { today: TODAY }) }, params, `${key} params`);
  }
});

test('every params object carries an interval plus a period or a full start/end window', () => {
  const cases = [...priceRanges, 'CUSTOM', 'BOGUS'];
  const custom = [
    undefined,
    { customFrom: '2026-01-01', customTo: '2026-10-30' },
    { customFrom: 'nope', customTo: '' },
    { customFrom: '2026-05-01', customTo: '2026-05-01' },
  ];
  for (const key of cases) {
    for (const options of custom) {
      const params = historyParamsFor(key, { ...options, today: TODAY });
      assert.equal(typeof params.interval, 'string', `${key} has an interval`);
      assert.ok(params.interval.length > 0, `${key} interval is non-empty`);
      const preset = typeof params.period === 'string' && params.period.length > 0;
      const window = typeof params.start === 'string' && typeof params.end === 'string';
      assert.ok(preset !== window, `${key} uses either period or start+end, never both (${JSON.stringify(params)})`);
      if (preset) assert.equal(params.start, undefined, `${key} preset has no start`);
      else assert.ok(params.start <= params.end, `${key} start <= end`);
    }
  }
});

test('custom windows pick daily up to 400 days and weekly beyond, with an inclusive end day', () => {
  const daily = historyParamsFor('CUSTOM', { customFrom: '2026-08-02', customTo: '2026-10-30', today: TODAY });
  assert.deepEqual({ ...daily }, { start: '2026-08-02', end: '2026-10-31', interval: '1d' });

  // 400 days exactly stays daily; 401 flips to weekly.
  assert.equal(historyParamsFor('CUSTOM', { customFrom: '2025-09-25', customTo: '2026-10-30' }).interval, '1d');
  assert.equal(historyParamsFor('CUSTOM', { customFrom: '2025-09-24', customTo: '2026-10-30' }).interval, '1wk');
  assert.deepEqual({ ...historyParamsFor('CUSTOM', { customFrom: '2020-01-01', customTo: '2026-10-30' }) }, {
    start: '2020-01-01', end: '2026-10-31', interval: '1wk',
  });
});

test('a missing start, invalid dates or an inverted window fall back to three months', () => {
  const fallback = { period: '3mo', interval: '1d' };
  assert.deepEqual({ ...historyParamsFor('CUSTOM', { customTo: '2026-10-30' }) }, fallback);
  assert.deepEqual({ ...historyParamsFor('CUSTOM', { customFrom: 'not-a-date', customTo: '2026-10-30' }) }, fallback);
  assert.deepEqual({ ...historyParamsFor('CUSTOM', { customFrom: '2026-10-30', customTo: '2026-10-01' }) }, fallback);
  assert.deepEqual({ ...historyParamsFor('CUSTOM', {}) }, fallback);
  // A missing end day defaults to today, so a lone start is still usable.
  assert.deepEqual({ ...historyParamsFor('CUSTOM', { customFrom: '2026-10-01', today: TODAY }) }, {
    start: '2026-10-01', end: '2026-10-31', interval: '1d',
  });
  // Start == end is a legal one-day window.
  assert.deepEqual({ ...historyParamsFor('CUSTOM', { customFrom: '2026-10-30', customTo: '2026-10-30', today: TODAY }) }, {
    start: '2026-10-30', end: '2026-10-31', interval: '1d',
  });
});

test('defaultRangeForWindow follows the opinion window length at each boundary', () => {
  const at = days => { const d = new Date(2026, 9, 30); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); };
  assert.equal(defaultRangeForWindow(undefined, TODAY), '3M');
  assert.equal(defaultRangeForWindow('', TODAY), '3M');
  assert.equal(defaultRangeForWindow('garbage', TODAY), '3M');
  assert.equal(defaultRangeForWindow(at(0), TODAY), '1W');
  assert.equal(defaultRangeForWindow(at(10), TODAY), '1W');
  assert.equal(defaultRangeForWindow(at(11), TODAY), '1M');
  assert.equal(defaultRangeForWindow(at(45), TODAY), '1M');
  assert.equal(defaultRangeForWindow(at(46), TODAY), '3M');
  assert.equal(defaultRangeForWindow(at(100), TODAY), '3M');
  assert.equal(defaultRangeForWindow(at(101), TODAY), '6M');
  assert.equal(defaultRangeForWindow(at(200), TODAY), '6M');
  assert.equal(defaultRangeForWindow(at(201), TODAY), '1Y');
  assert.equal(defaultRangeForWindow(at(400), TODAY), '1Y');
  assert.equal(defaultRangeForWindow(at(401), TODAY), '5Y');
  assert.equal(defaultRangeForWindow(at(3000), TODAY), '5Y');
});

test('windowStartFor sizes each window from the last bar, in local time', () => {
  const last = new Date(2026, 9, 30, 15, 30).getTime();
  const day = d => new Date(d).getTime();
  assert.equal(windowStartFor('1D', last), day(new Date(2026, 9, 30)));
  assert.equal(windowStartFor('1W', last), day(new Date(2026, 9, 23, 15, 30)));
  assert.equal(windowStartFor('1M', last), day(new Date(2026, 8, 30, 15, 30)));
  assert.equal(windowStartFor('3M', last), day(new Date(2026, 6, 30, 15, 30)));
  assert.equal(windowStartFor('6M', last), day(new Date(2026, 3, 30, 15, 30)));
  assert.equal(windowStartFor('YTD', last), day(new Date(2026, 0, 1)));
  assert.equal(windowStartFor('1Y', last), day(new Date(2025, 9, 30, 15, 30)));
  assert.equal(windowStartFor('5Y', last), day(new Date(2021, 9, 30, 15, 30)));
  assert.equal(windowStartFor('CUSTOM', last, '2026-04-01'), day(new Date(2026, 3, 1)));
  assert.equal(windowStartFor('CUSTOM', last, undefined), null);
  // ALL keeps every loaded bar.
  assert.equal(windowStartFor('ALL', last), null);
});

test('PriceRange is the same union PriceGraph accepts (no drifting second type)', () => {
  // Range keys live in lib/chart/graph.ts as `PriceRangeKey`; lib/chart/range.ts re-exports
  // them as `PriceRange`. TypeScript cannot be introspected here, so assert the source contract
  // plus runtime coverage: every key PriceGraph can receive must map to real fetch params.
  const graph = fs.readFileSync(path.join(__dirname, '..', 'lib/chart/graph.ts'), 'utf8');
  const declared = /export type PriceRangeKey = ([^;]+);/.exec(graph);
  assert.ok(declared, 'graph.ts declares PriceRangeKey');
  const keys = [...declared[1].matchAll(/"([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(keys, ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'ALL', 'CUSTOM']);
  const source = fs.readFileSync(path.join(__dirname, '..', 'lib/chart/range.ts'), 'utf8');
  assert.match(source, /import type \{ PriceRangeKey \} from "\.\/graph";/, 'range.ts imports the graph union');
  assert.match(source, /export type PriceRange = PriceRangeKey;/, 'range.ts aliases the graph union');
  assert.doesNotMatch(source, /export type PriceRange = "/, 'range.ts declares no second union');
  for (const key of keys) {
    const params = historyParamsFor(key, { customFrom: '2026-09-01', customTo: '2026-10-30', today: TODAY });
    assert.ok(params.interval, `${key} has fetch params`);
  }
  assert.deepEqual([...priceRanges], keys.filter(key => key !== 'CUSTOM'), 'priceRanges is the fixed subset in bar order');
});

test('rangeStartDay and rangeScrollDays stay within the fetched window', () => {
  assert.equal(rangeStartDay('1D', TODAY), '2026-10-30');
  assert.equal(rangeStartDay('3M', TODAY), '2026-07-30');
  assert.equal(rangeStartDay('YTD', TODAY), '2026-01-01');
  assert.equal(rangeStartDay('5Y', TODAY), '2021-10-30');
  assert.equal(rangeStartDay('ALL', TODAY), null);
  assert.equal(rangeStartDay('CUSTOM', TODAY), null);
  assert.equal(rangeScrollDays('1D'), 1);
  assert.equal(rangeScrollDays('1W'), 5);
  assert.equal(rangeScrollDays('1M'), 30);
  assert.equal(rangeScrollDays('6M'), 180);
  assert.equal(rangeScrollDays('3M'), 0);
  assert.equal(rangeScrollDays('CUSTOM'), 0);
});

test('legacy page ranges map onto graph keys and back without touching URL values', () => {
  const { legacyRangeToPriceRange, priceRangeToLegacyRange } = range;
  // The explorer's filter/URL values are lowercase and stay that way.
  assert.equal(legacyRangeToPriceRange('1m'), '1M');
  assert.equal(legacyRangeToPriceRange('3m'), '3M');
  assert.equal(legacyRangeToPriceRange('6m'), '6M');
  assert.equal(legacyRangeToPriceRange('1y'), '1Y');
  assert.equal(legacyRangeToPriceRange('all'), 'ALL');
  assert.equal(legacyRangeToPriceRange(undefined), '3M');
  assert.equal(legacyRangeToPriceRange(null), '3M');
  assert.equal(legacyRangeToPriceRange('bogus'), '3M');
  assert.equal(legacyRangeToPriceRange('bogus', '1Y'), '1Y');
  // Round trip for the windows the filters offer; graph-only windows have no filter value.
  for (const legacy of ['1m', '3m', '6m', '1y', 'all']) {
    assert.equal(priceRangeToLegacyRange(legacyRangeToPriceRange(legacy)), legacy, `${legacy} round trips`);
  }
  for (const graphOnly of ['1D', '1W', 'YTD', '5Y', 'CUSTOM']) {
    assert.equal(priceRangeToLegacyRange(graphOnly), null, `${graphOnly} has no opinion-filter window`);
  }
});

test('rangeLabelFor names fixed ranges from i18n and custom windows by their dates', () => {
  const { rangeLabelFor } = range;
  assert.equal(rangeLabelFor('3M', { fallback: '三月' }), '三月');
  assert.equal(rangeLabelFor('CUSTOM', { fallback: '自定义' }), '自定义');
  assert.equal(
    rangeLabelFor('CUSTOM', { customFrom: new Date(2026, 8, 26), customTo: new Date(2026, 9, 30), fallback: '自定义' }),
    'Sep 26 – Oct 30',
  );
  // A start with no end yet reads as "to today" rather than an empty label.
  const today = new Date();
  assert.match(rangeLabelFor('CUSTOM', { customFrom: new Date(2026, 8, 26), fallback: '自定义' }), /^Sep 26 – \w{3} \d{1,2}$/);
  assert.ok(today);
});
