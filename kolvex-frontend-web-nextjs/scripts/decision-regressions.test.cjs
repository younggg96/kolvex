const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const file = path.join(__dirname, "../lib/decision.ts");
const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const compiled = new Module(file, module);
compiled._compile(source, file);
const { validateThesis, thesisChanges, riskReward, creatorEvidence, latestCreatorOpinions } =
  compiled.exports;
const draft = {
  ticker: "NVDA",
  direction: "bullish",
  reasoning: "Demand remains strong",
  entry_low: 185,
  entry_high: 188,
  invalidation: 179,
  target: 205,
  horizon: "1–3 months",
  status: "active",
  review: "",
  evidence: { technical: "bullish", creators: "bullish" },
};
const thesis = {
  ...draft,
  id: "version-id",
  thesis_id: "thesis-id",
  version: 1,
  created_at: "2026-10-01",
};

test("valid plans have real directional risk/reward", () => {
  assert.equal(validateThesis(draft).ticker, "NVDA");
  assert.equal(riskReward(draft), 18.5 / 7.5);
  assert.equal(riskReward({ ...draft, direction: "neutral" }), null);
  assert.equal(
    riskReward({
      ...draft,
      direction: "bearish",
      invalidation: 200,
      target: 160,
    }),
    26.5 / 13.5,
  );
});
test("rejects invalid price geometry, missing reasons and non-finite values", () => {
  for (const patch of [
    { entry_low: 200, entry_high: 185 },
    { invalidation: 186 },
    { target: 187 },
    { reasoning: " " },
    { target: Infinity },
    { ticker: "../NVDA" },
    { entry_low: null, entry_high: 188 },
  ]) {
    assert.throws(() => validateThesis({ ...draft, ...patch }));
  }
});
test("partial reasoning-only theses are allowed", () => {
  assert.equal(
    validateThesis({
      ...draft,
      entry_low: null,
      entry_high: null,
      target: null,
      invalidation: null,
    }).entry_low,
    null,
  );
});
test("missing evidence and closed theses never produce false changes", () => {
  assert.deepEqual(thesisChanges(thesis, null, {}), []);
  assert.deepEqual(thesisChanges(thesis, 0, { creators: null }), []);
  assert.deepEqual(
    thesisChanges({ ...thesis, status: "closed" }, 170, {
      creators: "bearish",
    }),
    [],
  );
});
test("long and short threshold directions are distinct; equality counts", () => {
  assert.deepEqual(thesisChanges(thesis, 179), ["invalidation"]);
  assert.deepEqual(thesisChanges(thesis, 205), ["target"]);
  const short = {
    ...thesis,
    direction: "bearish",
    invalidation: 200,
    target: 160,
  };
  assert.deepEqual(thesisChanges(short, 200), ["invalidation"]);
  assert.deepEqual(thesisChanges(short, 160), ["target"]);
  assert.deepEqual(
    thesisChanges(thesis, 190, { creators: "neutral", technical: "bearish" }),
    ["technical", "creators"],
  );
});
test("creator alignment uses only the latest call per creator inside 30 days", () => {
  const now = Date.parse("2026-10-08T12:00:00Z");
  const call = (channel_id, sentiment, opinion_date) => ({
    channel_id,
    sentiment,
    opinion_date,
  });
  const evidence = creatorEvidence(
    [
      call("A", "bullish", "2026-10-01"),
      call("A", "bearish", "2026-10-07"),
      call("B", "bullish", "2026-10-06"),
      call("C", "bullish", "2026-01-01"),
      call("D", "bullish", "2027-01-01"),
      call("E", "bullish", "invalid"),
    ],
    now,
  );
  assert.deepEqual(evidence, {
    direction: "neutral",
    bullish: 1,
    bearish: 1,
    neutral: 0,
    count: 2,
  });
  assert.equal(creatorEvidence([], now).direction, null);
});


test("creator cards use exactly the latest-per-creator set counted in the 30-day split", () => {
  const now = Date.parse("2026-10-09T12:00:00Z");
  const opinion = (id, channel_id, sentiment, opinion_date) => ({ id, channel_id, sentiment, opinion_date });
  const input = [
    opinion("old-a", "A", "bullish", "2026-10-01"),
    opinion("latest-a", "A", "bearish", "2026-10-08"),
    opinion("mixed-b", "B", "mixed", "2026-10-07"),
    opinion("neutral-c", "C", "neutral", "2026-10-06"),
    opinion("bullish-d", "D", "bullish", "2026-10-05"),
    opinion("stale-e", "E", "bearish", "2026-09-01"),
    opinion("future-f", "F", "bullish", "2026-10-11"),
    opinion("invalid-g", "G", "neutral", "invalid"),
  ];
  const snapshot = input.slice();
  const latest = latestCreatorOpinions(input, now);
  assert.deepEqual(latest.map((item) => item.id), ["latest-a", "mixed-b", "neutral-c", "bullish-d"]);
  const evidence = creatorEvidence(input, now);
  assert.equal(latest.filter((item) => item.sentiment === "bullish").length, evidence.bullish);
  assert.equal(latest.filter((item) => item.sentiment === "bearish").length, evidence.bearish);
  assert.equal(latest.filter((item) => ["neutral", "mixed"].includes(item.sentiment)).length, evidence.neutral);
  assert.equal(latest.length, evidence.count);
  assert.deepEqual(input, snapshot);
});
