const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const module_ = { exports: {} };
const code = ts.transpileModule(fs.readFileSync(`${__dirname}/../lib/freeResearch.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
vm.runInNewContext(code, { module: module_, exports: module_.exports, URL, Date, Number, Set, Map, Object });
const lib = module_.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));

test('growth needs the same period a year earlier and a positive base', () => {
  const row = { period: '2025-12-31', revenue: 120, sources: {} };
  const year = { period: '2024-12-31', revenue: 100, sources: {} };
  assert.ok(Math.abs(lib.financialRatios(row, [row, year], true).revenue_growth - 0.2) < 1e-9);
  assert.equal(lib.financialRatios(row, [row, { ...year, period: '2024-09-30' }], true).revenue_growth, null);
  assert.equal(lib.financialRatios(row, [row, { ...year, revenue: 0 }], true).revenue_growth, null);
});
test('ROE needs a full year and positive equity; zero numerators stay meaningful', () => {
  const row = { period: '2025-12-31', net_income: 0, equity: 50, revenue: 10, free_cash_flow: -5, sources: {} };
  assert.equal(lib.financialRatios(row, [row], true).roe, 0);
  assert.equal(lib.financialRatios(row, [row], false).roe, null);
  assert.equal(lib.financialRatios({ ...row, equity: -1 }, [], true).roe, null);
  assert.equal(lib.financialRatios(row, [], true).fcf_margin, -0.5);
});
test('insider totals count only open-market trades and flag missing values', () => {
  const rows = [
    { code: 'S', shares: 10, value: 100, date: '2026-02-01' },
    { code: 'S', shares: 5, value: null, date: '2026-03-01' },
    { code: 'P', shares: 2, value: 20, date: '2026-01-15' },
    { code: 'F', shares: 99, value: 999, date: '2025-12-01' },
  ];
  const summary = plain(lib.insiderSummary(rows));
  assert.deepEqual(summary.sells, { shares: 15, value: 100, count: 2, incomplete: true });
  assert.deepEqual(summary.buys, { shares: 2, value: 20, count: 1, incomplete: false });
  assert.equal(summary.from, '2025-12-01');
  assert.equal(summary.to, '2026-03-01');
});
test('13F names only match exactly after dropping legal suffixes', () => {
  assert.equal(lib.sameIssuer('APPLE INC', 'Apple Inc.'), true);
  assert.equal(lib.sameIssuer('NVIDIA CORPORATION', 'NVIDIA Corp'), true);
  assert.equal(lib.sameIssuer('COCA COLA CO', 'The Coca-Cola Company'), true);
  assert.equal(lib.sameIssuer('APPLE HOSPITALITY REIT INC', 'Apple Inc.'), false);
  assert.equal(lib.sameIssuer('', 'Apple Inc.'), false);
  assert.equal(lib.sameIssuer('INC', 'Corp'), false);
});
test('peer lists are normalized, deduplicated, capped and exclude the stock itself', () => {
  assert.deepEqual(plain(lib.parsePeers('msft, AAPL,msft,$bad,GOOGL,BRK.B,AMD,TSLA', 'aapl')), ['MSFT', 'GOOGL', 'BRK.B', 'AMD']);
  assert.deepEqual(plain(lib.parsePeers(null, 'AAPL')), []);
});
test('returns rebase to the first date every series has', () => {
  const { start, rows, totals } = lib.rebasedReturns({
    OLD: [{ date: '2024-01-02', value: 50 }, { date: '2025-01-02', value: 100 }, { date: '2026-01-02', value: 150 }],
    NEW: [{ date: '2025-01-02T00:00:00', value: 10 }, { date: '2026-01-02T00:00:00', value: 5 }],
    NONE: [],
  });
  assert.equal(start, '2025-01-02');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].OLD, 0);
  assert.equal(totals.OLD, 0.5);
  assert.equal(totals.NEW, -0.5);
  assert.equal(totals.NONE, undefined);
});
test('only a known currency difference hides cross-currency ratios', () => {
  assert.equal(lib.mixesCurrencies('USD', 'TWD'), true);
  assert.equal(lib.mixesCurrencies('USD', 'usd'), false);
  assert.equal(lib.mixesCurrencies('USD', null), false);
});
