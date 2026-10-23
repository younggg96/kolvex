const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    process: { env: { CNN_FEAR_GREED_DISPLAY_ENABLED: dependencies.enabled === false ? undefined : "true" } },
    module, exports: module.exports, fetch: dependencies.fetch, Date: dependencies.Date || Date, AbortSignal,
    require(name) {
      if (name === 'next/server') return { NextResponse: Response };
      if (name === '@/lib/fearGreed') return helpers;
      if (name === '@/lib/supabase/server') return { createServerSupabaseClient: async () => ({ auth: { getUser: async () => ({ data: { user: dependencies.session === null ? null : { id: 'verified-user' } } }) } }) };
      throw Error(name);
    },
  });
  return module.exports;
}
const helpers = load('lib/fearGreed.ts');
const payload = score => ({ fear_and_greed: { score, rating: 'extreme fear', timestamp: '2026-10-22T20:00:00Z', previous_close: 24.5 } });
const route = dependencies => load('app/api/market/fear-greed/route.ts', dependencies);
test('valid CNN observations preserve score, rating, source time and previous close, including zero', () => {
  for (const score of [0, 18.35, 100]) {
    const result = helpers.parseFearGreed(payload(score));
    assert.equal(result.score, score);
    assert.equal(result.previousClose, 24.5);
    assert.equal(result.timestamp, '2026-10-22T20:00:00.000Z');
  }
});
test('invalid values and unknown ratings never become a plausible sentiment reading', () => {
  for (const value of [null, {}, payload('20'), payload(-1), payload(101), payload(Infinity), { fear_and_greed: { ...payload(20).fear_and_greed, rating: 'unknown' } }, { fear_and_greed: { ...payload(20).fear_and_greed, timestamp: 'bad date' } }]) {
    assert.throws(() => helpers.parseFearGreed(value));
  }
  assert.equal(helpers.parseFearGreed({ fear_and_greed: { ...payload(20).fear_and_greed, previous_close: null } }).previousClose, null);
});
test('unauthenticated requests never contact CNN', async () => {
  const api = route({ session: null, fetch: () => { throw Error('must not fetch'); } });
  assert.equal((await api.GET()).status, 401);
});
test('concurrent viewers share one fetch and successful snapshots are cached privately', async () => {
  let calls = 0;
  const api = route({ fetch: async () => { calls++; return Response.json(payload(18)); } });
  const responses = await Promise.all([api.GET(), api.GET(), api.GET()]);
  await api.GET();
  assert.equal(calls, 1);
  assert.equal(responses[0].headers.get('Cache-Control'), 'private, no-store');
  assert.equal((await responses[0].json()).score, 18);
});
test('blocked, timed out and malformed sources produce 503 with a retry cooldown', async () => {
  for (const upstream of [async () => new Response('blocked', { status: 418 }), async () => { throw Error('timeout'); }, async () => Response.json({})]) {
    let calls = 0;
    const api = route({ fetch: async (...args) => { calls++; return upstream(...args); } });
    assert.equal((await api.GET()).status, 503);
    assert.equal((await api.GET()).status, 503);
    assert.equal(calls, 1);
  }
});
test('a failed refresh preserves an explicitly stale reading for at most 24 hours', async () => {
  let now = Date.now();
  class Clock extends Date { static now() { return now; } }
  let calls = 0;
  const api = route({ Date: Clock, fetch: async () => ++calls === 1 ? Response.json(payload(18)) : new Response('blocked', { status: 418 }) });
  assert.equal((await (await api.GET()).json()).status, 'ready');
  now += 16 * 60_000;
  const stale = await (await api.GET()).json();
  assert.equal(stale.status, 'stale');
  assert.equal(stale.timestamp, '2026-10-22T20:00:00.000Z');
  now += 24 * 60 * 60_000;
  assert.equal((await api.GET()).status, 503);
});

test('unconfirmed display rights expose the CNN source entry without fetching or redistributing data', async () => {
  const api = route({ enabled: false, fetch: () => { throw Error('must not fetch'); } });
  const response = await api.GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'source_only' });
});
