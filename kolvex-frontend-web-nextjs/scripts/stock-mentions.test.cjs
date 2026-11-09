const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// A ticker in an answer is a company: it should read as a logo that links to that
// symbol's quotes page, and the words that only look like tickers (AI, EPS, PE) must
// stay words. These tests cover both the detection rules and the rendering.

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

const mentions = compile('lib/markdown/stockMentions.ts', {});
const { isBareTicker, isTickerHeader, splitStockMentions, findSymbols, remarkStockMentions, normalizeSymbol } = mentions;

/** Symbols in the order they were found; the parts are cross-realm objects. */
function symbolsIn(text, universe) {
  // Array.from keeps the result in this realm, so deepEqual can compare it.
  return Array.from(splitStockMentions(text, universe))
    .filter((part) => typeof part !== 'string')
    .map((part) => part.symbol);
}

async function parse(markdown) {
  const { fromMarkdown } = await import('mdast-util-from-markdown');
  const { gfmFromMarkdown } = await import('mdast-util-gfm');
  const { gfm } = await import('micromark-extension-gfm');
  return fromMarkdown(markdown, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
}

/** Every stock link in a parsed tree, in document order. */
function stockLinks(tree) {
  const found = [];
  const visit = (node) => {
    if (node.type === 'link' && typeof node.url === 'string' && node.url.startsWith('stock:')) {
      found.push(node.url.slice('stock:'.length));
    }
    (node.children ?? []).forEach(visit);
  };
  visit(tree);
  return found;
}

test('a bare token is a ticker only when it is shaped like one and is not finance shorthand', () => {
  assert.equal(isBareTicker('MSFT'), true);
  assert.equal(isBareTicker('BRK.B'), true);
  assert.equal(isBareTicker('nvda'), false, 'lower case is a word, not a symbol');
  for (const word of ['AI', 'EPS', 'PE', 'EBITDA', 'FCF', 'TTM', 'CEO', 'IPO', 'ETF', 'VIX', 'Q1']) {
    assert.equal(isBareTicker(word), false, `${word} is shorthand, not a ticker`);
  }
  // `$` makes the intent explicit, so even a blocked word becomes a symbol.
  assert.equal(normalizeSymbol('$AI'), 'AI');
  assert.equal(isTickerHeader('标的'), true);
  assert.equal(isTickerHeader('Ticker'), true);
  assert.equal(isTickerHeader('现价'), false);
});

test('prose links an upper-case ticker once the answer has named it', () => {
  assert.deepEqual(symbolsIn('微软 MSFT 走强', new Set()), []);
  assert.deepEqual(symbolsIn('微软 MSFT 走强', new Set(['MSFT'])), ['MSFT']);
  // Lower case is prose, not a symbol.
  assert.deepEqual(symbolsIn('微软 msft 走强', new Set()), []);
  // Shorthand stays words.
  assert.deepEqual(symbolsIn('AI 资本开支与 EPS、PE 都在抬升', new Set()), []);
  // A cash tag needs no table and drops its `$`, which is a marker, not the identity.
  assert.deepEqual(symbolsIn('看好 $nvda 和 $BRK.B', new Set()), ['NVDA', 'BRK.B']);
  // Prices are not cash tags, and neither are unit labels: ($B) is a billion, ($M) a million.
  assert.deepEqual(symbolsIn('现价 $530.61', new Set()), []);
  assert.deepEqual(symbolsIn('| Revenue ($B) | 245 |\n| Net Income ($M) | 88 |', new Set()), []);
});

test('a question already names the tickers an answer should link', () => {
  assert.deepEqual(Array.from(findSymbols('分析一下 NVDA 和 AMD，顺便看看 $tsla')), ['NVDA', 'AMD', 'TSLA']);
  assert.deepEqual(Array.from(findSymbols('这些 AI 公司的 EPS 和 PE 怎么看')), []);
});

test('a ticker table links its identity column and leaves the metric columns alone', async () => {
  const tree = await parse([
    '| 标的 | 现价 | 净情绪得分 | 说明 |',
    '| --- | --- | --- | --- |',
    '| MSFT | $530.61 | +21.0 | 一致看好 |',
    '| NVDA | $186.64 | +15.3 | 分歧大 |',
  ].join('\n'));
  remarkStockMentions()(tree);
  assert.deepEqual(stockLinks(tree).map(String), ['MSFT', 'NVDA']);
});

test('a table without a named ticker column still links a column made only of tickers', async () => {
  const tree = await parse('| A | B |\n| --- | --- |\n| TSLA | 12 |\n| AMD | 8 |');
  remarkStockMentions()(tree);
  assert.deepEqual(stockLinks(tree), ['TSLA', 'AMD']);
});

test('acronyms and lower-case code stay words while real tickers get linked', async () => {
  const tree = await parse([
    'AI 资本开支是主线，EPS 与 PE 都在抬升。',
    '',
    '| 标的 | 现价 |',
    '| --- | --- |',
    '| MSFT | $530.61 |',
    '',
    'MSFT 与 NVDA 的分歧最大，`.NET` 和 `code` 不该被当成股票。',
  ].join('\n'));
  remarkStockMentions()(tree);
  // The table named MSFT, so its prose mention links; NVDA never appeared in a table.
  assert.deepEqual(stockLinks(tree).map(String), ['MSFT', 'MSFT']);
});

test('inline code naming a ticker becomes a stock, code fences are left untouched', async () => {
  const tree = await parse('关注 `AVGO` 与 `PE`。\n\n```js\nconst AVGO = 1;\n```');
  remarkStockMentions()(tree);
  assert.deepEqual(stockLinks(tree), ['AVGO']);
});

test('a workspace ticker that is a single letter only links because the page knows it', async () => {
  const bare = await parse('T 与 F 都是这页的股票。');
  remarkStockMentions()(bare);
  assert.deepEqual(stockLinks(bare).map(String), [], 'single letters alone are words');

  const seeded = await parse('T 与 F 都是这页的股票。');
  remarkStockMentions({ knownSymbols: ['T', 'F'] })(seeded);
  assert.deepEqual(stockLinks(seeded).map(String), ['T', 'F']);
});

test('an existing link is never rewritten into a nested stock link', async () => {
  const tree = await parse('见 [MSFT 财报](https://example.com/msft) 和 MSFT');
  remarkStockMentions({ knownSymbols: ['MSFT'] })(tree);
  assert.deepEqual(stockLinks(tree), ['MSFT']);
  let external = null;
  const find = (node) => {
    if (node.type === 'link' && node.url === 'https://example.com/msft') external = node;
    (node.children ?? []).forEach(find);
  };
  find(tree);
  assert.equal(external && external.children.map((child) => child.value).join(''), 'MSFT 财报');
});

test('a stock mention renders as a logo link to the quotes page for that symbol', () => {
  const rich = compile('components/markdown/rich-markdown.tsx', {
    'react-markdown': { defaultUrlTransform: (url) => url },
    'remark-gfm': {},
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/components/ui/company-logo': { default: ({ symbol }) => React.createElement('span', { 'data-logo': symbol }) },
    '@/components/decision/shared': { useCopy: () => (en, zh) => zh },
    '@/lib/utils': { cn: (...parts) => parts.filter(Boolean).join(' ') },
  });
  const markup = renderToStaticMarkup(rich.StockMention({ symbol: 'MSFT' }));
  assert.match(markup, /href="\/dashboard\/market\/MSFT"/);
  assert.match(markup, /data-logo="MSFT"/, 'the logo sits beside the ticker');
  assert.match(markup, />MSFT</);

  // A non-stock link keeps the default anchor treatment.
  const plain = renderToStaticMarkup(rich.RICH_MARKDOWN_COMPONENTS.a({
    href: 'https://example.com',
    children: 'example',
  }));
  assert.match(plain, /<a href="https:\/\/example\.com">example<\/a>/);
});

test('the shared prose rules keep the default URL policy and only add the stock scheme', () => {
  const prose = compile('lib/markdown/prose.ts', {
    'react-markdown': { defaultUrlTransform: (url) => (/^(https?|mailto):/i.test(url) ? url : '') },
    'remark-gfm': {},
  });
  assert.equal(prose.richUrlTransform('stock:MSFT'), 'stock:MSFT');
  assert.equal(prose.richUrlTransform('https://example.com'), 'https://example.com');
  assert.equal(prose.richUrlTransform('javascript:alert(1)'), '');
  // unified calls each entry as an attacher, so the plugin is passed uncalled (the
  // compiled copies differ by realm, hence the name check rather than identity).
  assert.equal(prose.RICH_REMARK_PLUGINS[1][0].name, 'remarkStockMentions');
});

test('every surface that draws assistant prose uses the stock-aware pipeline', () => {
  const root = path.join(__dirname, '..');
  for (const file of [
    'components/chat/ChatBubble.tsx',
    'components/chat/workspace/parts.tsx',
    'components/trading-analysis/markdown.tsx',
  ]) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /RICH_REMARK_PLUGINS|richRemarkPlugins/, `${file} links tickers`);
    assert.match(source, /richUrlTransform/, `${file} keeps the stock scheme through the URL policy`);
  }
});
