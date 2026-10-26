const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const copy = (en, zh) => zh;
const i18n = { useTranslation: () => ({ t: key => key === "common.intlLocale" ? "zh-CN" : key, locale: 'zh' }) };
const wrapper = ({ children }) => React.createElement('div', null, children);
const skeleton = () => React.createElement('span', { 'data-skeleton': true });
const ui = new Proxy({}, { get: (_, key) => key === 'Skeleton' ? skeleton : wrapper });
function compile(file, mocks = {}) {
  const mod = { exports: {} };
  const cache = require("./helpers/client-cache.cjs")();
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module: mod, exports: mod.exports,
    require: key => key in mocks ? mocks[key] : key === '@/lib/clientCache' ? cache : key === '@/hooks/useCachedResource' ? compile('hooks/useCachedResource.ts') : key === 'react' ? React : key === 'react/jsx-runtime' ? require(key) : key === '@/lib/i18n' ? i18n : key.startsWith('@/components/ui/') ? ui : { default: wrapper },
    AbortController, Date, console,
  });
  return mod.exports;
}

const history = { items: [], selected: null, current: null, total: 0, busy: true, error: null, scope: 'all', setScope() {} };
test('drawing selector distinguishes loading, failed and confirmed empty results', () => {
  const { DrawingVersionSelector } = compile('components/decision/AnalysisHistory.tsx', {
    './shared': { useCopy: () => copy },
    '@/components/ui/select': { ...Object.fromEntries(['Select', 'SelectContent', 'SelectItem', 'SelectTrigger'].map(key => [key, wrapper])), SelectValue: ({ placeholder }) => React.createElement('span', null, placeholder) },
  });
  const render = state => renderToStaticMarkup(React.createElement(DrawingVersionSelector, { history: state, hidden: false }));
  const pending = render(history);
  assert.match(pending, /正在加载画线/);
  assert.doesNotMatch(pending, /暂无已保存的画线|\(0\)/);
  const failed = render({ ...history, busy: false, error: 503 });
  assert.match(failed, /画线加载失败/);
  assert.doesNotMatch(failed, /暂无已保存的画线/);
  assert.match(render({ ...history, busy: false }), /暂无已保存的画线/);
});

test('stock workspace first render shows loading placeholders across summary, setup and research', () => {
  const { default: Workspace } = compile('components/decision/StockWorkspace.tsx', {
    '@/lib/productFeatures': { isProductFeatureEnabled: () => false },
    './shared': { useCopy: () => copy, Panel: wrapper, Empty: wrapper, DirectionBadge: () => React.createElement('span', null, '未评估'), money: () => '—', signedMoney: () => '—' },
    './useStockResearch': { useStockResearch: () => ({ history, busy: false, generate() {} }) },
    './CommandLayer': { useDecisionCommand: () => ({ setContext() {} }) },
    '@/lib/decision': { creatorEvidence: () => ({ count: 0, direction: null }) },
    '@/lib/marketBenchmarks': { BENCHMARKS: [] },
    '@/lib/tradingAnalysisApi': {publishedAnalysesKey: () => '/published'},
  });
  const html = renderToStaticMarkup(React.createElement(Workspace, { ticker: 'NVDA' }));
  assert.match(html, /data-skeleton/);
  assert.match(html, /正在加载 AI 研究/);
  assert.match(html, /正在加载技术分析/);
  assert.doesNotMatch(html, /暂无观点|暂无 AI 研究|近 30 天无观点|未评估|需要 AI 研究/);
});

test('creator profile does not show unavailable statistics or no description during a slow fetch', async () => {
  let index = 0;
  const slots = [];
  const element = (type, props) => ({ type, props });
  const react = { useState(initial) { const slot = index++; if (!(slot in slots)) slots[slot] = initial; return [slots[slot], next => { slots[slot] = next; }]; } };
  let resolve;
  const pending = new Promise(done => { resolve = done; });
  const { default: Profile } = compile('components/youtube/CreatorProfileDialog.tsx', {
    react, 'react/jsx-runtime': { jsx: element, jsxs: element, Fragment: 'fragment' },
    '@/lib/youtubeOpinionsApi': { getYouTubeCreatorProfile: () => pending },
  });
  const creator = { channel_id: 'creator', channel_title: 'Creator', total_opinions: 12, top_tickers: [] };
  const render = () => { index = 0; return Profile({ creator }); };
  function text(node) {
    if (node == null || typeof node === 'boolean') return '';
    if (typeof node !== 'object') return String(node);
    if (Array.isArray(node)) return node.map(text).join(' ');
    return text(node.props?.children);
  }
  render().props.children[0].props.onClick();
  const loading = text(render());
  assert.doesNotMatch(loading, /profile.notAvailable|profile.noDescription/);
  resolve({ ...creator, profile_status: 'available' });
  await pending; await new Promise(done => setImmediate(done));
  const complete = text(render());
  assert.match(complete, /profile.notAvailable/);
  assert.match(complete, /profile.noDescription/);
});
