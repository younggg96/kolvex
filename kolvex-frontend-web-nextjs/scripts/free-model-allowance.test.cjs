const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

// lib/aiModels.ts decides which models the chat picker offers: own-key providers plus the free model.
function load() {
  const source = fs.readFileSync(path.join(__dirname, "..", "lib/aiModels.ts"), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const module = { exports: {} };
  new Function("module", "exports", "require", output)(module, module.exports, require);
  return module.exports;
}

const { MODEL_CONFIGS, isModelUsable, getFirstAvailableModelId } = load();
const model = (id) => MODEL_CONFIGS.find((m) => m.id === id);

test("without own keys only the free model is usable", () => {
  assert.equal(isModelUsable(model("deepseek-flash"), [], ["deepseek-flash"]), true);
  assert.equal(isModelUsable(model("deepseek-v4-pro"), [], ["deepseek-flash"]), false);
  assert.equal(isModelUsable(model("claude-opus-5-5"), [], ["deepseek-flash"]), false);
});

test("an own key unlocks every model of that provider", () => {
  assert.equal(isModelUsable(model("claude-opus-5-5"), ["anthropic"]), true);
  assert.equal(isModelUsable(model("deepseek-v4-pro"), ["deepseek"]), true);
});

test("a spent allowance (no free models) leaves nothing to pick", () => {
  assert.equal(getFirstAvailableModelId([], []), null);
  assert.equal(getFirstAvailableModelId(undefined, []), null);
});

test("default selection prefers a model on the user's own key over the free one", () => {
  assert.equal(getFirstAvailableModelId([], ["deepseek-flash"]), "deepseek-flash");
  assert.equal(getFirstAvailableModelId(["openai"], ["deepseek-flash"]), "gpt-6-astra");
});
