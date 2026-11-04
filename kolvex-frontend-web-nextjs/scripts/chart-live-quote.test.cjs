const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function compile(file) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const load = key => {
    if (key.startsWith('@/') || key.startsWith('.')) {
      const base = key.startsWith('@/') ? key.slice(2) : path.join(path.dirname(file), key);
      const resolved = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(item => fs.existsSync(path.join(__dirname, '..', item)));
      return compile(resolved);
    }
    return require(key);
  };
  vm.runInNewContext(source, { module, exports: module.exports, require: load, console });
  return module.exports;
}
const { latestChartQuote } = compile('lib/chart/quote.ts');
const PriceGraph = compile('components/youtube/chart/PriceGraph.tsx').default;
const quotes = {
  symbol: 'NVDA', price: 203.36, previousClose: 206.69, change: -3.33, changePercent: -1.6111,
  marketTime: 1793814337, source: 'Yahoo Finance', exchangeTimezone: 'America/New_York',
};
const bars = [201.06, 206.37, 203.13].map((close, index) => ({
  date: `2026-11-04T10:${String(index * 5).padStart(2, '0')}:00-05:00`, open: close, high: close, low: close, close, volume: 100,
}));
const copy = require('../lib/i18n/locales/en.json');
const t = key => key.split('.').reduce((value, part) => value?.[part], copy) || key;
function render(props = {}) {
  return renderToStaticMarkup(React.createElement(PriceGraph, {
    mode: 'compact', heightClass: 'h-80', bars, view: null, onViewChange() {}, range: '1D', onRangeChange() {},
    rangeOptions: [{ value: '1D', label: '1D' }], activeIndex: null, onActiveChange() {},
    formatDate: value => value, t, symbol: 'NVDA', quoteEnabled: true, quote: quotes, animate: false, ...props,
  }));
}

test('default price and daily direction come from the quote, independent of chart endpoints or range', () => {
  for (const range of ['1D', '1W', '1M', 'ALL']) {
    const markup = render({ range });
    assert.match(markup, /\$203\.36/);
    assert.match(markup, /-1\.61%/);
    assert.match(markup, /Regular · vs previous close/);
    assert.match(markup, /Yahoo Finance/);
    assert.match(markup, /EST/);
    assert.match(markup, /Quotes may be delayed/);
    assert.doesNotMatch(markup, /\+1\.03%/);
  }
});

test('daily percentages retain the shared API precision instead of rounding differently across components', () => {
  assert.equal(latestChartQuote({ ...quotes, price: 100.00495, previousClose: 100, changePercent: 0.005 }, false).changePercent, 0.005);
});

test('scrubbing displays the inspected candle and restores range comparison for historical ranges', () => {
  const markup = render({ activeIndex: 1, range: '1M' });
  assert.match(markup, /\$206\.37/);
  assert.match(markup, /in this range/);
  assert.doesNotMatch(markup, /Yahoo Finance/);
});

test('extended prices require matching timestamps newer than the regular quote and use the close as baseline', () => {
  const extended = { ...quotes, preMarketPrice: 210, preMarketTime: quotes.marketTime - 1, postMarketPrice: 204.36, postMarketTime: quotes.marketTime + 1 };
  const selected = latestChartQuote(extended);
  assert.equal(selected.session, 'post');
  assert.equal(selected.price, 204.36);
  assert.ok(Math.abs(selected.changePercent - 1 / 203.36 * 100) < 1e-9);
  assert.equal(latestChartQuote({ ...extended, postMarketTime: undefined }).session, 'regular');
  assert.equal(latestChartQuote({ ...extended, postMarketTime: quotes.marketTime - 10 }).session, 'regular');
  assert.equal(latestChartQuote({ ...extended, marketTime: undefined }).session, 'regular');
  assert.equal(latestChartQuote({ ...extended, preMarketTime: quotes.marketTime + 2 }).session, 'pre');
  assert.equal(latestChartQuote({ ...extended, postMarketPrice: NaN }).session, 'regular');
  const markup = render({ quote: extended });
  assert.match(markup, /\$204\.36/);
  assert.match(markup, /After hours · vs close/);
  assert.match(markup, /\$203\.36.*-1\.61%.*Regular · vs previous close/);
  assert.ok(markup.indexOf('$203.36') < markup.indexOf('$204.36'), 'regular quote stays primary across lists and chart headers');
  assert.match(markup, /Chart shows regular hours/);
});

test('quote failures retain useful history and clearly distinguish retained quotes from fresh data', () => {
  assert.match(render({ quoteError: true }), /Quote refresh failed\. Showing the last quote/);
  const unavailable = render({ quote: null, quoteError: true, onQuoteRetry() {} });
  assert.match(unavailable, /Latest quote unavailable\. Showing historical candles/);
  assert.match(unavailable, /Retry/);
  assert.doesNotMatch(unavailable, /\$0\.00/);
  assert.match(render({ quote: null, quoteLoading: true }), /Fetching latest quote/);
  const historyFailure = render({ bars: null, error: true, onRetry() {} });
  assert.match(historyFailure, /\$203\.36/);
  assert.match(historyFailure, /Price data is unavailable right now/);
  assert.match(render({ quote: { ...quotes, marketTime: undefined } }), /Quote time unavailable/);
  const snapshot = render({ quoteEnabled: false, quote: null });
  assert.match(snapshot, /in this range/);
  assert.doesNotMatch(snapshot, /Yahoo Finance|Latest quote unavailable/);
});
