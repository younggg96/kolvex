const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
function fixture(getStockHistory) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.join(__dirname, "../lib/stockTrends.ts"), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText,
    { module, exports: module.exports, DOMException, Date, require: () => ({ getStockHistory }) },
  );
  return module.exports;
}
const bars = [
  { date: "2026-10-21T16:00:00", close: 120 },
  { date: "2026-10-22T09:30:00", close: 100 },
  { date: "2026-10-22T10:00:00", close: 110 },
];
const params = { period: "1d", interval: "5m" };
const tick = () => new Promise((resolve) => setImmediate(resolve));
test("intraday previews retain the server’s close anchor and exclude invalid bars", () => {
  const { trendPoints, trendPath } = fixture();
  const points = trendPoints([...bars, { date: "2026-10-23", close: NaN }].reverse());
  // 120 previous close -> 100 -> 110: the line reads as a down day, matching the daily change.
  assert.deepEqual(
    Array.from(points, (point) => point.value),
    [120, 100, 110],
  );
  assert.equal(points[0].date, "2026-10-21T16:00:00");
  assert.equal(trendPath(points), "2.00,6.00 50.00,34.00 98.00,20.00");
  assert.deepEqual(
    Array.from(trendPoints(bars.slice(1)), (point) => point.value),
    [100, 110],
  );
  assert.equal(
    trendPath([
      { date: "a", value: 2 },
      { date: "b", value: 2 },
    ]),
    "2.00,20.00 98.00,20.00",
  );
  assert.equal(trendPath(points.slice(0, 1)), "");
});
test("preview requests are limited to three and successful ranges are cached separately", async () => {
  let active = 0,
    max = 0,
    calls = 0;
  const { loadStockTrend } = fixture(async () => {
    calls++;
    max = Math.max(max, ++active);
    await tick();
    active--;
    return bars;
  });
  const signal = new AbortController().signal;
  await Promise.all(
    ["A", "B", "C", "D", "E", "F", "G"].map((symbol) => loadStockTrend(symbol, params, signal)),
  );
  assert.equal(max, 3);
  await loadStockTrend("A", params, signal);
  assert.equal(calls, 7);
  await loadStockTrend("A", { period: "1mo", interval: "1d" }, signal);
  assert.equal(calls, 8);
});
test("queued requests cancel without contacting the provider and release capacity on failures", async () => {
  const finishes = [],
    seen = [];
  const { loadStockTrend } = fixture((symbol) => {
    seen.push(symbol);
    return new Promise((resolve, reject) => finishes.push({ resolve, reject }));
  });
  const signal = new AbortController().signal;
  const running = ["A", "B", "C"].map((symbol) =>
    loadStockTrend(symbol, params, signal).catch(() => []),
  );
  const controller = new AbortController();
  const queued = loadStockTrend("D", params, controller.signal);
  controller.abort();
  await assert.rejects(queued, { name: "AbortError" });
  finishes.forEach((finish) => finish.reject(new Error("upstream failure")));
  await Promise.all(running);
  assert.deepEqual(seen, ["A", "B", "C"]);
  const next = loadStockTrend("E", params, signal);
  await tick();
  assert.equal(seen.at(-1), "E");
  finishes.at(-1).resolve(bars);
  await next;
});
test("cancelled in-flight ranges cannot populate the cache with late results", async () => {
  let finish,
    calls = 0;
  const { loadStockTrend } = fixture(async () => {
    calls++;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const controller = new AbortController();
  const first = loadStockTrend("A", params, controller.signal);
  controller.abort();
  finish(bars);
  await assert.rejects(first, { name: "AbortError" });
  const second = loadStockTrend("A", params, new AbortController().signal);
  await tick();
  finish(bars);
  await second;
  assert.equal(calls, 2);
});

test("empty trends are rejected and a recovered provider is contacted again", async () => {
  let calls = 0;
  const { loadStockTrend } = fixture(async () => (++calls === 1 ? [] : bars));
  const signal = new AbortController().signal;
  await assert.rejects(loadStockTrend("A", params, signal), /Trend unavailable/);
  assert.equal((await loadStockTrend("A", params, signal)).length, 3);
  assert.equal(calls, 2);
});

test("live points compare actual instants across an offset and UTC", () => {
  const { augmentTrendWithQuote } = fixture();
  const points = [{ date: "2026-11-22T23:59:00-05:00", value: 100 }];
  const time = Date.parse("2026-11-23T05:01:00Z") / 1000;
  assert.equal(augmentTrendWithQuote(points, { time, price: 104 }).at(-1).value, 104);
  assert.equal(
    augmentTrendWithQuote(points, {
      time: Date.parse("2026-11-23T04:58:00Z") / 1000,
      price: 90,
    }),
    points,
  );
});

test("one-day and one-week previews keep distinct histories, including bars across midnight", async () => {
  const paramsSeen = [];
  const { loadStockTrend } = fixture(async (symbol, params) => {
    paramsSeen.push(params);
    return [
      { date: "2026-11-20T15:55:00-05:00", close: 100 },
      { date: "2026-11-22T20:05:00-05:00", close: 101 },
      { date: "2026-11-23T00:10:00-05:00", close: 102 },
    ];
  });
  const signal = new AbortController().signal;
  assert.equal((await loadStockTrend("A", params, signal)).length, 3);
  await loadStockTrend("A", { ...params, period: "5d" }, signal);
  assert.deepEqual(
    paramsSeen.map(({ period, prepost }) => [period, prepost]),
    [
      ["1d", "true"],
      ["5d", "true"],
    ],
  );
});

test("one-day previews show the current trading day's extended sessions from the prior close", () => {
  const { trendPoints, currentTradingDay, trendSegments } = fixture();
  const monday = trendPoints(
    [
      { date: "2026-11-19T15:55:00-05:00", close: 95 },
      { date: "2026-11-20T04:00:00-05:00", close: 96 },
      { date: "2026-11-20T15:55:00-05:00", close: 100 },
      { date: "2026-11-20T16:00:00-05:00", close: 101 },
      { date: "2026-11-22T20:00:00-05:00", close: 103, session: "overnight" },
      { date: "2026-11-23T04:00:00-05:00", close: 104 },
      { date: "2026-11-23T07:05:00-05:00", close: 108 },
    ],
    "5m",
  );
  assert.deepEqual(
    Array.from(monday, (point) => point.session),
    ["regular", "pre", "regular", "post", "overnight", "pre", "pre"],
  );
  const day = currentTradingDay(monday);
  // Friday's close anchors Sunday night and Monday pre-market; Friday's own day is dropped.
  assert.deepEqual(
    Array.from(day, (point) => point.value),
    [100, 103, 104, 108],
  );
  assert.deepEqual(
    Array.from(trendSegments(day), (segment) => segment.session),
    ["overnight", "pre"],
  );
  // After 20:00 the overnight session belongs to the next trading day.
  const night = trendPoints(
    [
      { date: "2026-11-23T09:30:00-05:00", close: 100 },
      { date: "2026-11-23T15:55:00-05:00", close: 102 },
      { date: "2026-11-23T16:00:00-05:00", close: 103 },
      { date: "2026-11-23T20:05:00-05:00", close: 104 },
    ],
    "5m",
  );
  assert.deepEqual(
    Array.from(currentTradingDay(night), (point) => point.value),
    [102, 104],
  );
  // Bars on another exchange clock are left as they are, without session styling.
  const tokyo = trendPoints(
    [
      { date: "2026-11-23T09:00:00+09:00", close: 1 },
      { date: "2026-11-23T09:05:00+09:00", close: 2 },
    ],
    "5m",
  );
  assert.equal(currentTradingDay(tokyo), tokyo);
  assert.equal(tokyo[0].session, undefined);
});

test("live extended-hours quotes join the line on the New York clock with their session", () => {
  const { trendPoints, augmentTrendWithQuote, currentTradingDay } = fixture();
  const points = trendPoints(
    [
      { date: "2026-11-20T15:55:00-05:00", close: 100 },
      { date: "2026-11-23T07:00:00-05:00", close: 104 },
    ],
    "5m",
  );
  const live = augmentTrendWithQuote(points, {
    price: 105,
    time: Date.parse("2026-11-23T12:09:00Z") / 1000,
    session: "pre",
  });
  assert.equal(live.at(-1).date, "2026-11-23T07:09:00-05:00");
  assert.equal(live.at(-1).session, "pre");
  assert.deepEqual(
    Array.from(currentTradingDay(live), (point) => point.value),
    [100, 104, 105],
  );
});
