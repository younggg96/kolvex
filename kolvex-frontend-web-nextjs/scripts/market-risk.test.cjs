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

const risk = compile("lib/marketRisk.ts");
const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("missing values stay missing, never zero", () => {
  assert.equal(risk.formatMetric(null, "index_points"), "—");
  assert.equal(risk.formatMetric(26.6234, "index_points"), "26.62");
  assert.equal(risk.formatMetric(1.043922, "ratio"), "1.044");
  assert.equal(risk.metricChange({ value: 20, previous_value: null }), null);
  assert.equal(risk.metricChange({ value: 20, previous_value: 25 }), -5);
});

test("term structure shape", () => {
  assert.equal(risk.termStructureShape(26.6, 25.5), "backwardation");
  assert.equal(risk.termStructureShape(15, 17), "contango");
  assert.equal(risk.termStructureShape(null, 17), null);
});

test("stage spans merge consecutive sessions", () => {
  const spans = risk.stageSpans([
    { date: "2026-11-02", stage: "stable" },
    { date: "2026-11-03", stage: "stable" },
    { date: "2026-11-04", stage: "stress_acceleration" },
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(spans)), [
    { stage: "stable", start: "2026-11-02", end: "2026-11-03" },
    { stage: "stress_acceleration", start: "2026-11-04", end: "2026-11-04" },
  ]);
});

test("every level and stage has a tone", () => {
  for (const level of ["low", "moderate", "elevated", "high", "extreme"])
    assert.ok(risk.levelTone(level));
  assert.deepEqual(
    [...risk.STAGE_ORDER.map((s) => risk.stageTone(s))],
    ["positive", "warning", "negative", "muted"],
  );
});

test("feature is experimental, routed under the dashboard and in the nav", () => {
  const features = read("lib/productFeatures.ts");
  assert.match(
    features,
    /id: "marketRisk",[\s\S]*?experimental: true,[\s\S]*?"\/dashboard\/market-risk"/,
  );
  assert.match(read("components/layout/navItems.ts"), /featureId: "marketRisk"/);
  // Alerts stay retired: the page links to no alert or notification route.
  assert.doesNotMatch(
    read("components/market-risk/MarketRiskView.tsx"),
    /\/dashboard\/(alerts|notifications)/,
  );
});

test("view uses tokens, not hard-coded colours", () => {
  assert.doesNotMatch(read("components/market-risk/MarketRiskView.tsx"), /#[0-9a-fA-F]{3,6}\b/);
});
