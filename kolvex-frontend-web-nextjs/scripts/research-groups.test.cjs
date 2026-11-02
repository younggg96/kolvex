const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(fetchPage) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(`${__dirname}/../lib/researchGroups.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: () => ({ getPublishedAnalyses: fetchPage }), Map, Error });
  return module.exports;
}
const task = (id, ticker, date) => ({ id, ticker, trade_date: date, created_at: `${date}T12:00:00Z` });
test('groups repeated symbols and orders by research date, retaining same-day tasks', () => {
  const rows = [task('a', 'GOOGL', '2026-10-30'), task('b', 'MSFT', '2026-11-01'), task('c', 'googl', '2026-11-02'), task('d', 'GOOGL', '2026-11-02')];
  const groups = load().groupResearchByStock(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].ticker, 'GOOGL');
  assert.equal(groups[0].tasks.map(x => x.id).join(','), 'd,c,a');
  assert.equal(rows[0].id, 'a');
});
test('loads task pages before grouping and forwards cancellation', async () => {
  const controller = new AbortController(); const calls = [];
  const catalog = load(async (params, signal) => {
    calls.push(params.offset); assert.equal(signal, controller.signal);
    return params.offset === 0 ? { items: [task('a', 'NVDA', '2026-11-01')], total: 2 } : { items: [task('b', 'NVDA', '2026-10-01')], total: 2 };
  });
  const rows = await catalog.loadResearchCatalog(controller.signal);
  assert.deepEqual(calls, [0, 1]);
  assert.equal(catalog.groupResearchByStock(rows)[0].tasks.length, 2);
});
test('does not silently present an incomplete catalog as complete', async () => {
  await assert.rejects(load(async () => ({ items: [], total: 2 })).loadResearchCatalog(new AbortController().signal), /Incomplete/);
});
