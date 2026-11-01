const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function compile(file, mocks = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require: key => mocks[key] ?? require(key), console });
  return module.exports;
}
const indicators = compile('components/youtube/chart/indicators.ts');
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
const bars = Array.from({ length: 80 }, (_, i) => ({ date: `2026-01-${String(i % 28 + 1).padStart(2, '0')}`, open: i + 1, high: i + 2, low: i, close: i + 1, volume: 100 }));

test('Wilder RSI retains warmup, matches hand-calculated smoothing and handles flat/up/down windows', () => {
  const result = indicators.rsi([0, 2, 1, 3], 2);
  assert.equal(result[0], null); assert.equal(result[1], null);
  close(result[2], 100 - 100 / 3);
  close(result[3], 100 - 100 / 7);
  close(indicators.rsi(Array(20).fill(5))[19], 50);
  close(indicators.rsi(bars.map(b => b.close))[79], 100);
  close(indicators.rsi(bars.map(b => -b.close))[79], 0);
  assert.ok(indicators.rsi([1, 2]).every(v => v === null));
});

test('MACD warms DIF and DEA separately and yields known values on a linear trend', () => {
  const result = indicators.macd(bars.map(b => b.close));
  assert.ok(result.dif.slice(0, 25).every(v => v === null));
  assert.ok(result.dea.slice(0, 33).every(v => v === null));
  close(result.dif[25], 7); close(result.dea[33], 7); close(result.histogram[33], 0);
  const flat = indicators.macd(Array(50).fill(10));
  close(flat.dif[49], 0); close(flat.dea[49], 0); close(flat.histogram[49], 0);
  assert.equal(indicators.macd([]).dif.length, 0);
});

test('KDJ uses full windows, 50 seeds, recursive smoothing, and permits J outside 0–100', () => {
  const input = Array.from({ length: 12 }, () => ({ high: 100, low: 0, close: 100 }));
  const result = indicators.kdj(input);
  assert.ok(result.k.slice(0, 8).every(v => v === null));
  close(result.k[8], 200 / 3); close(result.d[8], 500 / 9); close(result.j[8], 800 / 9);
  assert.ok(result.j[9] > 100);
  const flat = indicators.kdj(Array.from({ length: 12 }, () => ({ high: 5, low: 5, close: 5 })));
  close(flat.k[11], 50); close(flat.d[11], 50); close(flat.j[11], 50);
  assert.equal(indicators.kdj([]).k.length, 0);
});

const Pane = compile('components/youtube/chart/OscillatorPane.tsx', {
  './indicators': indicators,
  '@/components/ui/button': { Button: ({ children, variant, size, ...props }) => React.createElement('button', props, children) },
}).default;
const t = key => key;
function render(kind, input = bars) {
  return renderToStaticMarkup(React.createElement(Pane, { bars: input, kind, onChange() {}, width: 400, axisWidth: 60, start: 0, end: input.length, active: null, onActive() {}, t }));
}

test('oscillator panes expose readable values, keyboard inspection and finite SVG geometry', () => {
  for (const kind of ['kdj', 'macd', 'rsi']) {
    const markup = render(kind);
    assert.match(markup, /role="slider"/);
    assert.match(markup, /aria-valuetext=/);
    assert.doesNotMatch(markup, /NaN|Infinity|undefined/);
    assert.match(markup, /<path/);
  }
  assert.match(render('macd'), /HIST/);
  assert.match(render('kdj', bars.slice(0, 3)), /indicatorWarmup/);
  assert.doesNotMatch(render('kdj', bars.slice(0, 3)), /role="slider"/);
});

test('subpane switching, close and pointer/keyboard inspection use the shared visible bar indices', () => {
  const InteractivePane = compile('components/youtube/chart/OscillatorPane.tsx', {
    react: { ...React, useId: () => 'pane-test', useMemo: fn => fn() },
    './indicators': indicators,
    '@/components/ui/button': { Button: 'button' },
  }).default;
  const changes = [], inspected = [];
  const tree = InteractivePane({ bars, kind: 'kdj', onChange: value => changes.push(value), width: 400, axisWidth: 60,
    start: 10, end: 20, active: 15, onActive: value => inspected.push(value), t });
  const elements = [];
  function visit(node) {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node?.props) return;
    elements.push(node); visit(node.props.children);
  }
  visit(tree);
  elements.find(node => node.props.title === 'MACD (12, 26, 9)').props.onClick();
  elements.find(node => node.props['aria-label'] === 'youtubeOpinions.hideOscillator').props.onClick();
  assert.deepEqual(changes, ['macd', null]);
  const plot = elements.find(node => node.type === 'svg');
  plot.props.onKeyDown({ key: 'ArrowRight', preventDefault() {} });
  plot.props.onPointerMove({ clientX: 68, currentTarget: { getBoundingClientRect: () => ({ left: 0, width: 400 }) } });
  plot.props.onPointerLeave();
  assert.deepEqual(inspected, [16, 12, null]);
});

const DrawingLayer = compile('components/youtube/ChartDrawingLayer.tsx', {
  '@/lib/utils': { cn: (...items) => items.filter(Boolean).join(' ') },
  '@/lib/stockApi': { formatPrice: value => value.toFixed(2), formatChangePercent: String },
  './chartDrawings': { fibLevels: [0, 0.5, 1] },
  './strength': { toneStroke: { positive: 'green', negative: 'red' } },
}).default;

test('new drawings render single-anchor time lines, bidirectional lines and mirrored Fibonacci projections', () => {
  const renderDrawing = (type, points) => renderToStaticMarkup(React.createElement(DrawingLayer, {
    width: 400, height: 200, drawings: [{ id: 'saved', type, points, color: 'rgb(41 98 255)' }], draft: null,
    selectedId: 'saved', interactive: true, toPx: anchor => ({ x: anchor.time, y: 200 - anchor.price }), barsBetween: () => 2,
    t: key => key === 'common.intlLocale' ? 'en-US' : key,
  }));
  assert.match(renderDrawing('vline', [{ time: 10, price: 50 }]), /data-handle="0"/);
  const extended = renderDrawing('extended', [{ time: 20, price: 50 }, { time: 40, price: 60 }]);
  assert.match(extended, /x1="-/); assert.match(extended, /data-handle="1"/);
  assert.match(renderDrawing('fibext', [{ time: 20, price: 100 }, { time: 40, price: 110 }]), /1.618 \(116.18\)/);
  assert.match(renderDrawing('fibext', [{ time: 20, price: 110 }, { time: 40, price: 100 }]), /1.618 \(93.82\)/);
});
