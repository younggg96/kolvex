const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function fixture({ user = { id: 'alice' }, fail = false, rows = [] } = {}) {
  const calls = [];
  const query = new Proxy({}, { get: (_, name) => name === 'then' ? resolve => resolve({ error: fail }) : (...args) => {
    calls.push([name, ...args]);
    if (name === 'range') return Promise.resolve({ data: rows.slice(args[0], args[1] + 1), error: fail });
    return name === 'eq' || name === 'select' || name === 'order' || name === 'delete' ? query : Promise.resolve({ error: fail });
  }});
  const db = { auth: { getUser: async () => ({ data: { user } }) }, from: name => { calls.push(['from', name]); return query; }, rpc: async (...args) => { calls.push(['rpc', ...args]); return { error: fail }; } };
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/api/watchlist/route.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require: name => {
    if (name === 'next/server') return { NextResponse: Response };
    if (name.endsWith('/server')) return { createServerSupabaseClient: async () => db };
    if (name.endsWith('/watchlist')) return { normalizeWatchlistTicker: value => /^[A-Z][A-Z0-9.-]{0,9}$/.test(value.trim().replace(/^\$/, '').toUpperCase()) ? value.trim().replace(/^\$/, '').toUpperCase() : null };
    throw Error(name);
  }});
  return { calls, call: (method, body, identity = 'alice') => exports[method]({ headers: new Headers({ 'X-Watchlist-User': identity }), json: async () => body === 'malformed' ? JSON.parse('{') : body }) };
}
test('requires verified authentication and rejects stale account headers before database access', async () => {
  const anonymous = fixture({ user: null }); assert.equal((await anonymous.call('GET')).status, 401); assert.equal(anonymous.calls.length, 0);
  const other = fixture(); assert.equal((await other.call('PUT', { ticker: 'AAPL' }, 'bob')).status, 409); assert.equal(other.calls.length, 0);
});
test('lists only the authenticated user, paginates beyond 1000, and disables caching', async () => {
  const f = fixture({ rows: Array.from({ length: 1001 }, (_, i) => ({ ticker: `S${i}`, created_at: '2026-10-30' })) });
  const response = await f.call('GET'); assert.equal(response.status, 200);
  assert.equal((await response.json()).items.length, 1001); assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.equal(f.calls.filter(call => call[0] === 'range').length, 2);
  assert.ok(f.calls.some(call => JSON.stringify(call) === '["eq","user_id","alice"]'));
});
test('validates malformed JSON/tickers/import payloads without mutating', async () => {
  for (const method of ['PUT', 'DELETE', 'POST']) {
    for (const body of ['malformed', null, [], {}, { ticker: '../bad' }, { ticker: 5 }]) {
      const f = fixture(); assert.equal((await f.call(method, body)).status, 400); assert.equal(f.calls.length, 0);
    }
  }
});
test('add is idempotent, preserves timestamps, and ignores client-supplied ownership', async () => {
  const f = fixture(); assert.equal((await f.call('PUT', { ticker: 'aapl', user_id: 'bob' })).status, 200);
  const upsert = f.calls.find(call => call[0] === 'upsert');
  assert.deepEqual(JSON.parse(JSON.stringify(upsert)), ['upsert', { user_id: 'alice', ticker: 'AAPL' }, { onConflict: 'user_id,ticker', ignoreDuplicates: true }]);
});
test('delete is constrained by both authenticated account and normalized ticker', async () => {
  const f = fixture(); assert.equal((await f.call('DELETE', { ticker: 'brk-b', user_id: 'bob' })).status, 200);
  assert.ok(f.calls.some(call => JSON.stringify(call) === '["eq","user_id","alice"]'));
  assert.ok(f.calls.some(call => JSON.stringify(call) === '["eq","ticker","BRK-B"]'));
});
test('imports call the atomic RPC with a stable source ID and normalized deduplicated symbols', async () => {
  const f = fixture(); const sourceId = '76def625-b771-4eb9-99f0-bb8c15b9cc16';
  assert.equal((await f.call('POST', { tickers: ['aapl', 'AAPL'], sourceId })).status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(f.calls[0])), ['rpc', 'import_user_watchlist', { tickers: ['AAPL'], source_id: sourceId }]);
});
test('storage failures return 503, never false success', async () => {
  for (const method of ['GET', 'PUT', 'DELETE', 'POST']) {
    const f = fixture({ fail: true }); const body = method === 'POST' ? { tickers: ['AAPL'], sourceId: '76def625-b771-4eb9-99f0-bb8c15b9cc16' } : { ticker: 'AAPL' };
    assert.equal((await f.call(method, body)).status, 503);
  }
});
