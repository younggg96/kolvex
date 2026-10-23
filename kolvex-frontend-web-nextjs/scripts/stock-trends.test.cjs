const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function fixture(getStockHistory) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/stockTrends.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, DOMException, Date, require: () => ({ getStockHistory }) });
  return module.exports;
}
const bars = [{ date: '2026-10-21T16:00:00', close: 120 }, { date: '2026-10-22T09:30:00', close: 100 }, { date: '2026-10-22T10:00:00', close: 110 }];
const params = { period: '1d', interval: '5m' };
const tick = () => new Promise(resolve => setImmediate(resolve));
test('intraday previews use only the latest session and exclude invalid prices', () => {
  const { trendPoints, trendPath } = fixture();
  const points = trendPoints([...bars, { date: '2026-10-23', close: NaN }].reverse(), true);
  assert.equal(points.length, 2);
  assert.equal(points[0].value, 100);
  assert.equal(points[1].value, 110);
  assert.equal(trendPath(points), '2.00,34.00 98.00,6.00');
  assert.equal(trendPath([{ date: 'a', value: 2 }, { date: 'b', value: 2 }]), '2.00,20.00 98.00,20.00');
  assert.equal(trendPath(points.slice(0, 1)), '');
});
test('preview requests are limited to three and successful ranges are cached separately', async () => {
  let active = 0, max = 0, calls = 0;
  const { loadStockTrend } = fixture(async () => { calls++; max = Math.max(max, ++active); await tick(); active--; return bars; });
  const signal = new AbortController().signal;
  await Promise.all(['A','B','C','D','E','F','G'].map(symbol => loadStockTrend(symbol, params, signal)));
  assert.equal(max, 3);
  await loadStockTrend('A', params, signal);
  assert.equal(calls, 7);
  await loadStockTrend('A', { period: '1mo', interval: '1d' }, signal);
  assert.equal(calls, 8);
});
test('queued requests cancel without contacting the provider and release capacity on failures', async () => {
  const finishes = [], seen = [];
  const { loadStockTrend } = fixture((symbol) => {
    seen.push(symbol);
    return new Promise((resolve, reject) => finishes.push({ resolve, reject }));
  });
  const signal = new AbortController().signal;
  const running = ['A','B','C'].map(symbol => loadStockTrend(symbol, params, signal).catch(() => []));
  const controller = new AbortController();
  const queued = loadStockTrend('D', params, controller.signal);
  controller.abort();
  await assert.rejects(queued, { name: 'AbortError' });
  finishes.forEach(finish => finish.reject(new Error('upstream failure')));
  await Promise.all(running);
  assert.deepEqual(seen, ['A','B','C']);
  const next = loadStockTrend('E', params, signal);
  await tick();
  assert.equal(seen.at(-1), 'E');
  finishes.at(-1).resolve(bars);
  await next;
});
test('cancelled in-flight ranges cannot populate the cache with late results', async () => {
  let finish, calls = 0;
  const { loadStockTrend } = fixture(async () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const controller = new AbortController();
  const first = loadStockTrend('A', params, controller.signal);
  controller.abort();finish(bars);
  await assert.rejects(first, { name: 'AbortError' });
  const second = loadStockTrend('A', params, new AbortController().signal);
  await tick();finish(bars);await second;
  assert.equal(calls, 2);
});
