const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');

function fixture(fetch) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/stockValuation.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, fetch, Date, URLSearchParams, DOMException,
    setTimeout: (fn) => { queueMicrotask(fn); return 1; }, clearTimeout: () => {} });
  return module.exports;
}

const reply = (status, data) => ({ status, ok: status >= 200 && status < 300, json: async () => data });

test('month-end target dates clamp to the target calendar without timezone drift', () => {
  const { projectionDates } = fixture();
  assert.deepEqual(Array.from(projectionDates('2026-01-31')), ['2026-04-30', '2026-07-31', '2026-10-31']);
  assert.deepEqual(Array.from(projectionDates('2026-11-04')), ['2027-02-04', '2027-05-04', '2027-08-04']);
});

test('pilot unsupported state does not poll jobs or pretend to contain history', async () => {
  let reads = 0;
  const { loadValuation } = fixture(async () => { reads++; return reply(200, { status: 'unsupported' }); });
  assert.equal((await loadValuation('TSLA', 3, new AbortController().signal)).status, 'unsupported');
  assert.equal(reads, 1);
});

test('a queued build polls its real job and rereads data only after completion', async () => {
  const reads = [];
  const responses = [reply(202, { job_id: 'j' }), reply(200, { status: 'running' }),
    reply(200, { status: 'complete' }), reply(200, { symbol: 'NVDA', points: [], current: {}, snapshot_id: 'x' })];
  const { loadValuation } = fixture(async (url) => { reads.push(url); return responses.shift(); });
  const data = await loadValuation('NVDA', 5, new AbortController().signal);
  assert.equal(data.symbol, 'NVDA');
  assert.deepEqual(reads, ['/api/market/valuation/NVDA/history?years=5', '/api/market/valuation/jobs/j',
    '/api/market/valuation/jobs/j', '/api/market/valuation/NVDA/history?years=5']);
});

test('failed jobs terminate instead of silently regenerating or returning sample data', async () => {
  const responses = [reply(202, { job_id: 'j' }), reply(200, { status: 'failed' })];
  const { loadValuation } = fixture(async () => responses.shift());
  await assert.rejects(loadValuation('NVDA', 3, new AbortController().signal), /source unavailable/);
});

test('cancellation stops waiting before job polling', async () => {
  const controller = new AbortController();
  const { loadValuation } = fixture(async () => { controller.abort(); return reply(202, { job_id: 'j' }); });
  await assert.rejects(loadValuation('NVDA', 3, controller.signal), { name: 'AbortError' });
});

test('simulation posts the immutable source snapshot and percent fractions', async () => {
  let sent;
  const { simulateValuation } = fixture(async (_url, options) => { sent = options; return reply(200, { result_kind: 'personal_simulation' }); });
  const signal = new AbortController().signal;
  await simulateValuation('NVDA', { snapshot_id: 'immutable', as_of: '2026-11-04' },
    { conservative: 16, base: 20, optimistic: 24 }, { conservative: 0, base: .2, optimistic: .3 }, signal);
  const body = JSON.parse(sent.body);
  assert.equal(body.snapshot_id, 'immutable');
  assert.equal(body.growth.base, .2);
  assert.equal(sent.signal, signal);
  assert.equal(body.target_dates[0], '2027-02-04');
});

test('invalid PE order, NaN and growth below minus 100 percent are rejected', () => {
  const { validateValuationAssumptions } = fixture();
  const pe = { conservative: 16, base: 20, optimistic: 24 };
  const growth = { conservative: 0, base: 0, optimistic: 0 };
  assert.equal(validateValuationAssumptions(pe, growth), true);
  assert.equal(validateValuationAssumptions({ ...pe, base: 25 }, growth), false);
  assert.equal(validateValuationAssumptions({ ...pe, base: NaN }, growth), false);
  assert.equal(validateValuationAssumptions(pe, { ...growth, base: -1 }), false);
});

test('stale snapshots preserve a conflict status for recovery', async () => {
  const { simulateValuation } = fixture(async () => reply(409, {}));
  await assert.rejects(simulateValuation('NVDA', { snapshot_id: 'old', as_of: '2026-11-04' }, {}, {}, new AbortController().signal), { status: 409 });
});
