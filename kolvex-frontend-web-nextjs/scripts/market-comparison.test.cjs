const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, Date, require: name => mocks[name] });
  return module.exports;
}
const observations = load('lib/marketObservations.ts');
const { comparisonSnapshot, completedComparisonDate, COMPARISON_PERIODS } = load('lib/marketComparison.ts', { './marketObservations': observations });
const instrument = { symbol: 'XLY', en: 'Consumer discretionary', zh: '非必需品消费' };
const history = [
  ['2025-10-23', 100], ['2025-12-31', 110], ['2026-09-23', 120], ['2026-09-30', 125],
  ['2026-10-01', 126], ['2026-10-16', 130], ['2026-10-22', 135], ['2026-10-23', 140],
].map(([date, value]) => ({ date, value }));
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`);

test('all comparison columns use one close and correct prior-period baselines', () => {
  const result = comparisonSnapshot(history, instrument, '2026-10-26');
  assert.equal(result.value, 140);
  assert.equal(result.date, '2026-10-23');
  assert.equal(result.unit, 'percent');
  close(result.changes['1D'], 5 / 135 * 100);
  close(result.changes['1W'], 10 / 130 * 100);
  close(result.changes['1M'], 20 / 120 * 100);
  close(result.changes['1Y'], 40);
  close(result.changes.QTD, 12);
  close(result.changes.YTD, 30 / 110 * 100);
  assert.equal(COMPARISON_PERIODS.length, 6);
});

test('yields and credit spreads use percentage-point changes, MOVE uses point changes', () => {
  for (const symbol of ['DGS2', 'DGS10', 'BAMLH0A0HYM2']) {
    const result = comparisonSnapshot(history, { ...instrument, symbol, unit: 'percent' }, '2026-10-26');
    assert.equal(result.unit, 'pp');
    assert.equal(result.changes['1D'], 5);
    assert.equal(result.changes['1Y'], 40);
  }
  const move = comparisonSnapshot(history, { ...instrument, symbol: '^MOVE', unit: 'points' }, '2026-10-26');
  assert.equal(move.unit, 'points');
  assert.equal(move.changes.YTD, 30);
  assert.equal(comparisonSnapshot(history, { ...instrument, symbol: 'DX-Y.NYB', unit: 'points' }, '2026-10-26').unit, 'percent');
});

test('holidays use the last prior close and month-end dates clamp across leap years', () => {
  const holiday = comparisonSnapshot(history.filter(point => point.date !== '2026-10-16'), instrument, '2026-10-26');
  assert.equal(holiday.changes['1W'], null); // No close within ten days of the target.
  const withHoliday = [...history, { date: '2026-10-15', value: 128 }];
  close(comparisonSnapshot(withHoliday.filter(point => point.date !== '2026-10-16'), instrument, '2026-10-26').changes['1W'], 12 / 128 * 100);
  const february = [{ date: '2024-02-28', value: 100 }, { date: '2024-02-29', value: 105 }, { date: '2024-03-31', value: 115 }];
  close(comparisonSnapshot(february, instrument, '2024-03-31').changes['1M'], 10 / 105 * 100);
});

test('missing baselines, no current-year release and zero price bases stay unavailable', () => {
  const listed = comparisonSnapshot(history.slice(3), instrument, '2026-10-26');
  assert.equal(listed.changes['1Y'], null);
  assert.equal(listed.changes.YTD, null);
  close(listed.changes.QTD, 12);
  const newYear = comparisonSnapshot(history, instrument, '2027-01-01');
  assert.equal(newYear.changes.QTD, null);
  assert.equal(newYear.changes.YTD, null);
  const zero = [{ date: '2026-10-22', value: 0 }, { date: '2026-10-23', value: -0.2 }];
  assert.equal(comparisonSnapshot(zero, instrument, '2026-10-26').changes['1D'], null);
  assert.equal(comparisonSnapshot(zero, { ...instrument, unit: 'percent' }, '2026-10-26').changes['1D'], -0.2);
});

test('invalid or future observations cannot become the comparison close', () => {
  const result = comparisonSnapshot([...history, { date: '2026-10-24', value: NaN }, { date: '2027-01-01', value: 999 }], instrument, '2026-10-26');
  assert.equal(result.value, 140);
  assert.equal(comparisonSnapshot([], instrument, '2026-10-26').value, null);
});

test('unfinished daily candles are excluded, using New York closes and UTC crypto days', () => {
  const beforeClose = new Date('2026-10-26T20:00:00Z'); // 16:00 New York.
  const afterClose = new Date('2026-10-26T22:00:00Z');
  assert.equal(completedComparisonDate(instrument, beforeClose), '2026-10-25');
  assert.equal(completedComparisonDate(instrument, afterClose), '2026-10-26');
  assert.equal(completedComparisonDate({ ...instrument, symbol: 'GC=F' }, beforeClose), '2026-10-25');
  assert.equal(completedComparisonDate({ ...instrument, symbol: 'BTC-USD' }, afterClose), '2026-10-25');
  assert.equal(completedComparisonDate({ ...instrument, source: 'fred' }, beforeClose), '2026-10-26');
  assert.equal(completedComparisonDate(instrument, new Date('2026-01-02T21:30:00Z')), '2026-01-01'); // Winter offset.
});
