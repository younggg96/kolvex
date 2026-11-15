const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const moduleFixture = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync(path.join(__dirname, "../lib/opinionOutcome.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: moduleFixture.exports, Math, Number, String },
);
const { signedPercent, outcomeTone, outcomeRows } = moduleFixture.exports;
const plain = (value) => JSON.parse(JSON.stringify(value));

test("percentages always carry a sign and never show a signed zero", () => {
  assert.equal(signedPercent(3.24), "+3.2%");
  assert.equal(signedPercent(-12.96), "-13.0%");
  assert.equal(signedPercent(0.04), "0.0%");
  assert.equal(signedPercent(-0.04), "0.0%");
  assert.equal(outcomeTone(0.04), "flat");
  assert.equal(outcomeTone(-0.06), "negative");
  assert.equal(outcomeTone(2), "positive");
});

const scored = (ret, bench) => ({
  status: "scored",
  exit_date: "2026-11-09",
  return_pct: ret,
  benchmark_return_pct: bench,
  excess_return_pct: null,
});
const pending = {
  status: "pending",
  exit_date: null,
  return_pct: null,
  benchmark_return_pct: null,
  excess_return_pct: null,
};
const outcome = (horizons, latest) => ({
  status: "scored",
  entry_date: "2026-11-03",
  entry_price: 100,
  horizons,
  latest,
});
const rowsOf = (value, horizons = [5, 20]) => plain(outcomeRows(value, horizons));

test("a young opinion shows only the move so far, never a zero for unfinished periods", () => {
  const young = outcome({ 5: pending, 20: pending }, { sessions: 3, ...scored(-2.14, 0.4) });
  assert.deepEqual(rowsOf(young), [
    { kind: "toDate", days: 3, stock: "-2.1%", tone: "negative", benchmark: "+0.4%" },
  ]);
});

test("finished periods come first, then the move so far while one is still running", () => {
  const week = outcome({ 5: scored(10, 2), 20: pending }, { sessions: 7, ...scored(4, null) });
  assert.deepEqual(rowsOf(week), [
    { kind: "horizon", days: 5, stock: "+10.0%", tone: "positive", benchmark: "+2.0%" },
    { kind: "toDate", days: 7, stock: "+4.0%", tone: "positive", benchmark: null },
  ]);
  // On the exact day a period finishes, the two rows would be the same number.
  const exact = outcome({ 5: scored(10, 2), 20: pending }, { sessions: 5, ...scored(10, 2) });
  assert.equal(rowsOf(exact).length, 1);
});

test("once every period is finished there is no so-far row", () => {
  const old = outcome(
    { 5: scored(10, 2), 20: scored(-4.5, null) },
    { sessions: 40, ...scored(30, 5) },
  );
  assert.deepEqual(
    rowsOf(old).map((item) => [item.kind, item.days, item.stock, item.benchmark]),
    [
      ["horizon", 5, "+10.0%", "+2.0%"],
      ["horizon", 20, "-4.5%", null],
    ],
  );
});

test("unscored outcomes and missing figures produce no rows", () => {
  for (const status of ["pending", "no_price_data", "no_publish_time"]) {
    const empty = { status, entry_date: null, entry_price: null, horizons: {}, latest: null };
    assert.deepEqual(rowsOf(empty), []);
  }
  assert.deepEqual(rowsOf(outcome({ 5: pending, 20: pending }, null)), []);
});

test("both locales carry every outcome string", () => {
  const keys = [
    "outcomeLabel",
    "outcomeDays",
    "outcomeBenchmark",
    "outcomeToDate",
    "outcomeNotStarted",
    "outcomeNoPrices",
    "outcomeNoPublishTime",
    "outcomeUnavailable",
    "outcomeHowLabel",
    "outcomeHow",
  ];
  for (const locale of ["zh", "en"]) {
    const copy = JSON.parse(
      fs.readFileSync(path.join(__dirname, `../lib/i18n/locales/${locale}.json`), "utf8"),
    ).youtubeOpinions;
    for (const key of keys) assert.ok(copy[key], `${locale}.${key}`);
    assert.ok(!/right call|说对|准确率|胜率/.test(keys.map((key) => copy[key]).join(" ")));
  }
});
