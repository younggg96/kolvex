const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const createCache = require('./helpers/client-cache.cjs');

function fixture(file, fetch) {
  const cache = createCache();
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, fetch, TextDecoder, URLSearchParams, require: () => cache });
  return { api: exports, cache };
}

test('FRED cards, comparisons and repeat range visits share history; refresh bypasses it once', async () => {
  let calls = 0;
  const { api } = fixture('marketObservationsApi.ts', async () => {
    calls++;
    return Response.json({ history: [{ date: '2026-10-28', value: calls }] });
  });
  const signal = new AbortController().signal;
  const [card, table] = await Promise.all([
    api.loadMarketObservations('DGS10', signal), api.loadMarketObservations('DGS10', signal),
  ]);
  assert.equal(calls, 1);
  assert.equal(card, table);
  await api.loadMarketObservations('DGS10', signal, true);
  const next = await api.loadMarketObservations('DGS10', signal);
  assert.equal(calls, 2);
  assert.equal(next[0].value, 2);
  await api.loadMarketObservations('DGS2', signal);
  assert.equal(calls, 3);
});

test('one unmounted FRED reader cannot cancel another mounted view', async () => {
  let finish;
  const { api } = fixture('marketObservationsApi.ts', () => new Promise(resolve => { finish = resolve; }));
  const reader = new AbortController();
  const a = api.loadMarketObservations('DGS10', reader.signal);
  const b = api.loadMarketObservations('DGS10', new AbortController().signal);
  reader.abort();
  await assert.rejects(a, { name: 'AbortError' });
  finish(Response.json({ history: [{ date: '2026-10-28', value: 4 }] }));
  assert.equal((await b)[0].value, 4);
});

test('chat reads deduplicate; successful writes and account switches invalidate snapshots', async () => {
  const seen = [];
  const { api, cache } = fixture('chatApi.ts', async (url, options) => {
    seen.push([url, options.method ?? 'GET']);
    return Response.json({ id: 'chat', title: `version-${seen.length}`, messages: [] });
  });
  cache.setClientCacheIdentity('a');
  await Promise.all([api.getConversation('chat'), api.getConversation('chat')]);
  await api.getConversation('chat');
  assert.equal(seen.length, 1);
  await api.updateConversationTitle('chat', 'renamed');
  await api.getConversation('chat');
  assert.equal(seen.length, 3);
  cache.setClientCacheIdentity('b');
  await api.getConversation('chat');
  assert.equal(seen.length, 4);
  assert.deepEqual(seen.map(entry => entry[1]), ['GET', 'PATCH', 'GET', 'GET']);
});

test('stream start and completion discard history cached during message generation', async () => {
  let gets = 0;
  const { api } = fixture('chatApi.ts', async (url) => {
    if (url.endsWith('/stream')) return new Response('data: {"type":"done"}\n\n');
    gets++;
    return Response.json({ id: 'chat', messages: [] });
  });
  await api.getConversation('chat');
  const stream = await api.streamAgentMessage('chat', 'hello');
  await api.getConversation('chat');
  assert.equal(gets, 2);
  await api.readAgentStream(stream, () => {});
  await api.getConversation('chat');
  assert.equal(gets, 3);
});

test('malformed/failed streams invalidate partial history too', async () => {
  let gets = 0;
  const { api } = fixture('chatApi.ts', async () => {
    gets++;
    return Response.json({ id: 'chat', messages: [] });
  });
  await api.getConversation('chat');
  await assert.rejects(api.readAgentStream(new Response('data: invalid-json\n\n'), () => {}));
  await api.getConversation('chat');
  assert.equal(gets, 2);
});

test('history consumers share normalized keys and in-flight requests; date windows stay separate', async () => {
  let calls = 0;
  const { api } = fixture('stockApi.ts', async () => {
    calls++;
    return Response.json({ data: [{ date: '2026-10-28', open: 1, high: 2, low: 1, close: calls }] });
  });
  await Promise.all([
    api.getStockHistory(' nvda ', { period: '2y', interval: '1d' }),
    api.getStockHistory('NVDA', { interval: '1d', period: '2y' }),
  ]);
  assert.equal(calls, 1);
  await api.getStockHistory('NVDA', { period: '2y', interval: '1d' }, undefined, true);
  await api.getStockHistory('NVDA', { period: '2y', interval: '1d' });
  assert.equal(calls, 2);
  await api.getStockHistory('NVDA', { start: '2026-10-01', end: '2026-10-20' });
  await api.getStockHistory('NVDA', { start: '2026-10-02', end: '2026-10-20' });
  assert.equal(calls, 4);
});
