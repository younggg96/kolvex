const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const copy = require('../lib/i18n/locales/en.json');
const t = key => key.split('.').reduce((value, part) => value?.[part], copy) ?? key;
function render(state) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/../components/landing/LandingStockTicker.tsx`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, require(key) {
    if (key === '@/hooks/useStockData') return { useMultipleQuotes: () => state };
    if (key === '@/lib/i18n') return { useTranslation: () => ({ t }) };
    if (key === '@/lib/stockLinks') return { marketStockUrl: symbol => `/dashboard/market/${symbol}` };
    if (key === '@/components/ui/company-logo') return { __esModule: true, default: () => null };
    if (key === 'next/link') return { __esModule: true, default: ({ href, children, ...props }) => React.createElement('a', { href, ...props }, children) };
    return require(key);
  } });
  return renderToStaticMarkup(React.createElement(module.exports.default));
}
test('unavailable and loading tickers never display invented prices or a LIVE claim', () => {
  for (const state of [{ data: [], error: 'offline', loading: false }, { data: [], error: null, loading: true }]) {
    const markup = render(state);
    assert.doesNotMatch(markup, /\$\d|LIVE|482\.12|245\.34/);
    assert.match(markup, /—/);
    assert.match(markup, /href="\/dashboard\/market\/NVDA"/);
  }
});
test('partial responses display only genuine prices and preserve missing-symbol placeholders', () => {
  const markup = render({ data: [{ symbol: 'NVDA', price: 203.36, changePercent: -1.61 }], error: 'partial', loading: false });
  assert.match(markup, /\$203\.36/);
  assert.match(markup, /-1\.61%/);
  assert.match(markup, /—/);
  assert.doesNotMatch(markup, /LIVE|245\.34|482\.12/);
});
