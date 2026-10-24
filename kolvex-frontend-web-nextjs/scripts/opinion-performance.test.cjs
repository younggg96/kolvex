const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const moduleFixture = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/opinionPerformance.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: moduleFixture, exports: moduleFixture.exports });
const { opinionPerformance, supportsOpinionPerformance } = moduleFixture.exports;
test('US session calculation excludes overseas listings, FX and crypto pairs', () => {
  for (const symbol of ['NVDA', 'SPY', 'BRK.B', 'BRK-B']) assert.equal(supportsOpinionPerformance(symbol), true);
  for (const symbol of ['000660.KS', '005930', '0700.HK', 'NGT-USD', '^GSPC', 'EURUSD=X']) assert.equal(supportsOpinionPerformance(symbol), false);
});
const bar = (date, open, close) => ({ date, open, close, high: close, low: open, volume: 1 });
test('uses the next session open and excludes publication day and current incomplete session', () => {
  const result = opinionPerformance([
    bar('2026-10-26', 110, 112), bar('2026-10-23', 100, 105),
    bar('2026-10-22', 50, 70), bar('2026-10-27', 200, 300),
  ], '2026-10-22', '2026-10-27');
  assert.equal(result.from, '2026-10-23');
  assert.equal(result.to, '2026-10-26');
  assert.ok(Math.abs(result.percent - 12) < 0.0001);
  assert.equal(result.sessions, 2);
});
test('weekend publication waits for the first completed session', () => {
  assert.equal(opinionPerformance([bar('2026-10-23', 100, 110)], '2026-10-24', '2026-10-26'), null);
  const result = opinionPerformance([bar('2026-10-26', 100, 90)], '2026-10-24', '2026-10-27');
  assert.ok(Math.abs(result.percent + 10) < 0.0001);
});
test('missing and invalid prices never become a zero return', () => {
  assert.equal(opinionPerformance([], '2026-10-22', '2026-10-27'), null);
  assert.equal(opinionPerformance([bar('2026-10-23', 0, 10), bar('2026-10-26', 10, NaN)], '2026-10-22', '2026-10-27'), null);
  assert.equal(opinionPerformance([bar('2026-10-23', 0, 10), bar('2026-10-26', 10, 20)], '2026-10-22', '2026-10-27'), null);
});
