const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function compile(file) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(output, { module, exports: module.exports, require, console });
  return module.exports;
}

const settings = compile("lib/chart/settings.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));

test("stored settings are validated field by field", () => {
  assert.deepEqual(
    plain(settings.parseChartSettings(null)),
    plain(settings.DEFAULT_CHART_SETTINGS),
  );
  const parsed = settings.parseChartSettings({
    zoomAnchor: "right",
    crosshairSnap: "bogus",
    extendedHours: true,
    candles: { body: { enabled: false, up: "#ff0000", down: "compare-2" } },
  });
  assert.equal(parsed.zoomAnchor, "right");
  assert.equal(parsed.crosshairSnap, "off");
  assert.equal(parsed.extendedHours, true);
  assert.equal(parsed.highlightSession, true);
  assert.deepEqual(plain(parsed.candles.body), {
    enabled: false,
    up: "chart-up",
    down: "compare-2",
  });
  assert.deepEqual(plain(parsed.candles.wick), plain(settings.DEFAULT_CHART_SETTINGS.candles.wick));
});

test("intraday bars are classified by exchange-local session", () => {
  assert.equal(settings.barSession("2026-11-18T04:00:00-05:00", "5m"), "pre");
  assert.equal(settings.barSession("2026-11-18T09:25:00-05:00", "5m"), "pre");
  assert.equal(settings.barSession("2026-11-18T09:30:00-05:00", "5m"), "regular");
  assert.equal(settings.barSession("2026-11-18T09:00:00-05:00", "1h"), "regular");
  assert.equal(settings.barSession("2026-11-18T15:55:00-05:00", "5m"), "regular");
  assert.equal(settings.barSession("2026-11-18T16:00:00-05:00", "15m"), "post");
  assert.equal(settings.barSession("2026-11-18", "1d"), "regular");
});

test("extended runs group contiguous bars of the same session", () => {
  const dates = ["08:00", "09:00", "09:30", "15:30", "16:00", "17:00"].map(
    (time) => `2026-11-18T${time}:00-05:00`,
  );
  // 1h bars: 08:00 is pre, 09:00 overlaps the open, 16:00 and 17:00 are after-hours.
  assert.deepEqual(plain(settings.extendedRuns(dates, "1h", 0, 5)), [
    { start: 0, end: 0, session: "pre" },
    { start: 4, end: 5, session: "post" },
  ]);
  assert.deepEqual(plain(settings.extendedRuns(dates, "1h", -3, 99)).length, 2);
});

test("candle paint keeps every candle visible when parts are switched off", () => {
  const base = settings.DEFAULT_CHART_SETTINGS;
  assert.deepEqual(plain(settings.candlePaint(base, true)), {
    fill: "rgb(var(--chart-up))",
    stroke: "rgb(var(--chart-up))",
    wick: "rgb(var(--chart-up))",
  });
  const hollow = {
    ...base,
    candles: { ...base.candles, body: { ...base.candles.body, enabled: false } },
  };
  assert.equal(settings.candlePaint(hollow, false).fill, "none");
  assert.equal(settings.candlePaint(hollow, false).stroke, "rgb(var(--chart-down))");
  const bare = {
    ...base,
    candles: {
      body: { ...base.candles.body, enabled: false },
      border: { ...base.candles.border, enabled: false },
      wick: { ...base.candles.wick, enabled: false },
    },
  };
  const paint = settings.candlePaint(bare, true);
  assert.equal(paint.fill, "none");
  assert.equal(paint.stroke, "rgb(var(--muted-foreground))");
  assert.equal(paint.wick, "rgb(var(--muted-foreground))");
});

test("crosshair snaps to the close or the nearest OHLC price", () => {
  const bar = { open: 10, high: 14, low: 8, close: 12 };
  const yOf = (price) => 100 - price * 5;
  assert.equal(settings.snapCrosshair("off", bar, 40, yOf), null);
  assert.equal(settings.snapCrosshair("close", bar, 40, yOf), 12);
  assert.equal(settings.snapCrosshair("ohlc", bar, yOf(13.9), yOf), 14);
  assert.equal(settings.snapCrosshair("ohlc", bar, yOf(8.4), yOf), 8);
});
