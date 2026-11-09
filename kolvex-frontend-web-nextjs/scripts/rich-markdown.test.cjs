const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Assistant answers are read as reports, not as chat: the model must not decorate them
// with emoji, and a ranked comparison should arrive as a chart or a table rather than
// as a paragraph of numbers. These tests cover the render side of that contract.

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

const mocks = {
  'react-markdown': { defaultUrlTransform: (url) => url },
  'remark-gfm': {},
  '@/components/decision/shared': { useCopy: () => (en, zh) => (process.env.TEST_LOCALE === 'en' ? en : zh) },
  '@/lib/utils': { cn: (...parts) => parts.filter(Boolean).join(' ') },
  'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
  '@/components/ui/company-logo': { default: ({ symbol }) => React.createElement('span', { 'data-logo': symbol }) },
};

// Prose rules are plain functions in lib (a server component renders them too).
const prose = compile('lib/markdown/prose.ts', mocks);
const markdown = compile('components/markdown/rich-markdown.tsx', mocks);

const { stripEmoji, parseChartSpec } = prose;
const { DataTable, RICH_MARKDOWN_COMPONENTS } = markdown;

test('decorative pictographs are removed and the leftover spacing is tidied', () => {
  assert.equal(stripEmoji('📊 一句话总结当前博主情绪'), '一句话总结当前博主情绪');
  assert.equal(stripEmoji('- 🟢 最一致看好'), '- 最一致看好');
  assert.equal(stripEmoji('✅ 完成 ✅'), '完成');
  assert.equal(stripEmoji('🔥热点：半导体回调'), '热点：半导体回调');
  // Emoji that stood alone on a line must not leave an empty paragraph behind.
  assert.equal(stripEmoji('结论\n📈\n正文'), '结论\n\n正文');
});

test('structure the model wrote survives: nested lists and indented code stay indented', () => {
  assert.equal(stripEmoji('- 一级\n  - 🟢 二级'), '- 一级\n  - 二级');
  assert.equal(stripEmoji('正文\n\n    const x = 1;'), '正文\n\n    const x = 1;');
});

test('symbols that carry meaning are kept', () => {
  // Percent changes, arrows and a rating scale are data, not decoration.
  assert.equal(stripEmoji('▲ 3.2%'), '▲ 3.2%');
  assert.equal(stripEmoji('★ 评分 4/5'), '★ 评分 4/5');
  assert.equal(stripEmoji('$530.61'), '$530.61');
});

test('a chart block needs at least two numeric items and never throws on bad JSON', () => {
  assert.equal(parseChartSpec('{not json'), null);
  assert.equal(parseChartSpec('{"type":"bar","items":[{"label":"MSFT","value":1}]}'), null);
  const spec = parseChartSpec('{"type":"bar","title":"净情绪得分","items":[{"label":"MSFT","value":21},{"label":"AMD","value":-4.2}]}');
  assert.equal(spec.type, 'bar');
  assert.equal(spec.title, '净情绪得分');
  assert.deepEqual([...spec.items.map((item) => item.label)], ['MSFT', 'AMD']);
  // A stringified value is accepted; a non-numeric one is dropped.
  assert.equal(parseChartSpec('{"items":[{"label":"A","value":"3"},{"label":"B","value":"x"}]}'), null);
});

test('a chart block renders as bars, ranked, with the value written out', () => {
  const spec = parseChartSpec('{"title":"净情绪得分","items":[{"label":"AMD","value":-4.2},{"label":"MSFT","value":21},{"label":"META","value":17.9}]}');
  const pre = RICH_MARKDOWN_COMPONENTS.pre;
  const markup = renderToStaticMarkup(pre({ children: React.createElement('code', { className: 'language-chart' }, JSON.stringify(spec)) }));
  assert.match(markup, /净情绪得分/);
  assert.match(markup, /\+21/);
  assert.match(markup, /-4\.2/);
  assert.match(markup, /bg-negative/);
  // Ranked: the strongest score comes before the weakest.
  assert.ok(markup.indexOf('MSFT') < markup.indexOf('AMD'));
  // It is a chart, not the raw JSON.
  assert.doesNotMatch(markup, /language-chart|\{"items"/);
});

test('an unparseable chart falls back to the original code block', () => {
  const pre = RICH_MARKDOWN_COMPONENTS.pre;
  const markup = renderToStaticMarkup(pre({ children: React.createElement('code', { className: 'language-chart' }, '{"items": []') }));
  assert.match(markup, /^<pre>/);
});

test('table cells align numbers right and give a direction word its colour back', () => {
  const markup = renderToStaticMarkup(DataTable({
    children: React.createElement(
      'tbody',
      null,
      React.createElement(
        'tr',
        null,
        React.createElement(RICH_MARKDOWN_COMPONENTS.td, null, '$530.61'),
        React.createElement(RICH_MARKDOWN_COMPONENTS.td, null, '+21.0'),
        React.createElement(RICH_MARKDOWN_COMPONENTS.td, null, '最一致看好'),
        React.createElement(RICH_MARKDOWN_COMPONENTS.td, null, '最看空'),
        React.createElement(RICH_MARKDOWN_COMPONENTS.td, null, '—'),
      ),
    ),
  }));
  assert.equal(markup.match(/text-right figure/g).length, 2, 'prices and scores are numeric columns');
  assert.match(markup, /bg-positive/);
  assert.match(markup, /bg-negative/);
  // A placeholder is not a number.
  assert.match(markup, /text-left">—/);
  // Prose typography must not restyle the table we drew ourselves.
  assert.match(markup, /not-prose/);
});

test('a numeric column right-aligns its header too, so the column reads as one block', () => {
  const build = (table) => renderToStaticMarkup(DataTable({ children: table }));
  const markup = build(React.createElement(
    React.Fragment,
    null,
    React.createElement('thead', null, React.createElement('tr', null,
      React.createElement(RICH_MARKDOWN_COMPONENTS.th, null, '现价'),
      React.createElement(RICH_MARKDOWN_COMPONENTS.th, null, '博主基调'),
    )),
    React.createElement('tbody', null,
      React.createElement('tr', null,
        React.createElement(RICH_MARKDOWN_COMPONENTS.td, null, '$530.61'),
        React.createElement(RICH_MARKDOWN_COMPONENTS.td, null, '看好'),
      ),
      React.createElement('tr', null,
        React.createElement(RICH_MARKDOWN_COMPONENTS.td, null, '$610.15'),
        React.createElement(RICH_MARKDOWN_COMPONENTS.td, null, '分歧大'),
      ),
    ),
  ));
  // Header cells sit in the same order as the body cells they describe.
  const headers = [...markup.matchAll(/<th [^>]*>/g)].map((match) => match[0]);
  assert.match(headers[0], /text-right/, 'the price column header follows its numbers');
  assert.match(headers[1], /text-left/, 'a word column stays left');
});

test('chat and research surfaces both strip emoji and share the renderer', () => {
  const root = path.join(__dirname, '..');
  for (const file of ['components/chat/ChatBubble.tsx', 'components/chat/workspace/parts.tsx', 'components/trading-analysis/markdown.tsx']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.match(source, /RICH_MARKDOWN_COMPONENTS/, `${file} uses the shared renderer`);
    assert.match(source, /stripEmoji/, `${file} strips emoji from model output`);
    // Pure text rules must come from lib: importing them off the client module breaks RSC.
    assert.match(source, /from "@\/lib\/markdown\/prose"/, `${file} imports the text rules from lib`);
  }
});

test('the model prompt forbids emoji and documents the chart block', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../kolvex-backend-py/app/core/report_format.py'), 'utf8');
  assert.match(source, /Never use emoji/);
  assert.match(source, /```chart/);
  const config = fs.readFileSync(path.join(__dirname, '../../kolvex-backend-py/app/agent/config.py'), 'utf8');
  assert.match(config, /SYSTEM_PROMPT = """.*\n""" \+ REPORT_FORMATTING/s);
});
