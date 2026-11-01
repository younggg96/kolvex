const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const zh = require('../lib/i18n/locales/zh.json');
const en = require('../lib/i18n/locales/en.json');
const wrapper = ({ children }) => React.createElement('div', null, children);
const button = ({ children, onClick }) => React.createElement('button', { onClick }, children);
const emptyDashboard = {
  summary: { total_opinions: 0, total_creators: 0 },
  creators: [], stocks: [], latest: [], daily: [], changes: [],
  pagination: { has_more: false },
};

function renderExplorer(overrides = {}, locale = 'zh') {
  const dictionary = locale === 'zh' ? zh : en;
  const t = (key) => key.split('.').reduce((value, part) => value?.[part], dictionary) ?? key;
  const states = {
    0: { tab: 'stocks', ticker: 'EMPTY' }, 1: true,
    2: emptyDashboard, 5: emptyDashboard, 6: emptyDashboard,
    ...overrides,
  };
  let cursor = 0;
  const modules = {
    react: { ...React, useEffect() {}, useState(initial) {
      const slot = cursor++;
      return [slot in states ? states[slot] : initial, () => {}];
    } },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': { default: wrapper },
    '@/components/layout/DashboardLayout': { default: wrapper },
    'next/navigation': { useRouter: () => ({ push() {} }) },
    'lucide-react': new Proxy({}, { get: () => () => null }),
    '@/lib/i18n': { useTranslation: () => ({ t, locale }) },
    '@/lib/utils': { cn: (...values) => values.filter(value => typeof value === 'string').join(' ') },
    '@/lib/productFeatures': { isProductFeatureEnabled: () => false },
    '@/lib/opinionDates': { formatOpinionDate: () => '' },
    '@/lib/stockApi': { formatPrice: () => '' },
    '@/lib/youtubeVideoHistory': { videoHistory: () => [] },
    '@/hooks/useStockPerformance': { useStockPerformance: () => ({ performance: {}, loading: false }) },
    '@/components/decision/shared': {
      useCopy: () => (english, chinese) => locale === 'zh' ? chinese : english,
      useHeldTickers: () => ({ tickers: [] }), HeldMark: wrapper,
    },
    './strength': { describeStrength: () => ({ tone: 'neutral', label: 'Neutral' }), toneText: { neutral: '' } },
  };
  function compile(file) {
    const mod = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(source, { module: mod, exports: mod.exports, URLSearchParams,
      require: name => modules[name] ?? (name === '@/components/ui/button' ? { Button: button } :
        name.startsWith('@/components/ui/') ? new Proxy({}, { get: (_, key) => key === 'ContentSkeleton' ? () => React.createElement('div', { 'data-loading': true }) : wrapper }) : { default: () => null }),
    });
    return mod.exports;
  }
  modules['@/components/ui/list-card'] = compile('components/ui/list-card.tsx');
  const Explorer = compile('components/youtube/YouTubeOpinionExplorer.tsx').default;
  return renderToStaticMarkup(React.createElement(Explorer));
}

test('empty stock archive explains missing discussions and offers another stock without empty filters', () => {
  const html = renderExplorer();
  assert.match(html, /暂无已收录的讨论/);
  assert.match(html, /暂无博主讨论记录/);
  assert.match(html, /浏览其他股票/);
  assert.doesNotMatch(html, /role="radiogroup" aria-label="观点"/);
  assert.doesNotMatch(html, /<ul[^>]*><\/ul>/);
});

test('zero matching results preserve sentiment controls and the clear filters recovery', () => {
  const html = renderExplorer({ 17: { sentiment: 'bullish', range: 'all', from: '', to: '' } });
  assert.match(html, /role="radiogroup" aria-label="观点"/);
  assert.match(html, /清除筛选/);
  assert.doesNotMatch(html, /暂无已收录的讨论/);
});

test('initial loading and failed requests do not masquerade as a confirmed empty archive', () => {
  const pending = renderExplorer({ 5: null, 6: null, 9: true });
  assert.match(pending, /data-loading/);
  assert.doesNotMatch(pending, /暂无已收录的讨论|暂无博主讨论记录/);
  const failed = renderExplorer({ 5: null, 6: null, 7: 'failed', 11: 'failed' });
  assert.match(failed, /role="alert"/);
  assert.match(failed, /重试/);
  assert.doesNotMatch(failed, /data-loading|暂无已收录的讨论|暂无博主讨论记录/);
});

test('creator archive has explicit empty stocks and hides unavailable view switches', () => {
  const html = renderExplorer({ 0: { tab: 'creators', creator: 'empty-creator' } });
  assert.match(html, /暂无股票讨论记录/);
  assert.doesNotMatch(html, /aria-label="历史观点浏览方式"|查看所有观点/);
});

test('empty state copy is available in English', () => {
  const html = renderExplorer({}, 'en');
  assert.match(html, /No recorded discussions yet/);
  assert.match(html, /No creator discussions recorded/);
  assert.match(html, /Browse other stocks/);
  assert.doesNotMatch(html, /youtubeOpinions\./);
});

test('a populated archive keeps its creators and sentiment controls', () => {
  const data = { ...emptyDashboard, summary: { total_opinions: 1, total_creators: 1 },
    creators: [{ channel_id: 'recorded', channel_title: '已收录博主', total_opinions: 1 }],
  };
  const html = renderExplorer({ 5: data, 6: data });
  assert.match(html, /已收录博主/);
  assert.match(html, /role="radiogroup" aria-label="观点"/);
  assert.doesNotMatch(html, /暂无博主讨论记录/);
});
