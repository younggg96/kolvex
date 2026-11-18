const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load() {
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, "../lib/portfolioManualImport.ts"), "utf8");
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    { module, exports: module.exports },
  );
  return module.exports;
}

const lib = load();
const codes = (result) => [...result.issues].map((issue) => issue.code);

test("accepts fenced JSON with prose around it and normalizes values", () => {
  const reply = [
    "Here you go:",
    "```json",
    JSON.stringify({
      as_of: "2026-11-18",
      accounts: [
        {
          name: "Schwab",
          positions: [
            { symbol: "nvda", quantity: "1,200", average_cost: "$98.50" },
            {
              symbol: "AAPL call",
              type: "option",
              underlying: "aapl",
              option_type: "C",
              strike: 250,
              expiration: "2027-01-15",
              quantity: 2,
              price: 14.1,
            },
          ],
        },
      ],
      notes: ["Skipped a blurry row"],
    }),
    "```",
  ].join("\n");
  const result = lib.parseManualImport(reply);
  assert.equal(result.ok, true);
  const [nvda, call] = result.payload.accounts[0].positions;
  assert.deepEqual(
    {
      symbol: nvda.symbol,
      quantity: nvda.quantity,
      cost: nvda.average_cost,
      currency: nvda.currency,
    },
    { symbol: "NVDA", quantity: 1200, cost: 98.5, currency: "USD" },
  );
  assert.equal(nvda.price, undefined);
  assert.equal(call.option_type, "call");
  assert.equal(call.underlying, "AAPL");
  assert.deepEqual([...result.notes], ["Skipped a blurry row"]);

  const summary = lib.summarizeManualImport(result.payload);
  assert.equal(summary.positions, 2);
  assert.equal(summary.options, 1);
  assert.equal(summary.withoutPrice, 1);
});

test("reports invalid JSON and structural problems", () => {
  assert.deepEqual(codes(lib.parseManualImport("not json")), ["invalidJson"]);
  assert.deepEqual(codes(lib.parseManualImport("{}")), ["noAccounts"]);
  const result = lib.parseManualImport(
    JSON.stringify({
      accounts: [
        {
          name: "A",
          positions: [
            { symbol: "NVDA", quantity: 0 },
            { symbol: "$$", quantity: 1 },
          ],
        },
        { name: "a", positions: [] },
        {
          name: "B",
          positions: [
            { symbol: "TSLA", quantity: 1 },
            { symbol: "tsla", quantity: 2 },
            { symbol: "X", type: "option", quantity: 1 },
          ],
        },
      ],
    }),
  );
  assert.equal(result.ok, false);
  assert.deepEqual(codes(result), [
    "quantity",
    "symbol",
    "duplicateAccount",
    "noPositions",
    "duplicatePosition",
    "optionFields",
  ]);
});

test("option contract symbol matches the backend storage key", () => {
  assert.equal(lib.optionContractSymbol("AAPL", "2027-01-15", "call", 250), "AAPL270115C00250000");
  assert.equal(lib.optionContractSymbol("SPY", "2026-12-19", "put", 512.5), "SPY261219P00512500");
});

test("prompt follows the locale and tells the assistant not to invent numbers", () => {
  assert.match(lib.buildManualImportPrompt("zh"), /不要编造/);
  assert.match(lib.buildManualImportPrompt("en"), /Do not invent/);
  // The example inside the prompt must itself import cleanly.
  const example = lib
    .buildManualImportPrompt("en")
    .match(/(\{\n  "kolvex_portfolio_import"[\s\S]*?\n\})/)[1];
  assert.equal(lib.parseManualImport(example).ok, true);
});
