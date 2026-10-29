const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/briefTranslation.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports: exportsObject });
const { translateBrief, briefSourceLanguage } = exportsObject;
const sample = () => ({
  brief: { id: 'intraday-2026-10-29', type: 'intraday', title: '盘中日报', headline: '市场动态', subtitle: '摘要', date: '2026-10-29', generated_at_pt: '2026-10-29T10:00:00-07:00', market_status: 'trading_day', hero_image: { url: 'https://example.com/a.png', source_page: 'https://example.com', caption: '图片说明', credit: 'Original credit' } },
  sections: [{ section_id: 'intraday', order: 1, title: '市场动态', narrative: ['第一段', '第二段'], indices: [{ name: '标普', close: 1234.56, change_pct: -1.2 }], items: [{ title: '新闻', sources: [{ name: '原始来源', url: 'https://example.com/news' }], related_tickers: ['NVDA'], time_pt: '10:00', key_stats: [{ label: '收入', value: '$1.2 billion' }], impact: { short_term: '短期', positioning: '观察' }, checklist: ['第一段'] }], events: [{ date_label: '盘后', title: '财报', detail: '说明' }] }], disclaimer: '免责声明', unknown: { untouched: '保留' },
});
test('translates editorial copy while preserving original data, IDs, financial values, sources and URLs', async () => {
  const original = sample(); const snapshot = JSON.stringify(original);
  const translated = await translateBrief(original, 'en', async text => `EN:${text}`, new AbortController().signal);
  assert.equal(translated.brief.headline, 'EN:市场动态');
  assert.equal(translated.brief.hero_image.caption, 'EN:图片说明');
  assert.equal(translated.sections[0].narrative[1], 'EN:第二段');
  assert.equal(translated.sections[0].items[0].impact.positioning, 'EN:观察');
  assert.equal(translated.sections[0].events[0].detail, 'EN:说明');
  assert.equal(translated.disclaimer, 'EN:免责声明');
  for (const key of ['id', 'type', 'date', 'generated_at_pt', 'market_status']) assert.equal(translated.brief[key], original.brief[key]);
  assert.equal(translated.sections[0].section_id, 'intraday');
  assert.equal(translated.sections[0].indices[0].close, 1234.56);
  assert.equal(translated.sections[0].items[0].key_stats[0].value, '$1.2 billion');
  assert.equal(JSON.stringify(translated.sections[0].items[0].sources), JSON.stringify(original.sections[0].items[0].sources));
  assert.equal(translated.sections[0].items[0].related_tickers[0], 'NVDA');
  assert.equal(translated.brief.hero_image.url, original.brief.hero_image.url);
  assert.equal(translated.brief.hero_image.credit, 'Original credit');
  assert.equal(translated.unknown.untouched, '保留');
  assert.equal(JSON.stringify(original), snapshot);
});
test('deduplicates copy, caps concurrency, caches by language and invalidates changed text', async () => {
  let active = 0, peak = 0, calls = 0; const seen = new Set(); const cache = new Map();
  const translator = async (text, language) => {
    assert.ok(!seen.has(`${language}:${text}`)); seen.add(`${language}:${text}`); calls++; active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 1)); active--; return `${language}:${text}`;
  };
  await translateBrief(sample(), 'en', translator, new AbortController().signal, cache);
  assert.ok(peak <= 4); const firstCalls = calls;
  await translateBrief(sample(), 'en', translator, new AbortController().signal, cache);
  assert.equal(calls, firstCalls);
  await translateBrief(sample(), 'zh', translator, new AbortController().signal, cache);
  assert.ok(calls > firstCalls);
  const changed = sample(); changed.brief.headline = '新标题';
  await translateBrief(changed, 'en', translator, new AbortController().signal, cache);
  assert.ok(seen.has('en:新标题'));
});
test('failed requests preserve original data and can retry', async () => {
  const original = sample(); const snapshot = JSON.stringify(original);
  await assert.rejects(translateBrief(original, 'en', async () => { throw new Error('offline'); }, new AbortController().signal));
  assert.equal(JSON.stringify(original), snapshot);
  const translated = await translateBrief(original, 'en', async text => `EN:${text}`, new AbortController().signal);
  assert.equal(translated.brief.title, 'EN:盘中日报');
});
test('cancellation prevents a translated result', async () => {
  const controller = new AbortController();
  await assert.rejects(translateBrief(sample(), 'en', async text => { controller.abort(); return text; }, controller.signal));
});
test('detects original language independently of interface locale', () => {
  assert.equal(briefSourceLanguage(sample()), 'zh');
  const english = sample(); english.brief = { title: 'Daily brief', headline: 'Market update', subtitle: 'Summary' };
  assert.equal(briefSourceLanguage(english), 'en');
});
