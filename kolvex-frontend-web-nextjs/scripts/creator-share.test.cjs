const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib', file + '.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports: module.exports, Date, Intl, require: (name) => name === './opinionDates' ? load('opinionDates') : {} });
  return module.exports;
}
const { planCreatorShare, wrapShareText, creatorShareFilename } = load('creatorShareImage');
const ctx = { font: '', measureText: (text) => ({ width: Array.from(text).length * 30 }) };
const fixture = (opinions) => ({
  creator: { channel_id: 'creator', channel_title: '投资TALK君' },
  video: { video_id: 'l2Knyw23HgU', video_title: '最新视频', video_published_at: '2026-10-09T02:42:56Z', opinion_date: '2026-10-08' }, opinions,
});

test('share pagination preserves every Chinese character and every stock', () => {
  const summary = '中文观点📈，基本面与估值\n逐条阅读。'.repeat(100);
  const opinions = Array.from({ length: 29 }, (_, i) => ({ ticker: 'STK' + i, sentiment: 'bullish', summary: i === 0 ? summary : '真实观点' }));
  const doc = planCreatorShare(fixture(opinions), 'zh', ctx);
  assert.ok(doc.pages.length > 1);
  assert.ok(doc.pages.every((page) => page.length > 0));
  const fragments = doc.pages.flat();
  assert.equal(fragments.filter((f) => f.ticker === 'STK0').flatMap((f) => f.lines).join(''), summary.replace(/\n/g, ''));
  assert.equal(new Set(fragments.map((f) => f.ticker)).size, 29);
  assert.ok(fragments.some((f) => f.continued));
  assert.ok(fragments.every((f) => f.y + 100 + f.lines.length * 46 <= 1260));
  assert.equal(doc.date, '2026年10月8日');
  assert.equal(doc.source, 'https://www.youtube.com/watch?v=l2Knyw23HgU');
});

test('missing summary uses real thesis and never invents a view', () => {
  const doc = planCreatorShare(fixture([{ ticker: 'NVDA', sentiment: 'mixed', thesis: '原始理由' }, { ticker: 'AAPL', sentiment: 'neutral' }]), 'zh', ctx);
  assert.equal(doc.pages[0][0].lines.join(''), '原始理由');
  assert.match(doc.pages[0][1].lines.join(''), /暂无文字摘要/);
  assert.throws(() => planCreatorShare(fixture([]), 'zh', ctx));
});

test('share text preserves unbroken tokens and filenames are safe', () => {
  assert.equal(wrapShareText(ctx, 'LONGTOKEN'.repeat(10), 90).join(''), 'LONGTOKEN'.repeat(10));
  const data = fixture([{ ticker: 'NVDA', sentiment: 'bullish', summary: '增长' }]);
  data.creator.channel_title = 'a/b:c?';
  data.video.video_url = 'javascript:alert(1)';
  const doc = planCreatorShare(data, 'en', ctx);
  assert.equal(doc.date, 'Oct 8, 2026');
  assert.equal(creatorShareFilename(doc, 0), 'Kolvex-a-b-c--l2Knyw23HgU-1.png');
  assert.ok(doc.source.startsWith('https://www.youtube.com/'));
});
