const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Same pattern as scripts/chart-advanced-indicators.test.cjs: transpile the TS helper
// module and evaluate it so the graph geometry is exercised without a bundler.

function compile(file) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require, console });
  return module.exports;
}

const graph = compile('lib/chart/graph.ts');

const day = 86_400_000;
const times = Array.from({ length: 60 }, (_, index) => Date.UTC(2026, 7, 1) + index * day);
const bars = times.map((time, index) => ({ date: new Date(time).toISOString().slice(0, 10), close: 100 + index }));

test('range views fit exactly the requested window and keep a minimum span', () => {
  const all = graph.viewForRange({ count: times.length, times, kind: 'range', rangeStart: null });
  assert.equal(all.start, 0);
  assert.equal(all.end, times.length);

  const threeWeeks = graph.viewForRange({ count: times.length, times, kind: 'range', rangeStart: times[39] });
  assert.equal(threeWeeks.start, 39);
  assert.equal(threeWeeks.end, times.length);

  const twoDays = graph.viewForRange({ count: times.length, times, kind: 'range', rangeStart: times[58] });
  assert.equal(twoDays.end - twoDays.start, graph.GRAPH_MIN_BARS);
  assert.equal(twoDays.end, times.length);

  const beforeHistory = graph.viewForRange({ count: times.length, times, kind: 'range', rangeStart: times[0] - 40 * day });
  assert.equal(beforeHistory.start, 0);
  assert.equal(beforeHistory.end, times.length);

  const empty = graph.viewForRange({ count: 0, times: [], kind: 'range', rangeStart: null });
  assert.equal(empty.start, 0);
  assert.equal(empty.end, 1);
});

test('anchored windows add context bars on both sides but stay inside the data', () => {
  const anchored = graph.viewForRange({
    count: times.length,
    times,
    kind: 'anchor',
    anchor: { start: times[30], end: times[40], barsChange: -6 },
  });
  assert.equal(anchored.start, 36);
  assert.equal(anchored.end, 44);

  const atEdge = graph.viewForRange({
    count: times.length,
    times,
    kind: 'anchor',
    anchor: { start: times[0], end: times[5], barsChange: -6 },
  });
  // Clamping keeps at least 30% of the requested span visible, as panning does.
  assert.ok(Math.abs(atEdge.end - atEdge.start - 8) < 1e-9);
  assert.equal(atEdge.end, 14);
});

test('zoom and pan clamp to the data with a little scroll room', () => {
  const zoomed = graph.zoomGraphView({ start: 0, end: 60 }, 0.5, 0.5, 60);
  assert.ok(Math.abs(zoomed.end - zoomed.start - 30) < 1e-9);
  assert.ok(Math.abs(zoomed.start - 15) < 1e-9);

  const tiny = graph.zoomGraphView({ start: 0, end: 60 }, 0.01, 0.5, 60);
  assert.ok(Math.abs(tiny.end - tiny.start - graph.GRAPH_MIN_BARS) < 1e-6);
  assert.equal((tiny.start + tiny.end) / 2, 30);
  const rightAnchored = graph.zoomGraphView({ start: 30, end: 60 }, 0.01, 1, 60);
  assert.equal(rightAnchored.end, 60);

  const wide = graph.zoomGraphView({ start: 0, end: 60 }, 100, 0.5, 60);
  assert.ok(wide.end - wide.start <= 60 * 1.15 + 4);

  const panned = graph.clampGraphView({ start: 200, end: 260 }, 60);
  // Scroll room is bounded: the window never grows past the data plus 15%, and both pan ends
  // keep at least 30% of the window on loaded bars (with 10% slack on the left).
  assert.ok(panned.end - panned.start <= 60 * 1.15 + 4 + 1e-6);
  assert.ok(panned.start >= -(panned.end - panned.start) * 0.1 - 1e-6);
  assert.equal(panned.end - panned.start, 60);
  assert.ok(panned.start >= -(panned.end - panned.start) * 0.1);
});

test('price zoom keeps the cursor price fixed and bounds extreme scale changes', () => {
  const domain = { lo: 80, hi: 120 };
  const cursorRatio = 0.25;
  const zoomed = graph.zoomPriceDomain(domain, 0.5, cursorRatio, 40);
  assert.equal(zoomed.hi - zoomed.lo, 20);
  assert.equal(zoomed.hi - (zoomed.hi - zoomed.lo) * cursorRatio, 110);

  const smallest = graph.zoomPriceDomain(domain, 0, 0.5, 40);
  assert.ok(Math.abs(smallest.hi - smallest.lo - 0.4) < 1e-9);
  const largest = graph.zoomPriceDomain(domain, 1000, 0.5, 40);
  assert.equal(largest.hi - largest.lo, 4000);
});

test('date ticks are evenly spaced, unique and inside the visible window', () => {
  const ticks = graph.dateTickIndices({ start: 0, end: 60 }, 60, 6);
  assert.equal(ticks.length, 6);
  assert.equal(ticks[0], 0);
  assert.equal(ticks[ticks.length - 1], 59);
  assert.equal(new Set(ticks).size, ticks.length);
  assert.equal(graph.dateTickIndices({ start: 0, end: 4 }, 60, 6).join(','), '0,1,2,3');

  const partial = graph.dateTickIndices({ start: 10.4, end: 40.6 }, 60, 5);
  assert.ok(partial[0] >= 11 && partial[partial.length - 1] <= 40);
});

test('price domain pads the visible closes and price ticks stay inside a nice step grid', () => {
  const domain = graph.priceDomain(bars, { start: 0, end: 60 });
  const closes = bars.map(bar => bar.close);
  const low = Math.min(...closes);
  const high = Math.max(...closes);
  assert.ok(domain.lo < low && domain.hi > high);

  const ticks = graph.priceTickValues(domain.lo, domain.hi, 5);
  assert.ok(ticks.length >= 3);
  ticks.forEach(tick => assert.ok(tick >= domain.lo && tick <= domain.hi));
  const steps = ticks.slice(1).map((tick, index) => tick - ticks[index]);
  steps.forEach(step => assert.ok(Math.abs(step - steps[0]) < 1e-9));

  assert.equal(graph.priceTickValues(5, 5).length, 0);
  assert.equal(graph.priceTickValues(Number.NaN, 5).length, 0);
});
