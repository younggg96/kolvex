const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
function load(file, overrides = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, { exports, require: (name) => {
    if (name in overrides) return overrides[name];
    throw new Error('Unexpected module ' + name);
  }, Date, AbortSignal, console: {error() {}}, ...globals });
  return exports;
}
const data = load('lib/redditOpinions.ts');
const row = { rank: '2', ticker: 'BRK.B', name: 'Berkshire &amp; Co', mentions: '120', upvotes: '-6', rank_24h_ago: '5', mentions_24h_ago: '60' };
test('provider strings, negative vote totals and company entities retain their meaning', () => {
  const stock = data.parseRedditStocks({results: [row]})[0];
  assert.equal(stock.name, 'Berkshire & Co');
  assert.equal(stock.upvotes, -6);
  assert.equal(stock.previousRank - stock.rank, 3);
  assert.equal(data.mentionChange(stock), 100);
});
test('missing history and zero baselines never produce fabricated percentage changes', () => {
  for (const previous of [null, '', undefined, 0, '0']) {
    const stock = data.parseRedditStocks({results: [{...row, rank_24h_ago: 0, mentions_24h_ago: previous}]})[0];
    assert.equal(stock.previousRank, null);
    assert.equal(data.mentionChange(stock), null);
  }
  const stock = data.parseRedditStocks({results: [{...row, mentions: 0}]})[0];
  assert.equal(data.mentionChange(stock), -100);
});
test('malformed and duplicate entries fail visibly, while an empty source stays empty', () => {
  assert.equal(data.parseRedditStocks({results: []}).length, 0);
  for (const payload of [{}, {results: null}, {results: [{...row, mentions: -1}]}, {results: [{...row, ticker: '../x'}]}, {results: [row,row]}]) {
    assert.throws(() => data.parseRedditStocks(payload));
  }
});
function route(fetch) {
  return load('app/api/reddit-opinions/route.ts', {
    'next/server': { NextResponse: { json: (body, options = {}) => ({body, status: options.status ?? 200, headers: options.headers}) } },
    'next/cache': { unstable_cache: (fn) => fn },
    '@/lib/redditOpinions': data,
  }, { fetch });
}
test('proxy uses a fixed stock-only source, bounded timeout and a timestamp', async () => {
  const api = route(async (url, options) => {
    assert.equal(url, 'https://apewisdom.io/api/v1.0/filter/all-stocks/page/1');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.cache, 'no-store');
    return {ok: true, json: async () => ({results:[row]})};
  });
  const response = await api.GET();
  assert.equal(response.status, 200);
  assert.equal(response.body.results.length, 1);
  assert.ok(Number.isFinite(Date.parse(response.body.fetchedAt)));
});
test('upstream rejection, invalid response and network failure return a retryable 502', async () => {
  for (const fetch of [async () => ({ok:false,status:429}), async () => ({ok:true,json: async () => ({})}), async () => {throw new Error('offline')}]) {
    const response = await route(fetch).GET();
    assert.equal(response.status, 502);
    assert.equal(response.headers['Cache-Control'], 'no-store');
  }
});
test('Reddit keeps the creator parent active without claiming the YouTube child', () => {
  const nav = load('components/layout/navItems.ts', {'lucide-react': {}});
  const parent = nav.MAIN_NAV_ITEMS.find(item => item.featureId === 'youtubeOpinions');
  assert.equal(nav.isMainNavItemActive('/dashboard/reddit-opinions', parent), true);
  assert.equal(nav.isNavItemActive('/dashboard/reddit-opinions', '/dashboard/youtube-opinions'), false);
  assert.equal(nav.isMainNavItemActive('/dashboard/youtube-opinions/creators/id', parent), true);
});
