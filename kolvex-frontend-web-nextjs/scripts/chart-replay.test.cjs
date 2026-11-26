const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

function load(name) {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, "..", "lib", "chart", `${name}.ts`), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  vm.runInNewContext(outputText, {
    module,
    exports: module.exports,
    require: (key) => (key === "./graph" ? load("graph") : require(key)),
  });
  return module.exports;
}

const { defaultReplayStart, replayPosition, replayWindow } = load("replay");

test("the suggested start is inside the visible window with room to play", () => {
  assert.equal(defaultReplayStart({ start: 40, end: 60 }, 80), 49);
  assert.equal(defaultReplayStart({ start: 79, end: 95 }, 80), 78);
  assert.equal(defaultReplayStart({ start: -3, end: 2 }, 2), 0);
});

test("seeking clamps the timeline to the loaded bars", () => {
  assert.equal(replayPosition(-3, 30), 0);
  assert.equal(replayPosition(10.8, 30), 10);
  assert.equal(replayPosition(40, 30), 29);
});

test("replay follows the revealed bar and restores the zoom as history becomes available", () => {
  assert.deepEqual({ ...replayWindow(32, 0) }, { start: 0, end: 1 });
  assert.deepEqual({ ...replayWindow(32, 9) }, { start: 0, end: 10 });
  assert.deepEqual({ ...replayWindow(32, 39) }, { start: 8, end: 40 });
  assert.deepEqual({ ...replayWindow(3, 39) }, { start: 32, end: 40 });
});
