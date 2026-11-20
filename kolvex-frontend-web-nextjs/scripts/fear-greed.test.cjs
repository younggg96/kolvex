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
  vm.runInNewContext(output, { module, exports: module.exports, require, console, Date });
  return module.exports;
}

const { lastMonth } = compile("lib/fearGreed.ts");
const point = (date) => ({ date, score: 50, rating: null });
const dates = (rows) => rows.map((row) => row.date);

test("keeps observations from the month ending on the latest date", () => {
  const rows = ["2026-09-30", "2026-10-19", "2026-10-20", "2026-11-03", "2026-11-20"].map(point);
  assert.deepEqual(dates(lastMonth(rows)), ["2026-10-20", "2026-11-03", "2026-11-20"]);
});

test("clamps to the end of a shorter previous month", () => {
  const rows = ["2026-02-27", "2026-02-28", "2026-03-15", "2026-03-31"].map(point);
  assert.deepEqual(dates(lastMonth(rows)), ["2026-02-28", "2026-03-15", "2026-03-31"]);
});

test("crosses the year boundary", () => {
  const rows = ["2025-12-14", "2025-12-15", "2026-01-15"].map(point);
  assert.deepEqual(dates(lastMonth(rows)), ["2025-12-15", "2026-01-15"]);
});

test("returns an empty list without observations", () => {
  assert.equal(lastMonth([]).length, 0);
});
