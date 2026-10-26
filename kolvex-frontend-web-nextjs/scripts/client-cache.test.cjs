const { test } = require('node:test');
const assert = require('node:assert/strict');
const createCache = require('./helpers/client-cache.cjs');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

test('concurrent readers and repeat visits share one network request', async () => {
  const cache = createCache();
  const pending = deferred(); let calls = 0;
  const load = () => { calls++; return pending.promise; };
  const first = cache.loadClientCache('/quotes/NVDA', load);
  const second = cache.loadClientCache('/quotes/NVDA', load);
  assert.equal(calls, 1);
  pending.resolve({ price: 123 });
  assert.equal((await first).price, 123);
  assert.equal((await second).price, 123);
  assert.equal(cache.peekClientCache('/quotes/NVDA').price, 123);
  await cache.loadClientCache('/quotes/NVDA', load);
  assert.equal(calls, 1);
});

test('expired data remains readable during refresh, then is replaced; max age bounds stale data', async () => {
  let now = 0;
  const cache = createCache({ Date: { now: () => now } });
  await cache.loadClientCache('/briefs/today', async () => 'old', { ttl: 100, maxAge: 500 });
  now = 101;
  const pending = deferred();
  const refresh = cache.loadClientCache('/briefs/today', () => pending.promise, { ttl: 100, maxAge: 500 });
  assert.equal(cache.peekClientCache('/briefs/today'), 'old');
  pending.resolve('new'); await refresh;
  assert.equal(cache.peekClientCache('/briefs/today'), 'new');
  now = 602;
  assert.equal(cache.peekClientCache('/briefs/today'), undefined);
});

test('manual refresh bypasses fresh data and filtered/paged keys remain independent', async () => {
  const cache = createCache(); let calls = 0;
  const load = async () => ++calls;
  await cache.loadClientCache('/research?page=1', load);
  assert.equal(await cache.loadClientCache('/research?page=1', load, { force: true }), 2);
  await cache.loadClientCache('/research?page=2', load);
  await cache.loadClientCache('/research?scope=mine', load);
  assert.equal(calls, 4);
});

test('one cancelled reader does not abort another reader sharing the same request', async () => {
  const cache = createCache(); const pending = deferred();
  const reader = new AbortController(); let networkSignal;
  const load = signal => { networkSignal = signal; return pending.promise; };
  const first = cache.loadClientCache('/shared', load, { signal: reader.signal });
  const second = cache.loadClientCache('/shared', load);
  reader.abort();
  await assert.rejects(first, { name: 'AbortError' });
  assert.equal(networkSignal.aborted, false);
  pending.resolve('saved');
  assert.equal(await second, 'saved');
});

test('a successful mutation invalidates matching keys and old responses cannot restore them', async () => {
  const cache = createCache(); const old = deferred();
  await cache.loadClientCache('/quotes/NVDA', async () => 10);
  const obsolete = cache.loadClientCache('/research/1', () => old.promise);
  const rejected = assert.rejects(obsolete, { name: 'AbortError' });
  cache.invalidateClientCache('/research');
  await rejected;
  await cache.loadClientCache('/research/1', async () => 'new');
  old.resolve('old'); await tick();
  assert.equal(cache.peekClientCache('/research/1'), 'new');
  assert.equal(cache.peekClientCache('/quotes/NVDA'), 10);
});

test('account changes clear all snapshots, abort old requests and cannot leak a late private response', async () => {
  const cache = createCache(); cache.setClientCacheIdentity('user-a');
  await cache.loadClientCache('/portfolio', async () => 'a');
  const pending = deferred();
  const old = cache.loadClientCache('/private', () => pending.promise);
  const rejected = assert.rejects(old, { name: 'AbortError' });
  cache.setClientCacheIdentity('user-b'); await rejected;
  assert.equal(cache.peekClientCache('/portfolio'), undefined);
  pending.resolve('secret-a'); await tick();
  assert.equal(cache.peekClientCache('/private'), undefined);
  await cache.loadClientCache('/portfolio', async () => 'b');
  cache.setClientCacheIdentity('user-b');
  assert.equal(cache.peekClientCache('/portfolio'), 'b', 'token refresh for the same user preserves the cache');
});

test('failed requests are retried, refresh failures retain data, and authorization errors remove it', async () => {
  const cache = createCache();
  await assert.rejects(cache.loadClientCache('/data', async () => { throw Error('offline'); }));
  await cache.loadClientCache('/data', async () => 'saved');
  await assert.rejects(cache.loadClientCache('/data', async () => { throw Error('offline'); }, { force: true }));
  assert.equal(cache.peekClientCache('/data'), 'saved');
  await assert.rejects(cache.loadClientCache('/data', async () => { throw Object.assign(Error('expired'), { status: 401 }); }, { force: true }));
  assert.equal(cache.peekClientCache('/data'), undefined);
});

test('server renders never share responses across requests', async () => {
  const cache = createCache({ window: undefined }); let calls = 0;
  await cache.loadClientCache('/private', async () => ++calls);
  await cache.loadClientCache('/private', async () => ++calls);
  assert.equal(calls, 2);
  assert.equal(cache.peekClientCache('/private'), undefined);
});

test('timeouts settle even if a loader ignores cancellation, allowing a subsequent retry', async () => {
  let expire;
  const cache = createCache({ setTimeout: callback => { expire = callback; return 1; }, clearTimeout() {} });
  const pending = cache.loadClientCache('/slow', () => new Promise(() => {}));
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  expire(); await rejected;
  assert.equal(await cache.loadClientCache('/slow', async () => 'recovered'), 'recovered');
});
