const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const dateFns = require('date-fns');

function compile(file, mocks = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require: key => mocks[key] ?? require(key), console });
  return module.exports;
}

const timeframes = compile('components/youtube/chart/timeframes.ts', { 'date-fns': dateFns });

/** Same weekday/time, `months` calendar months before `date` (date-fns semantics the source uses). */
function shiftMonths(date, months) {
  return dateFns.subMonths(new Date(date), months);
}

test('6M sits between 3M and YTD in the range list and in both per-range maps', () => {
  const ranges = timeframes.advancedRanges;
  assert.ok(ranges.includes('6M'));
  assert.equal(ranges.indexOf('6M'), ranges.indexOf('3M') + 1);
  assert.equal(ranges.indexOf('YTD'), ranges.indexOf('6M') + 1);
  assert.deepEqual([...ranges].sort(), ['1D', '1M', '1W', '1Y', '3M', '5Y', '6M', 'ALL', 'YTD']);
  assert.deepEqual(Array.from(timeframes.rangeIntervals['6M']), ['1h', '4h', '1d', '1wk']);
  assert.equal(timeframes.defaultInterval['6M'], '1d');
});

test('every declared range has an interval list holding its default and still returns loadable params', () => {
  for (const range of timeframes.advancedRanges) {
    assert.ok(Array.isArray(timeframes.rangeIntervals[range]), `${range} has no interval list`);
    assert.ok(timeframes.rangeIntervals[range].includes(timeframes.defaultInterval[range]), `${range} default is not selectable`);
    for (const interval of timeframes.rangeIntervals[range]) {
      const params = timeframes.advancedHistoryParams(range, interval);
      assert.equal(params.interval, interval);
      assert.ok(params.period || (params.start && params.end), `${range}/${interval} has no window`);
    }
  }
});

test('a 6M daily view still loads enough history to warm long EMAs', () => {
  assert.equal(timeframes.advancedHistoryParams('6M', '1d').period, '5y');
  assert.equal(timeframes.advancedHistoryParams('6M', '1wk').period, 'max');
  const hourly = timeframes.advancedHistoryParams('6M', '1h');
  const span = dateFns.differenceInCalendarDays(new Date(hourly.end), new Date(hourly.start));
  assert.ok(span >= 365, `hourly history must cover well over six months, got ${span} days`);
});

test('rangeStart("6M") is six calendar months before the last bar and earlier than 3M', () => {
  const lastBar = Date.parse('2026-10-30T20:00:00Z');
  const start = timeframes.rangeStart('6M', lastBar);
  assert.equal(start, shiftMonths(new Date(lastBar), 6).getTime());
  assert.equal(start, Date.parse('2026-04-30T20:00:00Z'));
  assert.ok(start < timeframes.rangeStart('3M', lastBar));
  assert.ok(start > timeframes.rangeStart('1Y', lastBar));
  // A 31st anchors on the shorter month like the other month ranges do (date-fns overflow semantics).
  const monthEnd = Date.parse('2026-08-31T12:00:00Z');
  assert.equal(timeframes.rangeStart('6M', monthEnd), shiftMonths(new Date(monthEnd), 6).getTime());
  assert.equal(timeframes.rangeStart('ALL', lastBar), null);
});

test('intraday detection keeps the 6M default daily interval out of intraday mode', () => {
  assert.equal(timeframes.isIntraday(timeframes.defaultInterval['6M']), false);
  assert.equal(timeframes.isIntraday('1h'), true);
  assert.equal(timeframes.isIntraday('1mo'), false);
});
