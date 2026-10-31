const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadHelper(name) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '../lib', `${name}.ts`), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, {
    exports: module.exports, Date, Intl,
    require: (id) => loadHelper(id.replace('./', '')),
  });
  return module.exports;
}
const { videoHistory } = loadHelper('youtubeVideoHistory');
const opinion = { id: 'opinion', ticker: 'NVDA', video_id: 'tracked0001', video_title: 'Tracked', video_published_at: '2026-10-16T15:00:00Z', opinion_date: '2026-10-16' };
const upload = { video_id: 'newvideo001', title: 'Newest upload', published_at: '2026-10-22T15:00:00Z' };

test('merges newer untracked videos with opinion history without inventing opinions', () => {
  const groups = videoHistory([opinion], [upload]);
  assert.equal(groups[0].videoId, upload.video_id);
  assert.equal(groups[0].video.video_title, upload.title);
  assert.equal(groups[0].video.video_url, 'https://www.youtube.com/watch?v=newvideo001');
  assert.equal(groups[0].opinions.length, 0);
  assert.equal(groups[1].opinions[0], opinion);
  assert.equal(groups.filter((group) => group.opinions.length > 0).length, 1);
});

test('freshly imported videos and repeated coverage entries appear only once', () => {
  const groups = videoHistory([opinion, { ...opinion, id: 'second' }], [upload, upload, { ...upload, video_id: opinion.video_id }]);
  assert.equal(groups.length, 2);
  assert.equal(groups[1].opinions.length, 2);
  assert.equal(groups[1].video.video_title, 'Tracked');
});

test('upload date filters use the same New York day as opinion history', () => {
  const midnight = { ...upload, published_at: '2026-10-22T02:00:00Z' };
  assert.equal(videoHistory([], [midnight], '2026-10-22').length, 0);
  assert.equal(videoHistory([], [midnight], '2026-10-21', '2026-10-21').length, 1);
  assert.equal(videoHistory([], [upload], '', '2026-10-21').length, 0);
  assert.equal(videoHistory([], [{ ...upload, published_at: null }], '2026-10-21').length, 0);
});

test('missing coverage leaves existing grouped opinions intact', () => {
  const groups = videoHistory([opinion], []);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].opinions[0], opinion);
});

test('macro analyses stay tracked and retain their summary without inventing stocks', () => {
  const macro = { ...opinion, ticker: '', video_summary: '通胀与降息分析', channel_id: 'creator' };
  const groups = videoHistory([macro], [{ ...upload, video_id: macro.video_id }]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].opinions.length, 0);
  assert.equal(groups[0].analyzed, true);
  assert.equal(groups[0].creator.channel_id, 'creator');
  assert.equal(groups[0].video_summary, '通胀与降息分析');
});

test('video card renders macro analysis with attribution and no stock row', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const source = fs.readFileSync(path.join(__dirname, '../components/youtube/VideoOpinionCard.tsx'), 'utf8');
  const module = { exports: {} };
  const stub = () => null;
  const deps = {
    'react': React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    'lucide-react': { ChevronDown: stub, PlayCircle: stub },
    '@/components/ui/company-logo': { default: stub },
    '@/lib/utils': { cn: (...args) => args.filter(Boolean).join(' '), proxyImageUrl: (url) => url },
    './OpinionStrength': { default: stub },
    '@/lib/opinionDates': loadHelper('opinionDates'),
    './CreatorAvatar': { default: stub },
  };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports: module.exports, require: (id) => {
    assert.ok(id in deps, `Unexpected dependency: ${id}`);
    return deps[id];
  }, URL });
  const card = module.exports.default;
  const groups = videoHistory([{ ...opinion, ticker: '', video_summary: '宏观分析正文', channel_id: 'creator', channel_title: '宏观博主' }], []);
  const html = renderToStaticMarkup(React.createElement(card, { group: groups[0], t: (key) => key === "common.intlLocale" ? "zh-CN" : key, showCreator: true }));
  assert.ok(html.includes('宏观分析正文'));
  assert.ok(html.includes('宏观博主'));
  assert.ok(html.includes('youtubeOpinions.videoAnalysisOnly'));
  assert.ok(!html.includes('youtubeOpinions.untrackedVideo'));
  assert.ok(!html.includes('<ul'));
});
