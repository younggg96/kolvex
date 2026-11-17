const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync(path.join(__dirname, "../lib/contentLanguage.ts"), "utf8");
const helpers = {};
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText,
  { exports: helpers },
);

test("saved technical snapshots can identify Chinese or English prose without request metadata", () => {
  assert.equal(helpers.savedAnalysisLanguage("AMD 已跌破支撑位"), "zh");
  assert.equal(helpers.savedAnalysisLanguage("AMD broke support."), "en");
  assert.equal(helpers.savedAnalysisLanguage("402.1"), undefined);
  assert.equal(helpers.savedAnalysisLanguage("402.1", "zh"), "zh");
});

test("localizes supported time horizons while preserving custom source text", () => {
  const t = (key) => ({ "youtubeOpinions.horizons.short": "Short term" })[key];
  assert.equal(helpers.opinionHorizonLabel("短期", t), "Short term");
  assert.equal(helpers.opinionHorizonLabel("3–6 个月，财报后再看", t), "3–6 个月，财报后再看");
});
