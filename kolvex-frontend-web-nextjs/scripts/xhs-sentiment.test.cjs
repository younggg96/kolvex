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
  vm.runInNewContext(output, { module, exports: module.exports, require, console, Intl, Date });
  return module.exports;
}

const lib = compile("lib/xhsSentiment.ts");
const counts = (fear_panic, bearish, neutral, mixed_cautious_buy, bullish) => ({
  fear_panic,
  bearish,
  neutral,
  mixed_cautious_buy,
  bullish,
});

test("shares are whole percents that add up to 100", () => {
  const shares = lib.stanceShares(counts(21, 94, 48, 14, 9));
  assert.equal(
    Object.values(shares).reduce((a, b) => a + b, 0),
    100,
  );
  assert.deepEqual(
    { ...shares },
    { fear_panic: 11, bearish: 51, neutral: 26, mixed_cautious_buy: 7, bullish: 5 },
  );
  assert.equal(
    Object.values(lib.stanceShares(counts(0, 0, 0, 0, 0))).reduce((a, b) => a + b, 0),
    0,
  );
  const thirds = lib.stanceShares(counts(1, 1, 1, 0, 0));
  assert.equal(thirds.fear_panic + thirds.bearish + thirds.neutral, 100);
});

test("dominant stance is the single largest band, never a tie or an empty day", () => {
  assert.equal(lib.dominantStance(counts(21, 94, 48, 14, 9)), "bearish");
  assert.equal(lib.dominantStance(counts(5, 5, 1, 0, 0)), null);
  assert.equal(lib.dominantStance(counts(0, 0, 0, 0, 0)), null);
  assert.equal(lib.negativeCount(counts(21, 94, 48, 14, 9)), 115);
});

test("neighbours walk a newest-first list of days", () => {
  const days = ["2026-11-20", "2026-11-19", "2026-11-17"].map((date_pt) => ({ date_pt }));
  assert.deepEqual({ ...lib.neighbours(days, "2026-11-20") }, { older: "2026-11-19", newer: null });
  assert.deepEqual(
    { ...lib.neighbours(days, "2026-11-19") },
    { older: "2026-11-17", newer: "2026-11-20" },
  );
  assert.deepEqual({ ...lib.neighbours(days, "2026-11-17") }, { older: null, newer: "2026-11-19" });
  assert.deepEqual({ ...lib.neighbours(days, "2026-01-01") }, { older: null, newer: null });
});

test("only plain ISO dates reach the per-day API path", () => {
  assert.equal(lib.isIsoDate("2026-11-20"), true);
  assert.equal(lib.isIsoDate("../admin"), false);
  assert.equal(lib.isIsoDate(null), false);
  assert.equal(lib.xhsDayPath("2026-11-20"), "/api/xhs-sentiment/2026-11-20");
});

test("stance labels are bilingual for every band", () => {
  for (const { key } of lib.XHS_STANCES) {
    assert.ok(lib.stanceLabel(key, "zh"));
    assert.ok(lib.stanceLabel(key, "en"));
    assert.notEqual(lib.stanceLabel(key, "zh"), lib.stanceLabel(key, "en"));
  }
});

test("the Pacific date rolls over at midnight Los Angeles time, not UTC", () => {
  assert.equal(lib.todayPt(new Date("2026-11-21T03:00:00Z")), "2026-11-20");
  assert.equal(lib.todayPt(new Date("2026-11-21T09:00:00Z")), "2026-11-21");
});

test("the collection prompt names every field the importer requires, in both languages", () => {
  const fields = [
    "schema_version",
    "xhs-daily.v2",
    "date_pt",
    "captured_at",
    "sample",
    "keywords",
    "posts_scanned",
    "posts_by_keyword",
    "deep_read_posts",
    "comments_read",
    "classified_by",
    "latest_window_hours",
    "sentiment",
    "topics",
    "id",
    "title",
    "summary",
    "stance",
    "tickers",
    "heat",
    "posts",
    "comments",
    "excerpts",
    "likes",
    "sources",
    "note_id",
    "url",
    "author_nickname",
    "published_at",
    "published_raw",
    "rumors",
    "status",
    "unverified",
    "debunked",
    "limitations",
    ...lib.XHS_STANCES.map(({ key }) => key),
  ];
  for (const locale of ["zh", "en"]) {
    const prompt = lib.buildXhsCollectionPrompt(locale, "2026-11-20");
    for (const field of fields)
      assert.ok(prompt.includes(field), `${locale} prompt lacks ${field}`);
    assert.ok(prompt.includes('"date_pt": "2026-11-20"'));
    assert.ok(prompt.includes("https://www.xiaohongshu.com/"));
    // Fields the importer rejects must not appear as keys in the structure.
    assert.doesNotMatch(prompt, /"(score|negative_share_pct|label|author|location)":/);
  }
  assert.match(lib.buildXhsCollectionPrompt("zh-CN", "2026-11-20"), /^你在帮我整理/);
  assert.match(lib.buildXhsCollectionPrompt("en", "2026-11-20"), /^You are compiling/);
});
