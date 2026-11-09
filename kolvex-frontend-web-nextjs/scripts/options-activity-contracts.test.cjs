const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// The contract list is a ranked table, not a stack of cards: one column per fact,
// numbers that line up, and an explicit disclosure button. These checks keep the
// scanning quality and the accessibility contract that the card layout lacked.

function compile(file, mocks) {
  const module = { exports: {} };
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const load = (key) => {
    if (key in mocks) return mocks[key];
    if (key.startsWith('@/') || key.startsWith('./') || key.startsWith('../')) return compile(resolveModule(file, key), mocks);
    return require(key);
  };
  vm.runInNewContext(output, { module, exports: module.exports, require: load, console });
  return module.exports;
}

function resolveModule(fromFile, spec) {
  const base = spec.startsWith('@/') ? path.join('', spec.slice(2)) : path.join(path.dirname(fromFile), spec);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(path.join(__dirname, '..', candidate))) return candidate;
  }
  throw new Error(`cannot resolve ${spec} from ${fromFile}`);
}

const sections = compile('components/options-activity/sections.tsx', {
  'react': React,
  'recharts': new Proxy({}, { get: () => () => null }),
  'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
  '@/components/ui/company-logo': { default: ({ symbol }) => React.createElement('span', { 'data-logo': symbol }) },
  '@/components/ui/info-tip': { InfoTip: () => null },
  '@/components/ui/segmented-control': {
    SegmentedControl: ({ options, value, onChange }) => React.createElement('div', null,
      options.map((option) => React.createElement('button', {
        key: option.value, type: 'button', 'aria-pressed': option.value === value,
        onClick: () => onChange(option.value),
      }, option.label))),
  },
  '@/components/decision/shared': { useCopy: () => (en, zh) => zh },
  '@/lib/i18n': { useTranslation: () => ({ locale: 'zh' }) },
  '@/lib/stockLinks': { marketStockHref: (symbol) => `/dashboard/market/${symbol}` },
  '@/lib/utils': { cn: (...parts) => parts.filter(Boolean).join(' ') },
});

const contract = (overrides = {}) => ({
  symbol: 'SPY260120P00725000',
  underlying: 'SPY',
  is_etf: true,
  type: 'put',
  strike: 725,
  expiration: '2026-11-20',
  dte: 13,
  premium: 146_500_000,
  volume: 19_600,
  open_interest: 10_900,
  vol_oi: 1.8,
  price: 7.37,
  last: 7.4,
  iv: 0.32,
  delta: -0.31,
  otm_pct: -1.2,
  flags: { new_positions: true, crosses_earnings: false },
  ...overrides,
});

const run = (contracts) => ({
  id: 'run',
  trade_date: '2026-11-09',
  session: 'pre',
  run_at: '2026-11-09T13:30:00Z',
  data_date: null,
  universe_size: 20,
  failed_symbols: [],
  summary: null,
  day_runs: [],
  payload: {
    market: {
      call_premium: 1, put_premium: 2, net_premium: -1, pc_premium_ratio: 1.2, pc_baseline: 1,
      baseline_runs: 10, etf_net_premium: -1, stock_net_premium: 0, tickers_scanned: 20,
    },
    contributors: { positive: [], negative: [], positive_total: 0, negative_total: 0 },
    contracts,
    tickers: [],
  },
});

const render = (contracts) => renderToStaticMarkup(React.createElement(sections.UnusualContracts, { run: run(contracts) }));

test('contracts render as a labelled table with one column per fact', () => {
  const markup = render([contract(), contract({ symbol: 'QQQ1', underlying: 'QQQ', premium: 90_000_000, type: 'call', strike: 730 })]);
  assert.match(markup, /<table/);
  assert.match(markup, /<caption class="sr-only">/);
  assert.match(markup, /<th scope="col"[^>]*>标的<\/th>/);
  assert.match(markup, /<th scope="col"[^>]*>合约<\/th>/);
  assert.match(markup, /<th scope="col"[^>]*>权利金<\/th>/);
  // The row identity is a row header linking to the options chain.
  assert.match(markup, /<th scope="row"/);
  assert.match(markup, /href="\/dashboard\/market\/SPY\?tab=options"/);
  // Logo per underlying, not decoration: it is the identity of the stock.
  assert.match(markup, /data-logo="SPY"/);
});

test('premium is right-aligned tabular data with no decorative bar', () => {
  const markup = render([contract(), contract({ symbol: 'X', underlying: 'QQQ', premium: 73_000_000 })]);
  const premiumCells = [...markup.matchAll(/<td class="w-\[7\.5rem\][^"]*"[^>]*>(.*?)<\/td>/g)].map((match) => match[1]);
  assert.equal(premiumCells.length, 2);
  for (const cell of premiumCells) {
    assert.match(cell, /figure/, 'tabular numerals');
    assert.match(cell, /font-semibold/);
    assert.match(cell, /\$1?[0-9.]+M/);
  }
  // No progress bar per row: the number is the fact, the column is the comparison.
  assert.doesNotMatch(markup, /class="absolute inset-x-2 bottom-1/, 'no per-row bar');
});

test('expansion is an explicit button with the disclosure contract', () => {
  const markup = render([contract()]);
  const button = markup.match(/<button[^>]*aria-expanded="false"[^>]*>/);
  assert.ok(button, 'a collapsed disclosure button exists');
  assert.match(button[0], /aria-controls="activity-contract-0"/);
  assert.match(button[0], /aria-label="展开 SPY \$725 看跌详情"/);
  assert.doesNotMatch(markup, /<tr[^>]*onclick/i, 'no row-level click handler stands in for a button');
});

test('the old card design does not come back', () => {
  const source = fs.readFileSync(path.join(__dirname, '../components/options-activity/sections.tsx'), 'utf8');
  assert.doesNotMatch(source, /border-l-4/, 'no coloured left rail per row');
  assert.doesNotMatch(source, /<li className="overflow-hidden rounded-2xl/, 'no card per contract');
});

test('a group with no contracts says so instead of rendering an empty body', () => {
  const markup = render([contract({ is_etf: true })]);
  assert.match(markup, /全部 1/);
  assert.match(markup, /个股 0/);
});

test('a volume/open-interest spike is emphasised, a quiet one is not', () => {
  const loud = render([contract({ vol_oi: 5.1 })]);
  const quiet = render([contract({ vol_oi: 0.9 })]);
  assert.match(loud, /class="figure font-medium text-foreground"/);
  assert.match(quiet, /class="figure text-muted-foreground"/);
});

test('dates and counts follow the reader locale instead of hard-coded formats', () => {
  const markup = render([contract({ expiration: '2026-11-20' })]);
  assert.match(markup, /11\/20/);
  assert.doesNotMatch(markup, /2026-11-20 ·/, 'expiry is written for the reader, the ISO string stays in the details');
  const source = fs.readFileSync(path.join(__dirname, '../components/options-activity/sections.tsx'), 'utf8');
  assert.doesNotMatch(source, /toLocaleString\(\)|toLocaleDateString\(\)/, 'no locale-less formatting');
  assert.doesNotMatch(source, /\.toLocaleString\(\s*\)/, 'volume is formatted with Intl, not toString');
});
