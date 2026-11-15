const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const { FORMAT, format } = require("./helpers/format.cjs");

function load(file, requires = {}) {
  const fixture = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    {
      exports: fixture.exports,
      require: (name) => (name === FORMAT ? format : requires[name]),
      Math,
      Number,
      String,
      URLSearchParams,
    },
  );
  return fixture.exports;
}

const outcome = load("lib/opinionOutcome.ts");
const review = load("lib/opinionReview.ts", { "./opinionOutcome": outcome });
const zh = require("../lib/i18n/locales/zh.json");
const en = require("../lib/i18n/locales/en.json");
const translator =
  (dictionary) =>
  (key, params = {}) => {
    const value = key.split(".").reduce((node, part) => node?.[part], dictionary);
    return Object.entries(params).reduce(
      (text, [name, v]) => text.replaceAll(`{${name}}`, v),
      value ?? key,
    );
  };
const t = translator(zh);

test("figures carry a sign and a tone, so direction never depends on color", () => {
  assert.deepEqual({ ...review.reviewFigure(-6.92) }, { text: "−6.9%", tone: "negative" });
  assert.deepEqual({ ...review.reviewFigure(4.95) }, { text: "+5.0%", tone: "positive" });
  assert.deepEqual({ ...review.reviewFigure(0.02) }, { text: "0.0%", tone: "flat" });
});

test("histogram labels are signed excess-return bands, and heights scale to the tallest bin", () => {
  assert.equal(review.binLabel({ low: null, high: -20, count: 3 }, t), "< -20%");
  assert.equal(review.binLabel({ low: -20, high: -15, count: 3 }, t), "-20% ~ -15%");
  assert.equal(review.binLabel({ low: -5, high: 0, count: 3 }, t), "-5% ~ 0%");
  assert.equal(review.binLabel({ low: 0, high: 5, count: 3 }, t), "0% ~ +5%");
  assert.equal(review.binLabel({ low: 20, high: null, count: 3 }, t), "≥ +20%");
  assert.equal(review.binLabel({ low: -20, high: -15, count: 3 }, translator(en)), "-20% to -15%");
  assert.deepEqual(
    [...review.histogramHeights([{ count: 2 }, { count: 4 }, { count: 0 }])],
    [0.5, 1, 0],
  );
  assert.deepEqual([...review.histogramHeights([{ count: 0 }, { count: 0 }])], [0, 0]);
});

test("helpers: holding period, direction, beat count and the zero line", () => {
  assert.equal(review.horizonLabel(5, t), "5 日");
  assert.equal(review.horizonLabel(20, t), "20 日");
  assert.equal(review.horizonLabel(60, t), "60 个交易日");
  assert.equal(review.relativeDirection(-6.92), "less");
  assert.equal(review.relativeDirection(0.04), "same");
  assert.equal(review.relativeDirection(1.25), "more");
  assert.equal(review.magnitude(-6.92), "6.9%");
  assert.equal(review.beatCount({ n: 284, beat_count: 93, beat_share_pct: 32.7 }), 93);
  assert.equal(review.beatCount({ n: 284, beat_share_pct: 32.7 }), 93);
  assert.equal(review.beatCount({ n: 12, enough: false }), null);
  const edges = [null, -20, -15, -10, -5, 0, 5, 10, 15, 20, null];
  const bins = edges.slice(0, -1).map((low, i) => ({ low, high: edges[i + 1], count: 1 }));
  assert.equal(review.zeroPosition(bins), 0.5);
});

test("a call on the benchmark itself is read by direction, not excess return", () => {
  assert.equal(review.callDirection("bullish", 1.7), "match");
  assert.equal(review.callDirection("bullish", -0.6), "against");
  assert.equal(review.callDirection("bearish", -2.3), "match");
  assert.equal(review.callDirection("bearish", 0.9), "against");
  assert.equal(review.callDirection("bearish", 0.03), "flat");
});

test("segment labels show confidence as a percent and keep unknown separate", () => {
  assert.equal(review.segmentLabel({ low: 0.7, high: 0.85 }, "confidence", t), "70%–85%");
  assert.equal(review.segmentLabel({ low: 0.85, high: null }, "confidence", t), "85% 及以上");
  assert.equal(review.segmentLabel({ low: null, high: 30 }, "strength", t), "低于 30");
  assert.equal(
    review.segmentLabel({ low: null, high: null, unknown: true }, "strength", t),
    "未标注",
  );
});

test("benchmark line and change need at least two points and never invent a zero", () => {
  assert.equal(review.benchmarkPath([{ close: 1 }], 100, 26), "");
  assert.equal(review.benchmarkChange([{ close: 1 }]), null);
  assert.equal(review.benchmarkPath([{ close: 10 }, { close: 20 }], 100, 26), "0.0,26.0 100.0,0.0");
  assert.equal(Math.round(review.benchmarkChange([{ close: 500 }, { close: 450 }]) * 10) / 10, -10);
});

test("every review string exists in both languages with the same placeholders", () => {
  const zhKeys = zh.youtubeOpinions.review;
  const enKeys = en.youtubeOpinions.review;
  assert.deepEqual(Object.keys(zhKeys).sort(), Object.keys(enKeys).sort());
  // The same placeholders, each at least once (a language may repeat one).
  const holes = (text) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
  for (const key of Object.keys(zhKeys))
    assert.deepEqual(holes(zhKeys[key]), holes(enKeys[key]), key);
});

test("the copy states facts, never a verdict on creators", () => {
  const text = JSON.stringify([zh.youtubeOpinions.review, en.youtubeOpinions.review]);
  assert.doesNotMatch(text, /准确率|胜率|靠谱|说对|accuracy|win rate|right call/i);
});

test("a bar's opinion query keeps both edges and leaves open-ended ones out", () => {
  assert.equal(
    review.binQuery(20, "bullish", { low: -5, high: 0, count: 3 }),
    "horizon=20&sentiment=bullish&low=-5&high=0",
  );
  assert.equal(
    review.binQuery(5, "bearish", { low: null, high: -20, count: 1 }),
    "horizon=5&sentiment=bearish&high=-20",
  );
  assert.equal(
    review.binQuery(5, "bearish", { low: 20, high: null, count: 1 }),
    "horizon=5&sentiment=bearish&low=20",
  );
});

test("the creator view is read from and written to the query string", () => {
  assert.deepEqual({ ...review.readReviewRoute("") }, { view: "all", creator: null });
  assert.deepEqual(
    { ...review.readReviewRoute("?view=creators&creator=UC1") },
    { view: "creators", creator: "UC1" },
  );
  // A creator link alone opens the creator view; an unknown view falls back to all.
  assert.deepEqual(
    { ...review.readReviewRoute("?creator=UC1") },
    { view: "creators", creator: "UC1" },
  );
  assert.deepEqual({ ...review.readReviewRoute("?view=other") }, { view: "all", creator: null });
  assert.equal(review.reviewRouteSearch("all", "UC1"), "");
  assert.equal(review.reviewRouteSearch("creators", null), "?view=creators");
  assert.equal(review.reviewRouteSearch("creators", "UC1"), "?view=creators&creator=UC1");
});
