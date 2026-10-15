const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../lib/youtubeOpinionsApi.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
function fixture(fetch) {
  const exports = {};
  let now = 0;
  vm.runInNewContext(source, { exports, fetch, URLSearchParams, AbortController, setTimeout, clearTimeout, Date: { now: () => now } });
  return { api: exports, advance: (ms) => { now += ms; } };
}
const response = (data) => ({ ok: true, json: async () => data });

test('context and detail share one fetch, including offset zero, and reuse resolved data', async () => {
  let resolve;
  let calls = 0;
  const { api } = fixture(() => { calls++; return new Promise((done) => { resolve = done; }); });
  const params = { channel_id: 'creator1', limit: 40 };
  const first = api.getYouTubeOpinionDashboard(params);
  const second = api.getYouTubeOpinionDashboard({ ...params, offset: 0 });
  assert.equal(first, second);
  const data = { latest: [{ id: 'opinion1' }] };
  resolve(response(data));
  assert.equal(await first, data);
  assert.equal(api.getCachedYouTubeOpinionDashboard(params), data);
  await api.getYouTubeOpinionDashboard(params);
  assert.equal(calls, 1);
});

test('creators, dates, sentiments and pagination do not reuse each other', async () => {
  let calls = 0;
  const { api } = fixture(async (url) => { calls++; return response({ url }); });
  for (const params of [{ channel_id: 'a' }, { channel_id: 'b' }, { channel_id: 'a', date_from: '2026-10-01' }, { channel_id: 'a', sentiment: 'bullish' }, { channel_id: 'a', offset: 40 }]) {
    await api.getYouTubeOpinionDashboard(params);
  }
  assert.equal(calls, 5);
});

test('expired responses and failed requests are fetched again', async () => {
  let calls = 0;
  const { api, advance } = fixture(async () => {
    calls++;
    if (calls === 1) throw new Error('offline');
    return response({ version: calls });
  });
  await assert.rejects(api.getYouTubeOpinionDashboard(), /offline/);
  await api.getYouTubeOpinionDashboard();
  advance(30_001);
  assert.equal(api.getCachedYouTubeOpinionDashboard(), undefined);
  await api.getYouTubeOpinionDashboard();
  assert.equal(calls, 3);
});

test('manual refresh and successful edits invalidate cached results', async () => {
  let calls = 0;
  const { api } = fixture(async () => response({ version: ++calls }));
  await api.getYouTubeOpinionDashboard();
  api.clearYouTubeDashboardCache();
  await api.getYouTubeOpinionDashboard();
  await api.updateYouTubeCreator('creator1', { channel_title: 'Updated' });
  assert.equal(api.getCachedYouTubeOpinionDashboard(), undefined);
  await api.getYouTubeOpinionDashboard();
  assert.equal(calls, 4);
});

test('late responses cannot restore an invalidated or replaced cache entry', async () => {
  const pending = [];
  const { api } = fixture(() => new Promise((resolve) => pending.push(resolve)));
  const old = api.getYouTubeOpinionDashboard();
  api.clearYouTubeDashboardCache();
  const current = api.getYouTubeOpinionDashboard();
  pending[1](response({ version: 2 }));
  await current;
  pending[0](response({ version: 1 }));
  await old;
  assert.equal(api.getCachedYouTubeOpinionDashboard().version, 2);
});
