const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(file, requires = {}) {
  const fixture = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    { exports: fixture.exports, require: (name) => requires[name], Math, Number, String },
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
  assert.deepEqual({ ...review.reviewFigure(-6.92) }, { text: "-6.9%", tone: "negative" });
  assert.deepEqual({ ...review.reviewFigure(4.95) }, { text: "+5.0%", tone: "positive" });
  assert.deepEqual({ ...review.reviewFigure(0.02) }, { text: "0.0%", tone: "flat" });
});

test("histogram labels cover open-ended bins and heights scale to the tallest bin", () => {
  assert.equal(review.binLabel({ low: null, high: -20, count: 3 }, t), "低于 -20%");
  assert.equal(review.binLabel({ low: 20, high: null, count: 3 }, t), "20% 以上");
  assert.equal(review.binLabel({ low: -5, high: 0, count: 3 }, t), "-5% 到 0%");
  assert.deepEqual(
    [...review.histogramHeights([{ count: 2 }, { count: 4 }, { count: 0 }])],
    [0.5, 1, 0],
  );
  assert.deepEqual([...review.histogramHeights([{ count: 0 }, { count: 0 }])], [0, 0]);
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
