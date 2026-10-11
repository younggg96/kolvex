const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, getComputedStyle) {
  const filename = path.resolve(__dirname, '../lib', file + '.ts');
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports: module.exports, Date, Intl, URL, URLSearchParams, getComputedStyle, Path2D: class {},
    require: (name) => load(path.relative(path.join(__dirname, '../lib'), path.resolve(path.dirname(filename), name)), getComputedStyle) });
  return module.exports;
}
const css = fs.readFileSync(path.join(__dirname, '../app/globals.css'), 'utf8');
function websiteStyles(mode) {
  const block = css.match(mode === 'dark' ? /\.dark\s*\{([\s\S]*?)\n\}/ : /:root\s*\{([\s\S]*?)\n\}/)[1];
  const tokens = Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2]]));
  return { colorScheme: mode, fontFamily: '"Website Inter", "PingFang SC", sans-serif', borderTopLeftRadius: '12px', getPropertyValue: (name) => tokens[name] || '' };
}
let style = websiteStyles('light');
const { planCreatorShare, wrapShareText, creatorShareFilename, readCreatorShareAppearance, drawCreatorSharePage } = load('creatorShareImage', () => style);
const appearance = readCreatorShareAppearance({});
const dict = require('../lib/i18n/locales/zh.json');
const t = (key, params = {}) => Object.entries(params).reduce((text, [name, value]) => text.replace(`{${name}}`, value), key.split('.').reduce((value, part) => value?.[part], dict) || key);
const plan = (data, locale, ctx, theme = appearance) => planCreatorShare(data, locale, ctx, theme, t);
const ctx = { font: '', measureText: (text) => ({ width: Array.from(text).length * 30 }) };
const fixture = (opinions) => ({
  creator: { channel_id: 'creator', channel_title: '投资TALK君' },
  video: { video_id: 'l2Knyw23HgU', video_title: '最新视频', video_published_at: '2026-10-09T02:42:56Z', opinion_date: '2026-10-08' }, opinions,
});

test('share pagination preserves every Chinese character and every stock', () => {
  const summary = '中文观点📈，基本面与估值\n逐条阅读。'.repeat(100);
  const opinions = Array.from({ length: 29 }, (_, i) => ({ ticker: 'STK' + i, sentiment: 'bullish', summary: i === 0 ? summary : '真实观点' }));
  const doc = plan(fixture(opinions), 'zh', ctx);
  assert.ok(doc.pages.length > 1);
  assert.ok(doc.pages.every((page) => page.length > 0));
  const fragments = doc.pages.flat();
  assert.equal(fragments.filter((f) => f.ticker === 'STK0').flatMap((f) => f.lines).join(''), summary.replace(/\n/g, ''));
  assert.equal(new Set(fragments.map((f) => f.ticker)).size, 29);
  assert.ok(fragments.some((f) => f.continued));
  assert.ok(fragments.every((f) => f.y + 100 + f.lines.length * 54 <= 1260));
  assert.equal(doc.date, '2026年10月8日');
  assert.equal(doc.source, 'https://www.youtube.com/watch?v=l2Knyw23HgU');
});

test('missing summary uses real thesis and never invents a view', () => {
  const doc = plan(fixture([{ ticker: 'NVDA', sentiment: 'mixed', thesis: '原始理由' }, { ticker: 'AAPL', sentiment: 'neutral' }]), 'zh', ctx);
  assert.equal(doc.pages[0][0].lines.join(''), '原始理由');
  assert.match(doc.pages[0][1].lines.join(''), /暂无文字摘要/);
  assert.throws(() => plan(fixture([]), 'zh', ctx));
});

test('share text preserves unbroken tokens and filenames are safe', () => {
  assert.equal(wrapShareText(ctx, 'LONGTOKEN'.repeat(10), 90).join(''), 'LONGTOKEN'.repeat(10));
  const data = fixture([{ ticker: 'NVDA', sentiment: 'bullish', summary: '增长' }]);
  data.creator.channel_title = 'a/b:c?';
  data.video.video_url = 'javascript:alert(1)';
  const doc = plan(data, 'en', ctx);
  assert.equal(doc.date, 'Oct 8, 2026');
  assert.equal(creatorShareFilename(doc, 0), 'Kolvex-a-b-c--l2Knyw23HgU-1.png');
  assert.ok(doc.source.startsWith('https://www.youtube.com/'));
});

test('export uses live website theme tokens and the real font, including custom colors', () => {
  style = websiteStyles('dark');
  const dark = readCreatorShareAppearance({});
  assert.equal(dark.background, 'rgb(0, 0, 0)');
  assert.equal(dark.card, 'rgb(14, 15, 16)');
  assert.equal(dark.negative, 'rgb(255, 80, 0)');
  assert.equal(dark.fontFamily, style.fontFamily);
  assert.equal(dark.radius, 36);
  const current = style.getPropertyValue;
  style = { ...style, getPropertyValue: (key) => key === '--positive' ? '10 20 30' : current(key) };
  const custom = readCreatorShareAppearance({});
  assert.equal(custom.positive, 'rgb(10, 20, 30)');
  const doc = plan(fixture([{ ticker: 'NVDA', sentiment: 'bullish', direction_score: 85, summary: '真实观点' }]), 'zh', ctx, custom);
  const drawn = [];
  const draw = { ...ctx, beginPath() {}, roundRect() {}, save() {}, restore() {}, translate() {}, scale() {},
    stroke() {}, fill() { drawn.push({ color: this.fillStyle }); },
    fillRect(x, y, width, height) { drawn.push({ color: this.fillStyle, x, y, width, height }); },
    fillText(text) { drawn.push({ color: this.fillStyle, font: this.font, text }); } };
  drawCreatorSharePage(draw, doc, 0);
  assert.equal(drawn[0].color, custom.background);
  assert.ok(drawn.some((entry) => entry.color === custom.card));
  assert.equal(drawn.find((entry) => entry.text === t('youtubeOpinions.strength.label', { level: t('youtubeOpinions.strength.strong'), direction: t('youtubeOpinions.strength.bullish') })).color, custom.positive);
  assert.ok(drawn.filter((entry) => entry.text).every((entry) => entry.font.includes('Website Inter')));
  style = websiteStyles('light');
});
