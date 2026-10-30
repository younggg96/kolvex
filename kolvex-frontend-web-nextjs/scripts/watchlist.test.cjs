const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function load(file, require = () => {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, require, Error, crypto: requireCrypto });
  return exports;
}
const requireCrypto = require('node:crypto').webcrypto;
const utils = load('../lib/watchlist.ts');
const { createWatchlistStore } = load('../lib/watchlistStore.ts', () => utils);
const { parseWatchlist, normalizeWatchlistTicker, WATCHLIST_KEY, LEGACY_WATCHLIST_KEY } = utils;
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(initial = {}) {
  const values = new Map(Object.entries(initial));
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const accounts = new Map(), imports = new Set(), calls = [];
  let fail = null;
  const request = async (userId, method, body) => {
    calls.push({ userId, method, body });
    if (fail === method) throw Error('network');
    const items = accounts.get(userId) ?? [];
    if (method === 'GET') return { userId, items: items.map(ticker => ({ ticker })) };
    if (method === 'POST' && !imports.has(`${userId}:${body.sourceId}`)) {
      imports.add(`${userId}:${body.sourceId}`);
      accounts.set(userId, [...new Set([...items, ...body.tickers])]);
    }
    if (method === 'PUT') accounts.set(userId, [...new Set([...items, body.ticker])]);
    if (method === 'DELETE') accounts.set(userId, items.filter(ticker => ticker !== body.ticker));
    return { userId };
  };
  return { values, storage, accounts, imports, calls, request, store: createWatchlistStore(request, () => storage), setFail: value => { fail = value; } };
}
test('normalizes symbols and rejects corrupt legacy data', () => {
  assert.equal(normalizeWatchlistTicker(' $aapl '), 'AAPL');
  assert.equal(normalizeWatchlistTicker('../x'), null);
  for (const raw of [null, '{bad', '{}', 'null']) assert.equal(parseWatchlist(raw).length, 0);
  assert.deepEqual(Array.from(parseWatchlist('["aapl","AAPL",5,null,"BRK-B"]')), ['AAPL', 'BRK-B']);
});
test('persists additions/removals across independent device stores and refreshes', async () => {
  const f = fixture(); f.store.setIdentity('alice'); await tick();
  assert.equal(await f.store.setTicker('AAPL', true), true);
  const other = createWatchlistStore(f.request, () => { throw Error('blocked storage'); });
  other.setIdentity('alice'); await tick(); assert.equal(other.getSnapshot().watchlist.join(','), 'AAPL');
  await other.setTicker('MSFT', true); await f.store.refresh();
  assert.equal(f.store.getSnapshot().watchlist.join(','), 'AAPL,MSFT');
  await f.store.setTicker('AAPL', false); await other.refresh();
  assert.equal(other.getSnapshot().watchlist.join(','), 'MSFT');
});
test('failed writes never update the list or report success; refresh recovers', async () => {
  const f = fixture(); f.store.setIdentity('alice'); await tick();
  f.setFail('PUT'); assert.equal(await f.store.setTicker('AAPL', true), false);
  assert.equal(f.store.getSnapshot().watchlist.length, 0); assert.equal(f.store.getSnapshot().error, 'save');
  f.setFail(null); await f.store.refresh(); assert.equal(await f.store.setTicker('AAPL', true), true);
  f.setFail('DELETE'); assert.equal(await f.store.setTicker('AAPL', false), false);
  assert.equal(f.store.getSnapshot().watchlist.join(','), 'AAPL');
});
test('legacy migration is durable, idempotent and does not restore deleted stocks', async () => {
  const f = fixture({ [LEGACY_WATCHLIST_KEY]: '["AAPL","MSFT"]' });
  f.store.setIdentity('alice'); await tick();
  assert.equal(f.store.getSnapshot().watchlist.join(','), 'AAPL,MSFT');
  assert.equal(f.values.has(LEGACY_WATCHLIST_KEY), false);
  await f.store.setTicker('AAPL', false);
  // Simulate a crash before local cleanup: server marker prevents resurrection.
  f.values.set(LEGACY_WATCHLIST_KEY, '["AAPL","MSFT"]');
  await f.store.refresh(); assert.equal(f.store.getSnapshot().watchlist.join(','), 'MSFT');
});
test('failed migration retains local data and never imports it into a different account', async () => {
  const f = fixture({ [WATCHLIST_KEY]: '["AAPL"]' }); f.setFail('POST');
  f.store.setIdentity('alice'); await tick();
  assert.equal(f.store.getSnapshot().error, 'migration'); assert.ok(f.values.has(WATCHLIST_KEY));
  f.setFail(null); f.store.setIdentity('bob'); await tick();
  assert.equal(f.store.getSnapshot().watchlist.length, 0); assert.ok(f.values.has(WATCHLIST_KEY));
  f.store.setIdentity('alice'); await tick(); assert.equal(f.store.getSnapshot().watchlist.join(','), 'AAPL');
});
test('switching accounts or logging out ignores late loads and mutations', async () => {
  let finish;
  const store = createWatchlistStore((id, method) => method === 'GET' ? Promise.resolve({ userId: id, items: [] }) : new Promise(resolve => { finish = resolve; }), () => { throw Error('blocked'); });
  store.setIdentity('alice'); await tick(); const mutation = store.setTicker('AAPL', true);
  store.setIdentity('bob'); await tick(); finish({ userId: 'alice' });
  assert.equal(await mutation, false); assert.equal(store.getSnapshot().watchlist.length, 0);
  assert.equal(store.getSnapshot().userId, 'bob'); store.setIdentity(null);
  assert.equal(await store.setTicker('MSFT', true), false);
});
test('a background read cannot overwrite a newer acknowledged change; double clicks are guarded', async () => {
  const f = fixture(); let finish, delayed = false;
  const store = createWatchlistStore((...args) => delayed && args[1] === 'GET' ? new Promise(resolve => { finish = resolve; }) : f.request(...args), () => f.storage);
  store.setIdentity('alice'); await tick(); delayed = true; const read = store.refresh();
  const write = store.setTicker('AAPL', true);
  assert.equal(await store.setTicker('MSFT', true), false);
  await write; finish({ userId: 'alice', items: [] }); await read;
  assert.equal(store.getSnapshot().watchlist.join(','), 'AAPL');
});
test('failed initial load has retry state and mismatched account responses are rejected', async () => {
  const f = fixture(); f.setFail('GET'); f.store.setIdentity('alice'); await tick();
  assert.equal(f.store.getSnapshot().error, 'load'); assert.equal(f.store.getSnapshot().ready, true);
  f.setFail(null); await f.store.refresh(); assert.equal(f.store.getSnapshot().error, null);
  const store = createWatchlistStore(async () => ({ userId: 'bob', items: [{ ticker: 'PRIVATE' }] }), () => f.storage);
  store.setIdentity('alice'); await tick(); assert.equal(store.getSnapshot().watchlist.length, 0);
  assert.equal(store.getSnapshot().error, 'load');
});
test('late initial loads cannot leak data after account changes', async () => {
  let finishAlice;
  const f = fixture();
  const store = createWatchlistStore((id, method, body) => id === 'alice' && method === 'GET' ? new Promise(resolve => { finishAlice = resolve; }) : f.request(id, method, body), () => f.storage);
  store.setIdentity('alice'); store.setIdentity('bob'); await tick();
  finishAlice({ userId: 'alice', items: [{ ticker: 'AAPL' }] }); await tick();
  assert.equal(store.getSnapshot().userId, 'bob'); assert.equal(store.getSnapshot().watchlist.length, 0);
});
test('another browser can migrate its own list without overwriting existing cloud stocks', async () => {
  const f = fixture({ [WATCHLIST_KEY]: '["AAPL"]' }); f.store.setIdentity('alice'); await tick();
  const values = new Map([[WATCHLIST_KEY, '["NVDA"]']]);
  const other = createWatchlistStore(f.request, () => ({ getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }));
  other.setIdentity('alice'); await tick();
  assert.equal(other.getSnapshot().watchlist.join(','), 'AAPL,NVDA'); assert.equal(f.imports.size, 2);
});
test('expired sessions keep confirmed list and expose authentication recovery without local writes', async () => {
  const f = fixture(); let expired = false;
  const store = createWatchlistStore((...args) => expired ? Promise.reject(Error('auth')) : f.request(...args), () => f.storage);
  store.setIdentity('alice'); await tick(); await store.setTicker('AAPL', true); expired = true;
  assert.equal(await store.setTicker('MSFT', true), false); assert.equal(store.getSnapshot().error, 'auth');
  assert.equal(store.getSnapshot().watchlist.join(','), 'AAPL'); assert.equal(f.values.has(WATCHLIST_KEY), false);
});
