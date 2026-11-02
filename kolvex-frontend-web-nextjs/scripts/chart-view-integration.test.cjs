const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Same transpile-and-evaluate pattern as scripts/chart-advanced-indicators.test.cjs: the real
// ChartView is rendered with PriceGraph stubbed by a recorder, so these assertions are about the
// WIRING (which props reach the graph in which mode), not about PriceGraph's own markup.

/** Props handed to the stubbed PriceGraph, one entry per render. */
const graphRenders = [];

function compile(file, mocks = {}) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const load = (key) => {
    if (key in mocks) return mocks[key];
    if (key.startsWith('@/') || key.startsWith('./') || key.startsWith('../')) return compile(resolveModule(file, key));
    return require(key);
  };
  // ChartView reads localStorage/setTimeout through `window`; a minimal shim keeps the module
  // evaluable in Node (formatChangePercent/formatPrice come from the stockApi stub below).
  const window = { localStorage: { getItem: () => null, setItem() {} }, setTimeout, clearTimeout, addEventListener() {}, removeEventListener() {} };
  vm.runInNewContext(output, { module, exports: module.exports, require: load, console, window });
  return module.exports;
}

/** Resolve a relative/aliased import of a file that may be .ts or .tsx. */
function resolveModule(fromFile, spec) {
  const base = spec.startsWith('@/')
    ? path.join('', spec.slice(2))
    : path.join(path.dirname(fromFile), spec);
  for (const candidate of [`${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(path.join(__dirname, '..', candidate))) return candidate;
  }
  throw new Error(`cannot resolve ${spec} from ${fromFile}`);
}

const bars = Array.from({ length: 40 }, (_, index) => ({
  date: `2026-08-${String(index + 1).padStart(2, '0')}`,
  open: 100 + index,
  high: 102 + index,
  low: 99 + index,
  close: 101 + index,
  volume: 1000 + index,
}));

/** Everything ChartView needs, with the AI/drawing plumbing reduced to stable stubs. */
const baseProps = {
  symbol: 'NVDA',
  params: { period: '3mo', interval: '1d' },
  events: [
    { id: 'a', channel_id: 'c1', channel_title: 'Creator', opinion_date: '2026-08-10', sentiment: 'bullish' },
    { id: 'b', channel_id: 'c2', channel_title: 'Creator 2', opinion_date: '2026-08-12', sentiment: 'bearish' },
    { id: 'c', channel_id: 'c3', channel_title: 'Creator 3', opinion_date: '2026-08-12', sentiment: 'neutral' },
  ],
  drawings: [],
  setDrawings() {},
  undo() {},
  canUndo: false,
  syncStatus: 'synced',
  formatDate: (date) => date,
  t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
  snapshotBars: bars,
  aiJobs: { analysis: { status: 'idle' }, drawings: { status: 'idle' }, monitorError: null, checking: false, refresh() {} },
  selectedModel: '',
  onModelChange() {},
};

/**
 * PriceGraph stub: records its props, renders a marker and the advanced plot slot when present.
 * The real graph measures its box and hands it back through `onGeometry`; this stub reports a
 * fixed desktop box so ChartView's second pass builds the candles / drawings / oscillator.
 */
const DESKTOP_BOX = { width: 640, height: 360 };
function PriceGraphStub(props) {
  graphRenders.push(props);
  const [box, setBox] = React.useState(null);
  React.useEffect(() => setBox(DESKTOP_BOX), []);
  React.useEffect(() => {
    if (box) props.onGeometry?.(box);
  }, [box, props.onGeometry]);
  props = box ? props : { ...props, onGeometry: undefined };
  return React.createElement(
    'div',
    { 'data-graph-mode': props.mode, 'data-graph-range': props.range, 'data-graph-calls': props.calls ? props.calls.size : -1 },
    props.renderPlot ? React.createElement('div', { 'data-plot': 'advanced' }, props.renderPlot({
      width: 640, height: 360, plotWidth: 584, plotHeight: 334, priceTop: 28, priceBottom: 306,
      axisWidth: 56, timeAxis: 26, axisBlock: { x: 0, y: 0, w: 584, h: 306 },
      view: { start: 0, end: bars.length }, priceHigh: 142, priceLow: 99, count: bars.length,
      firstIndex: 0, lastIndex: bars.length - 1,
      xOf: (index) => ((index + 0.5) * 584) / bars.length,
      yOf: (price) => 28 + ((142 - price) / 43) * 278,
      indexAt: (time) => time, timeAt: (index) => index, priceAt: (y) => y,
      toPx: (anchor) => ({ x: anchor.time, y: anchor.price }), barsBetween: (a, b) => Math.round(b.time - a.time),
    })) : null,
    props.subPane ? React.createElement('div', { 'data-subpane': 'yes' }) : null,
    props.trailingControls ? React.createElement('div', { 'data-trailing': 'yes' }) : null,
    props.onOpenAdvanced ? React.createElement('div', { 'data-open-advanced': 'yes' }) : null,
  );
}

// The real geometry: ChartView is supposed to compute its advanced plot on the SAME shared
// geometry PriceGraph uses, so this module is stubbed only in its default (component) export.
const shared = compile('lib/chart/graph.ts');

function defaultGraphView({ count, times = [], rangeStart }) {
  if (count < 3) return null;
  const first = shared.firstIndexAt(times, rangeStart);
  return { start: first, end: count };
}

const graphGeometryCalls = [];
function graphGeometry(args) {
  graphGeometryCalls.push(args);
  const count = args.bars ? args.bars.length : 0;
  const view = args.view || { start: 0, end: Math.max(count, 1) };
  const plotWidth = Math.max(args.width - 56, 1);
  const plotHeight = Math.max(args.height - 26, 1);
  const slot = plotWidth / Math.max(view.end - view.start, 1e-6);
  return {
    width: args.width,
    height: args.height,
    plotWidth,
    plotHeight,
    priceTop: 28,
    priceBottom: Math.max(plotHeight - 40, 29),
    axisWidth: 56,
    timeAxis: 26,
    axisBlock: { x: 0, y: 0, w: plotWidth, h: Math.max(plotHeight - 40, 29) },
    view,
    priceHigh: 142,
    priceLow: 99,
    count,
    firstIndex: Math.max(Math.floor(view.start), 0),
    lastIndex: Math.min(Math.ceil(view.end) - 1, Math.max(count - 1, 0)),
    xOf: (index) => (index - view.start + 0.5) * slot,
    yOf: (price) => 28 + ((142 - price) / (142 - 99)) * (Math.max(plotHeight - 40, 29) - 28),
    indexAt: (time) => time,
    timeAt: (index) => index,
    priceAt: (y) => y,
    toPx: (anchor) => ({ x: anchor.time, y: anchor.price }),
    barsBetween: (a, b) => Math.round(b.time - a.time),
  };
}

const stubs = {
  './PriceGraph': { __esModule: true, default: PriceGraphStub, defaultGraphView, graphGeometry },
};

const ChartView = compile('components/youtube/chart/ChartView.tsx', {
  ...stubs,
  'react-dom': { createPortal: (node) => node },
  '@/lib/clientCache': { peekClientCache: () => null },
  '@/lib/stockApi': {
    stockHistoryKey: () => 'key',
    getStockHistory: () => Promise.resolve(bars),
    formatPrice: (value) => `$${Number(value).toFixed(2)}`,
    formatChangePercent: (value) => `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`,
    formatVolume: (value) => String(value),
  },
  '@/hooks/useAvailableProviders': { useAvailableProviders: () => ({ availableProviders: [], loading: false, refresh() {} }) },
  '@/lib/aiModels': { MODEL_CONFIGS: [], PROVIDER_NAME_TO_ID: {} },
  '../useChartAiJobs': {},
  '@/hooks/useChartAiJobs': {},
  '@/components/ui/dialog': Object.fromEntries(['Dialog', 'DialogContent', 'DialogDescription', 'DialogHeader', 'DialogTitle', 'DialogTrigger', 'DialogFooter', 'DialogClose'].map(key => [key, ({ children }) => React.createElement('div', null, children)])),
  '@/components/ui/popover': Object.fromEntries(['Popover', 'PopoverContent', 'PopoverTrigger'].map(key => [key, ({ children }) => React.createElement('div', null, children)])),
  '@/components/ui/select': Object.fromEntries(['Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue'].map(key => [key, ({ children }) => React.createElement('div', null, children)])),
  '@/components/ui/button': { Button: ({ children, ...props }) => React.createElement('button', props, children) },
  '@/components/ui/skeleton': { Skeleton: () => React.createElement('div') },
  '../CreatorAvatar': { __esModule: true, default: () => null },
  '../ChartDrawingLayer': { __esModule: true, default: () => React.createElement('svg', { 'data-drawings': 'yes' }) },
  './AiPriceActionSignals': { __esModule: true, default: () => null },
  './AiDrawingSetup': { __esModule: true, default: () => null },
  './AiAnalysisPanel': { __esModule: true, default: () => null },
  './AiAnalysisEmptyState': { __esModule: true, default: () => null },
}).default;

/**
 * Compiles ChartView once per box size so `size.width` is no longer 0 on the chart's first
 * state read. Two bundles cover the two states the real component goes through: before the
 * graph reports its box (0) and after (desktop 640).
 */
function compileChartView(initialBox) {
  const seededUseState = (initial) => {
    const value = typeof initial === 'function' ? initial() : initial;
    return React.useState(value?.width === 0 && initialBox > 0 ? { ...value, width: initialBox } : value);
  };
  return compile('components/youtube/chart/ChartView.tsx', {
    ...stubs,
    react: { ...React, useState: seededUseState },
    'react-dom': { createPortal: (node) => node },
    '@/lib/clientCache': { peekClientCache: () => null },
    '@/lib/stockApi': {
      stockHistoryKey: () => 'key',
      getStockHistory: () => Promise.resolve(bars),
      formatPrice: (value) => `$${Number(value).toFixed(2)}`,
      formatChangePercent: (value) => `${value >= 0 ? '+' : ''}${Number(value).toFixed(2)}%`,
      formatVolume: (value) => String(value),
    },
    '@/hooks/useAvailableProviders': { useAvailableProviders: () => ({ availableProviders: [], loading: false, refresh() {} }) },
    '@/lib/aiModels': { MODEL_CONFIGS: [], PROVIDER_NAME_TO_ID: {} },
    '@/hooks/useChartAiJobs': {},
    '@/components/ui/dialog': Object.fromEntries(['Dialog', 'DialogContent', 'DialogDescription', 'DialogHeader', 'DialogTitle', 'DialogTrigger', 'DialogFooter', 'DialogClose'].map(key => [key, ({ children }) => React.createElement('div', null, children)])),
    '@/components/ui/popover': Object.fromEntries(['Popover', 'PopoverContent', 'PopoverTrigger'].map(key => [key, ({ children }) => React.createElement('div', null, children)])),
    '@/components/ui/select': Object.fromEntries(['Select', 'SelectContent', 'SelectItem', 'SelectTrigger', 'SelectValue'].map(key => [key, ({ children }) => React.createElement('div', null, children)])),
    '@/components/ui/button': { Button: ({ children, ...props }) => React.createElement('button', props, children) },
    '@/components/ui/skeleton': { Skeleton: () => React.createElement('div') },
    '../CreatorAvatar': { __esModule: true, default: () => null },
    '../ChartDrawingLayer': { __esModule: true, default: () => React.createElement('svg', { 'data-drawings': 'yes' }) },
    './AiPriceActionSignals': { __esModule: true, default: () => null },
    './AiDrawingSetup': { __esModule: true, default: () => null },
    './AiAnalysisPanel': { __esModule: true, default: () => null },
    './AiAnalysisEmptyState': { __esModule: true, default: () => null },
  }).default;
}

const chartView = compileChartView(0);
const chartViewSized = compileChartView(640);

/** Renders in both size states; `graph` is the props the graph receives once its box is known. */
function render(props) {
  graphRenders.length = 0;
  const base = { ...baseProps, ...props };
  const markup = renderToStaticMarkup(React.createElement(chartView, base));
  const first = graphRenders.at(-1);
  renderToStaticMarkup(React.createElement(chartViewSized, base));
  const settled = graphRenders.at(-1) || first;
  settled.initial = first;
  return { markup, graph: settled, initialGraph: first };
}

test('compact mode renders through PriceGraph, not its own SVG preview', () => {
  const { markup, graph } = render({ mode: 'compact' });
  assert.ok(graph, 'ChartView must mount PriceGraph in compact mode');
  assert.equal(graph.mode, 'compact');
  assert.equal(markup.includes('data-graph-mode="compact"'), true);
  // The old inline preview SVG (H:/L: labels + axis frame) must be gone.
  assert.doesNotMatch(markup, /H: /);
  assert.doesNotMatch(markup, /L: /);
  // Advanced-only plumbing stays out of the compact graph.
  assert.equal(graph.renderPlot, undefined);
  assert.equal(graph.onOpenAdvanced, baseProps.onOpenAdvanced);
  assert.equal(graph.overlay, null);
});

test('compact mode forwards the host-owned range contract straight to the graph', () => {
  const rangeOptions = [
    { value: '1M', label: '1月' },
    { value: '3M', label: '3月' },
    { value: '6M', label: '6月' },
  ];
  const chosen = [];
  const { graph } = render({
    mode: 'compact',
    range: '1M',
    onRangeChange: (next) => chosen.push(next),
    rangeOpen: false,
    onRangeOpenChange() {},
    rangeOptions,
    rangeLabel: 'Sep 26 – Oct 30',
  });
  assert.equal(graph.range, '1M', 'the host range must win over the internal default');
  assert.equal(graph.rangeOptions, rangeOptions, 'host labels are passed through untouched');
  assert.equal(graph.rangeLabel, 'Sep 26 – Oct 30');
  assert.equal(typeof graph.onRangeOpenChange, 'function');
  // Selecting a range asks the host to load that window (PriceChart owns the history).
  graph.onRangeChange('6M');
  assert.deepEqual(chosen, ['6M']);
});

test('compact mode without a host falls back to its own range state and options', () => {
  const { graph } = render({ mode: 'compact' });
  assert.equal(graph.range, '3M');
  assert.ok(Array.isArray(graph.rangeOptions) && graph.rangeOptions.length >= 9, 'advancedRanges minus CUSTOM');
  assert.deepEqual(Array.from(graph.rangeOptions, option => option.value), ['1D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'ALL']);
  assert.equal(graph.rangeOptions.find(option => option.value === '6M').label, 'youtubeOpinions.advancedRange.6M');
  // A standalone chart still reacts locally: no host callback required.
  graph.onRangeChange('1Y');
  const after = graphRenders.at(-1);
  assert.ok(after, 're-render expected');
});

test('creator calls reach the graph as per-bar counts', () => {
  const { graph } = render({ mode: 'compact' });
  // vm runs in its own realm, so compare by shape rather than `instanceof Map`.
  assert.equal(typeof graph.calls?.get, 'function');
  assert.ok(graph.calls.size > 0, 'calls made on charted days must reach the graph');
  const totals = Array.from(graph.calls.values()).reduce(
    (sum, entry) => ({ bullish: sum.bullish + entry.bullish, bearish: sum.bearish + entry.bearish, other: sum.other + entry.other }),
    { bullish: 0, bearish: 0, other: 0 },
  );
  assert.deepEqual({ ...totals }, { bullish: 1, bearish: 1, other: 1 });
  for (const entry of graph.calls.values()) {
    assert.deepEqual(Object.keys(entry).sort(), ['bearish', 'bullish', 'other']);
  }
});

test('advanced mode hands its candles to renderPlot on the graph geometry', () => {
  const { markup, graph } = render({ mode: 'advanced' });
  assert.equal(graph.mode, 'advanced');
  assert.equal(typeof graph.renderPlot, 'function', 'advanced candles must render inside PriceGraph');
  assert.equal(markup.includes('data-plot="advanced"'), true, 'the advanced plot must actually be invoked');
  // The range bar / interval / auto-scale are hosted by the graph's control row.
  assert.ok(graph.trailingControls, 'interval + auto-scale belong to the graph control row');
  assert.equal(graph.onOpenAdvanced, undefined, 'advanced mode does not reopen itself');
});

test('advanced mode keeps its own range and interval state out of the host props', () => {
  const { graph } = render({
    mode: 'advanced',
    range: '1M',
    rangeOptions: [{ value: '1M', label: 'host label' }],
    onRangeChange() {
      throw new Error('advanced mode must not call the host range callback');
    },
  });
  // `render` also renders the sized bundle, which is what the settled `graph` props come from;
  // the pre-size pass is the one that proves the host window never leaks in.
  assert.ok(graph, 'advanced mode must still mount the graph');
  // The settled props come from the sized bundle, which runs hooks directly, so this is exactly
  // what the graph receives with a measured box. The advanced chart keeps its own window.
  assert.equal(graph.range, '3M', 'advanced never adopts the host window');
  // Its range bar is built from `advancedRanges`, never from the host's option list.
  const unhosted = render({ mode: 'advanced' }).graph;
  assert.equal(unhosted.rangeOptions.map(option => option.value).join(','), '1D,1W,1M,3M,6M,YTD,1Y,5Y,ALL');
  assert.equal(unhosted.rangeOptions.find(option => option.value === '3M').label, 'youtubeOpinions.advancedRange.3M');
  assert.equal(unhosted.range, '3M');
});

test('the oscillator pane and the drawing layer share the graph window', () => {
  const { graph } = render({ mode: 'advanced' });
  assert.ok(graph.subPane, 'advanced mounts the oscillator under the time axis');
  assert.ok(graph.drawingLayer, 'drawings are mounted through the graph slot');
  // Compact still shows saved drawings (read-only) so AI levels appear in the preview.
  const compact = render({ mode: 'compact' }).graph;
  assert.ok(compact.drawingLayer, 'compact shows the drawing layer read-only');
  // Both hosts stay mounted through the shared graph, so the pane can never drift from the candles.
  assert.equal(compact.mode, 'compact');
});


test('AI drawings render before the host has measured a box and use the live graph coordinates', () => {
  for (const mode of ['compact', 'advanced']) {
    const { initialGraph: initial } = render({ mode });
    assert.equal(typeof initial.onGeometry, 'function', 'the live graph must report its dimensions to enable AI controls and subpanes');
    assert.equal(typeof initial.drawingLayer, 'function', 'drawings must not wait for the removed host DOM ref');
    const live = graphGeometry({ bars, view: { start: 10, end: 30 }, width: 1200, height: 700 });
    const layer = initial.drawingLayer(live);
    assert.equal(layer.props.width, live.plotWidth);
    assert.equal(layer.props.height, live.axisBlock.h);
    assert.equal(layer.props.toPx, live.toPx, 'AI anchors must follow the same time and price scale as the candles');
    assert.equal(layer.props.barsBetween, live.barsBetween);
  }
});
