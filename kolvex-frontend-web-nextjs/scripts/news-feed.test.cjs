const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
function load(file, deps = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, {
    exports, require: name => { if (name in deps) return deps[name]; throw new Error(name); },
    URL, AbortSignal, process: { env: {} }, ...globals,
  });
  return exports;
}
const feed = load('lib/newsFeed.ts');
const article = (title, time, link = `https://news.example/${title}`) => ({title, link, publish_time: time, publisher: 'Publisher'});

test('symbols are bounded, normalized and validated', () => {
  assert.equal(feed.parseNewsSymbols(' aapl, AAPL,nvda ').join(','), 'AAPL,NVDA');
  for (const value of ['', 'AAPL,', '../news', 'A,B,C,D,E', '<script>', 'AAPL?x=1']) assert.equal(feed.parseNewsSymbols(value), null);
});

test('cross-symbol duplicates merge and unsafe URLs or malformed news are dropped', () => {
  const a = feed.normalizeNews([article('A', 100, 'https://news.example/a?utm_source=stock#top'), article('B', 200), article('bad', 300, 'javascript:alert(1)'), null, {title:'No link'}, article('bad', 300, 'https://user:pass@news.example')], 'AAPL');
  const b = feed.normalizeNews([article('A', 100, 'https://news.example/a')], 'NVDA');
  const merged = feed.mergeNews(a, b);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].title, 'B');
  assert.equal(merged[1].symbols.join(','), 'AAPL,NVDA');
  assert.equal(feed.normalizeNews([article('bad-time', Infinity)], 'SPY')[0].publish_time, null);
});

test('polling buffers new items without moving existing rows; repeated polls do not inflate count', () => {
  const old = feed.normalizeNews([article('old', 100)], 'SPY');
  const fresh = feed.normalizeNews([article('new', 200), article('old', 100)], 'SPY');
  const initial = feed.receiveNews(feed.EMPTY_FEED, old);
  const refreshed = feed.receiveNews(feed.receiveNews(initial, fresh), fresh);
  assert.equal(refreshed.articles.length, 1);
  assert.equal(refreshed.articles[0].title, 'old');
  assert.equal(refreshed.pending.length, 1);
  const shown = feed.revealNews(refreshed);
  assert.equal(shown.articles.map(a => a.title).join(','), 'new,old');
  assert.equal(shown.pending.length, 0);
  assert.equal(feed.receiveNews(shown, fresh).pending.length, 0);
});

function route(fetch) {
  return load('app/api/news/route.ts', { '@/lib/newsFeed': feed, 'next/server': { NextResponse: { json: (body, options = {}) => ({ body, status: options.status || 200, headers: options.headers }) } } }, { fetch });
}

test('invalid requests never reach upstream', async () => {
  const result = await route(() => { throw new Error('must not fetch'); }).GET({url:'https://kolvex.app/api/news?symbols=A,B,C,D,E'});
  assert.equal(result.status, 400);
});

test('partial failures retain successful headlines and name unavailable symbols', async () => {
  const result = await route(async url => {
    if (url.endsWith('NVDA')) throw new Error('timeout');
    return { ok: true, json: async () => ({news:[article('Headline', 100)]}) };
  }).GET({url:'https://kolvex.app/api/news?symbols=AAPL,NVDA'});
  assert.equal(result.status, 200);
  assert.equal(result.body.articles.length, 1);
  assert.equal(result.body.unavailable.join(','), 'NVDA');
  assert.equal(result.headers['Cache-Control'], 'no-store');
});

test('total provider failure returns 502, while a valid empty feed returns 200', async () => {
  const request = {url:'https://kolvex.app/api/news?symbols=AAPL'};
  assert.equal((await route(async () => ({ok:false})).GET(request)).status, 502);
  assert.equal((await route(async () => ({ok:true,json:async()=>({unexpected:[]})})).GET(request)).status, 502);
  const empty = await route(async () => ({ok:true,json:async()=>({news:[]})})).GET(request);
  assert.equal(empty.status, 200);
  assert.equal(empty.body.articles.length, 0);
});
