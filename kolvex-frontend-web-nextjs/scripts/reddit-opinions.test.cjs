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
  }, Date, URL, AbortSignal, console: {error() {}}, ...globals });
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
  const response = await api.GET({url: 'http://localhost/api/reddit-opinions'});
  assert.equal(response.status, 200);
  assert.equal(response.body.results.length, 1);
  assert.equal(response.body.community, 'all-stocks');
  assert.ok(Number.isFinite(Date.parse(response.body.fetchedAt)));
});
test('upstream rejection, invalid response and network failure return a retryable 502', async () => {
  for (const fetch of [async () => ({ok:false,status:429}), async () => ({ok:true,json: async () => ({})}), async () => {throw new Error('offline')}]) {
    const response = await route(fetch).GET({url: 'http://localhost/api/reddit-opinions?community=stocks'});
    assert.equal(response.status, 502);
    assert.equal(response.headers['Cache-Control'], 'no-store');
  }
});
test('each supported community uses its own allowlisted source and reports the matching scope', async () => {
  for (const community of data.REDDIT_COMMUNITIES) {
    const api = route(async url => {
      assert.equal(url, `https://apewisdom.io/api/v1.0/filter/${community}/page/1`);
      return {ok: true, json: async () => ({results:[row]})};
    });
    const response = await api.GET({url: `http://localhost/api/reddit-opinions?community=${community}`});
    assert.equal(response.status, 200);
    assert.equal(response.body.community, community);
  }
});
test('invalid communities are rejected before any provider request', async () => {
  const api = route(() => {throw new Error('must not fetch')});
  for (const community of ['', 'all', 'all-crypto', '../stocks', 'https://example.com', 'toString']) {
    const response = await api.GET({url: `http://localhost/api/reddit-opinions?community=${encodeURIComponent(community)}`});
    assert.equal(response.status, 400);
  }
});
test('cached rankings remain separate between communities, including concurrent requests', async () => {
  const cached = new Map();
  const api = load('app/api/reddit-opinions/route.ts', {
    'next/server': {NextResponse: {json: body => ({body})}},
    'next/cache': {unstable_cache: fn => (...args) => {
      const key = JSON.stringify(args);
      if (!cached.has(key)) cached.set(key, fn(...args));
      return cached.get(key);
    }},
    '@/lib/redditOpinions': data,
  }, {fetch: async url => ({ok: true, json: async () => ({results:[{...row, mentions: url.includes('/stocks/') ? 7 : 15}]})})});
  const [stocks, options] = await Promise.all(['stocks', 'options'].map(community => api.GET({url:`http://localhost/api/reddit-opinions?community=${community}`})));
  assert.equal(stocks.body.results[0].mentions, 7);
  assert.equal(options.body.results[0].mentions, 15);
  assert.equal(cached.size, 2);
});
test('growth sorts retain declines and place unknown/zero baselines last without changing source ranks', () => {
  const stocks = data.parseRedditStocks({results:[
    {...row, ticker:'A', rank:1, mentions:100, mentions_24h_ago:null, rank_24h_ago:null},
    {...row, ticker:'B', rank:2, mentions:50, mentions_24h_ago:100, rank_24h_ago:1},
    {...row, ticker:'C', rank:3, mentions:25, mentions_24h_ago:10, rank_24h_ago:9},
    {...row, ticker:'D', rank:4, mentions:10, mentions_24h_ago:0, rank_24h_ago:4},
  ]});
  const tickers = sort => Array.from(data.selectRedditStocks(stocks, '', sort), stock => stock.ticker);
  assert.deepEqual(tickers('mentionChange'), ['C','B','A','D']);
  assert.deepEqual(tickers('rankChange'), ['C','D','B','A']);
  assert.deepEqual(tickers('mentions'), ['A','B','C','D']);
  assert.deepEqual(Array.from(stocks, stock => stock.rank), [1,2,3,4]);
});
test('search and local follows intersect the loaded ranking; off-board follows stay saved', () => {
  const stocks = data.parseRedditStocks({results:[row, {...row, ticker:'AAPL', name:'Apple', rank:1}]});
  const follows = ['BRK.B', 'NVDA'];
  assert.equal(data.selectRedditStocks(stocks, '  $brk.b ', 'mentions', follows).length, 1);
  assert.equal(data.selectRedditStocks(stocks, 'berkshire', 'mentions', follows).length, 1);
  assert.equal(data.selectRedditStocks(stocks, 'apple', 'mentions', follows).length, 0);
  assert.equal(data.selectRedditStocks(stocks, '', 'mentions', []).length, 0);
  assert.deepEqual(follows, ['BRK.B', 'NVDA']);
});
test('stored follows tolerate missing/malformed storage, deduplicate and discard unsafe entries', () => {
  for (const raw of [null, '{bad', '{}', 'null']) assert.equal(data.parseRedditWatchlist(raw).length, 0);
  assert.deepEqual(Array.from(data.parseRedditWatchlist('["AAPL", "BRK.B", "AAPL", null, "../x", 5]')), ['AAPL', 'BRK.B']);
});
test('Reddit keeps the creator parent active without claiming the YouTube child', () => {
  const nav = load('components/layout/navItems.ts', {'lucide-react': {}});
  const parent = nav.MAIN_NAV_ITEMS.find(item => item.featureId === 'youtubeOpinions');
  assert.equal(nav.isMainNavItemActive('/dashboard/reddit-opinions', parent), true);
  assert.equal(nav.isNavItemActive('/dashboard/reddit-opinions', '/dashboard/youtube-opinions'), false);
  assert.equal(nav.isMainNavItemActive('/dashboard/youtube-opinions/creators/id', parent), true);
});
