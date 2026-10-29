const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const file = path.join(__dirname, '..', relative);
  const compiled = new Module(file, module);
  compiled.paths = module.paths;
  const originalRequire = compiled.require.bind(compiled);
  compiled.require = name => Object.hasOwn(mocks, name) ? mocks[name] : originalRequire(name);
  compiled._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, file);
  return compiled.exports;
}
const discovery = load('lib/stockDiscovery.ts', { './opinionDates': load('lib/opinionDates.ts'), './decision': load('lib/decision.ts') });
const { CORE_STOCKS, STOCK_SECTORS, readStockObservationState, writeStockObservationState, selectObservationSymbols, latestStockOpinionDate, recentStockOpinionCount, stockObservationReturnHref } = discovery;
const now = Date.parse('2026-10-29T16:00:00Z');
const state = patch => ({ scope: 'creators', sector: 'all', sort: 'heat', rows: 10, ...patch });
const stock = (ticker, recent, date) => ({ ticker, discussion_heat: { recent, previous: 1, from: '2026-10-23', to: '2026-10-29' }, latest_evidence: { opinion_date: date } });
const inputs = [stock('NVDA', 5, '2026-10-28'), stock('JPM', 8, '2026-10-27'), stock('AAPL', 0, '2026-09-01')];

test('curated list covers every advertised sector with unique tickers', () => {
  assert.equal(new Set(CORE_STOCKS.map(s => s.symbol)).size, CORE_STOCKS.length);
  for (const sector of STOCK_SECTORS.filter(s => s.key !== 'all')) {
    const rows = selectObservationSymbols(state({ scope: 'core', sector: sector.key, sort: 'default' }), [], [], {}, now);
    assert.ok(rows.length > 0, sector.key);
  }
});
test('seven-day discovery ranks actual opinion counts and excludes inactive and stale windows', () => {
  const stale = { ...stock('META', 99, '2026-10-25'), discussion_heat: { recent: 99, to: '2026-10-28' } };
  const missing = { ticker: 'TSLA', creator_count: 999, total_opinions: 1000 };
  assert.deepEqual(selectObservationSymbols(state(), [...inputs, stale, missing], [], {}, now), ['JPM', 'NVDA']);
  assert.equal(recentStockOpinionCount(stale, now), null);
  assert.equal(recentStockOpinionCount(stock('AMD', -1, '2026-10-29'), now), null);
});
test('creator discovery never links to ticker formats unsupported by stock details', () => {
  assert.deepEqual(selectObservationSymbols(state(), [...inputs, stock('000660.KS', 999, '2026-10-29'), stock('../NVDA', 999, '2026-10-29')], [], {}, now), ['JPM', 'NVDA']);
});
test('latest mode uses publication evidence, includes older opinions, and rejects import-only or future dates', () => {
  const imported = { ticker: 'TSLA', latest_opinion_at: '2026-10-29T15:59:00Z' };
  const future = stock('META', 1, '2026-10-30');
  const invalid = stock('AMD', 1, 'not-a-date');
  const publication = { ...stock('COST', 1, '2026-10-28'), latest_evidence: { video_published_at: '2026-10-29T15:00:00Z', opinion_date: '2026-10-28' } };
  assert.deepEqual(selectObservationSymbols(state({ sort: 'latest' }), [...inputs, imported, future, invalid, publication], [], {}, now), ['COST', 'NVDA', 'JPM', 'AAPL']);
  assert.equal(latestStockOpinionDate(imported, now), null);
  assert.equal(latestStockOpinionDate({ ...publication, latest_evidence: { video_published_at: '2026-10-29T17:00:00Z' } }, now), null);
});
test('New York day boundaries do not expire aggregates at UTC midnight', () => {
  const afterUtcMidnight = Date.parse('2026-10-30T02:00:00Z');
  assert.equal(recentStockOpinionCount(inputs[0], afterUtcMidnight), 5);
  assert.equal(recentStockOpinionCount(inputs[0], Date.parse('2026-10-30T05:00:00Z')), null);
});
test('price sorts rank within the selected scope and place unavailable quotes last', () => {
  const quotes = { NVDA: { changePercent: -5 }, JPM: { changePercent: 2 } };
  assert.deepEqual(selectObservationSymbols(state({ sort: 'move' }), inputs, [], quotes, now), ['NVDA', 'JPM']);
  assert.deepEqual(selectObservationSymbols(state({ sort: 'gainers' }), inputs, [], quotes, now), ['JPM', 'NVDA']);
  assert.deepEqual(selectObservationSymbols(state({ scope: 'holdings', sort: 'losers' }), [], ['JPM', 'NVDA', 'COST'], quotes, now), ['NVDA', 'JPM', 'COST']);
});
test('list state round trips without overwriting other market tabs and normalizes invalid filters', () => {
  const original = new URLSearchParams('tab=overview&view=list');
  const next = state({ scope: 'core', sector: 'financials', sort: 'gainers', rows: 20 });
  const params = writeStockObservationState(original, next);
  assert.equal(params.get('view'), 'list');
  assert.deepEqual(readStockObservationState(params), next);
  assert.deepEqual(readStockObservationState(new URLSearchParams('stocks=holdings&sector=nope&stockSort=latest&stockRows=-10')), state({ scope: 'core', sort: 'move' }));
  assert.equal(readStockObservationState(new URLSearchParams('stocks=creators&stockSort=default')).sort, 'heat');
  assert.equal(readStockObservationState(new URLSearchParams('stockRows=9999999')).rows, 1000);
});
test('detail return cannot navigate outside the market list', () => {
  for (const target of ['https://example.com', '//example.com', '/dashboard/admin', '/dashboard#x', '/dashboard\\evil', '/dashboard?x=1\n']) assert.equal(stockObservationReturnHref(target), '/dashboard');
  assert.equal(stockObservationReturnHref('/dashboard?stocks=creators&stockRows=20'), '/dashboard?stocks=creators&stockRows=20');
});

test('scope controls update Next App Router search params without bypassing its native history adapter', () => {
  // Exercise the installed framework adapter rather than a preview's popstate shim.
  const router = fs.readFileSync(require.resolve('next/dist/client/components/app-router.js'), 'utf8');
  const copyState = router.match(/function copyNextJsInternalHistoryState\(data\)[\s\S]*?\n}/)?.[0];
  const adapter = router.match(/window\.history\.replaceState = function replaceState[\s\S]*?\n        };/)?.[0];
  assert.ok(copyState && adapter, 'Next native history integration must remain covered');
  let synchronizedUrl, writtenState;
  const window = { location: { search: '' }, history: { state: { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: ['market'] } } };
  vm.runInNewContext(`${copyState}\n${adapter}`, {
    window,
    applyUrlFromHistoryPushReplace: url => { synchronizedUrl = url; },
    originalReplaceState: (data) => { writtenState = data; window.history.state = data; },
  });
  const module = { exports: {} };
  const element = (type, props) => ({ type, props });
  const copy = (en, zh) => zh;
  const mocks = {
    react: { useMemo: fn => fn(), useCallback: fn => fn, useEffect() {}, useRef: current => ({ current }), useState: value => [typeof value === 'function' ? value() : value, () => {}] },
    'react/jsx-runtime': { jsx: element, jsxs: element },
    'next/navigation': { usePathname: () => '/dashboard', useSearchParams: () => new URLSearchParams() },
    '@/components/ui/button': { Button: 'button' },
    '@/lib/productFeatures': { isProductFeatureEnabled: () => false },
    '@/lib/i18n': { useTranslation: () => ({ locale: 'zh' }) },
    '@/lib/stockDiscovery': discovery,
    '@/lib/opinionDates': load('lib/opinionDates.ts'),
    '@/lib/marketObservations': { MARKET_RANGES: [{ key: '1D', en: '1D', zh: '1天' }] },
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
    './shared': { useCopy: () => copy },
  };
  const componentSource = fs.readFileSync(path.join(__dirname, '../components/decision/StockObservationList.tsx'), 'utf8');
  vm.runInNewContext(ts.transpileModule(componentSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, { module, exports: module.exports, Date, URLSearchParams, window, localStorage: { setItem() {} }, require: name => mocks[name] ?? {} });
  const tree = module.exports.default({ range: '1D', catalogue: { data: null, loading: true }, held: { tickers: [], loading: false }, onRetry() {} });
  function find(node) {
    if (node == null || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.map(find).find(Boolean);
    if (node.type === 'button' && node.props.children === '博主关注') return node;
    return find(node.props?.children);
  }
  const button = find(tree);
  assert.ok(button);
  button.props.onClick();
  assert.equal(synchronizedUrl, '/dashboard?stocks=creators&stockSort=heat');
  assert.equal(writtenState.__NA, true, 'Next retains its private state itself');
  assert.deepEqual(writtenState.__PRIVATE_NEXTJS_INTERNALS_TREE, ['market']);
});
