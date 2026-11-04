// Component state/locale contracts. Browser geometry and Radix keyboard QA are separate.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const ts = require('typescript');
const now = Date.parse('2026-10-29T16:00:00Z');
class FixedDate extends Date { static now() { return now; } }
function source(file) { return ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText; }
function model(file, mocks = {}) {
  const module = new Module(file);
  module.require = name => { if (Object.hasOwn(mocks, name)) return mocks[name]; throw new Error(name); };
  module._compile(source(file), file);
  return module.exports;
}
const discovery = model('lib/stockDiscovery.ts', { './opinionDates': model('lib/opinionDates.ts'), './decision': model('lib/decision.ts') });
const board = patch => ({ items: [{ symbol: 'PLTR', name: 'Palantir', changePercent: 8, volumeMultiple: 3, sessionDate: '2026-10-29' }],
  sessionDate: '2026-10-29', fetchedAt: '2026-10-29T16:00:00Z', unavailable: false, partial: false, stale: false, ...patch });

function fixture(query, { locale = 'zh', selected = board(), error = null, refreshing = false, loading = false, ready = true } = {}) {
  let rankingRetries = 0, requested, enabled, url;
  const element = (type, props) => ({ type, props });
  const resource = { data: { source: 'Yahoo Finance', movers: selected, active: selected }, error, refreshing, loading,
    refresh() { rankingRetries++; } };
  const mocks = {
    react: { useMemo: fn => fn(), useCallback: fn => fn, useEffect() {}, useRef: current => ({ current }),
      useState: value => [typeof value === 'function' ? value() : typeof value === 'boolean' ? ready : value, () => {}] },
    'react/jsx-runtime': { jsx: element, jsxs: element },
    'next/navigation': { usePathname: () => '/dashboard', useSearchParams: () => new URLSearchParams(query) },
    'next/link': { default: 'Link' },
    '@/components/ui/button': { Button: 'Button' },
    '@/components/ui/select': { Select: 'Select', SelectTrigger: 'SelectTrigger', SelectValue: 'SelectValue', SelectContent: 'SelectContent', SelectItem: 'SelectItem' },
    '@/components/ui/list-card': { ListColumnHeader: 'ListColumnHeader', ListRows: 'ListRows', ListRow: 'ListRow', ListLoadMore: 'ListLoadMore' },
    '@/components/ui/segmented-control': { SegmentedControl: 'SegmentedControl' },
    '@/components/ui/content-loading': { ContentLoading: 'ContentLoading', PendingValue: 'PendingValue' },
    '@/lib/productFeatures': { isProductFeatureEnabled: () => false },
    '@/lib/stockDiscovery': discovery,
    '@/hooks/useMarketQuotes': { useMarketQuotes: symbols => { requested = symbols; return { quotes: {}, loading: false, unavailable: false }; } },
    '@/hooks/useMarketDiscovery': { useMarketDiscovery: value => { enabled = value; return resource; } },
    '@/lib/marketObservations': { MARKET_RANGES: [{ key: '1D', en: '1D', zh: '1天' }] },
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    './shared': { useCopy: () => (en, zh) => locale === 'zh' ? zh : en, money: () => '—', Panel: 'Panel', Empty: 'Empty' },
  };
  const module = { exports: {} };
  vm.runInNewContext(source('components/decision/StockObservationList.tsx'), {
    module, exports: module.exports, Date: FixedDate, Intl, URLSearchParams,
    window: { location: { search: query }, history: { replaceState: (_state, _title, next) => { url = next; } } },
    localStorage: { setItem() {} }, require: name => mocks[name] ?? {},
  });
  const tree = module.exports.default({ range: '1D', catalogue: { data: null, loading: false }, held: { tickers: [], loading: false }, onRetry() {} });
  const nodes = [];
  function walk(value) {
    if (Array.isArray(value)) return value.forEach(walk);
    if (value == null || value === false) return;
    nodes.push(value);
    if (typeof value === 'object') { walk(value.props?.children); walk(value.props?.action); }
  }
  walk(tree);
  return { nodes, text: nodes.filter(value => typeof value === 'string').join(' '), requested, enabled,
    rankingRetries: () => rankingRetries, url: () => url };
}

test('new scope renders dated reasons, only requests visible quotes and preserves detail return', () => {
  const h = fixture('stocks=movers&stockSearch=Palantir&stockRows=20');
  assert.equal(h.enabled, true);
  assert.deepEqual(h.requested, ['PLTR']);
  assert.match(h.text, /2026-10-29 · 涨跌 \+8.00%/);
  const link = h.nodes.find(node => node.type === 'Link');
  assert.ok(link.props.href.startsWith('/dashboard/market/PLTR?from='));
  const from = new URL(new URL(link.props.href, 'https://test').searchParams.get('from'), 'https://test');
  assert.equal(from.searchParams.get('stocks'), 'movers');
  assert.equal(from.searchParams.get('stockRows'), '20');
  assert.equal(from.searchParams.get('stockSearch'), 'Palantir');
  assert.ok(h.nodes.some(node => node.type === 'SelectTrigger' && node.props['aria-label'] === '股票列表'));
});
test('unavailable ranking shows retry and never displays the curated list as market movers', () => {
  const h = fixture('stocks=movers', { selected: board({ items: [], unavailable: true, partial: true }) });
  assert.match(h.text, /暂时无法加载这个榜单/);
  assert.equal(h.nodes.filter(node => node.type === 'Link').length, 0);
  h.nodes.find(node => node.type === 'Button' && node.props.children === '重试').props.onClick();
  assert.equal(h.rankingRetries(), 1);
});
test('no volume candidates is an honest empty state with the full-day basis visible', () => {
  const h = fixture('stocks=active', { selected: board({ items: [] }) });
  assert.match(h.text, /暂无成交量达到全天日均1.5倍/);
  assert.match(h.text, /不是与平常同一时刻比较/);
  assert.doesNotMatch(h.text, /暂时无法加载/);
});
test('refresh errors retain dated entries and retry targets the ranking resource', () => {
  const h = fixture('stocks=movers', { error: new Error('Offline') });
  assert.match(h.text, /榜单更新失败，保留上次快照/);
  assert.match(h.text, /涨跌 \+8.00%/);
  h.nodes.find(node => node.type === 'Button' && node.props.children === '重试').props.onClick();
  assert.equal(h.rankingRetries(), 1);
});
test('stale and partial states are explained; retry is disabled while refreshing', () => {
  const h = fixture('stocks=active', { selected: board({ stale: true }), refreshing: true });
  assert.match(h.text, /最多15分钟内的榜单快照/);
  assert.equal(h.nodes.find(node => node.type === 'Button' && node.props.children === '重试榜单').props.disabled, true);
  assert.match(fixture('stocks=movers', { selected: board({ partial: true }) }).text, /部分来源榜单暂不可用/);
});
test('English scope controls and reasons localize without changing URL identifiers', () => {
  const h = fixture('stocks=active', { locale: 'en' });
  assert.match(h.text, /Volume \/ 3M daily avg 3.00×/);
  const scope = h.nodes.find(node => node.type === 'SegmentedControl');
  assert.ok(scope.props.options.some(option => option.label === 'Creator buzz'));
  scope.props.onChange('creators');
  assert.equal(h.url(), '/dashboard?stocks=creators&stockSort=heat');
});
test('initial loading renders the canonical loading state and core scope avoids discovery fetch', () => {
  assert.ok(fixture('stocks=movers', { loading: true, selected: board({ items: [] }) }).nodes.some(node => node.type === 'ContentLoading'));
  assert.equal(fixture('stocks=core').enabled, false);
});
