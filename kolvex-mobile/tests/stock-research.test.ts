import assert from "node:assert/strict";
import { test } from "node:test";
import {
  earningsRows,
  financialNumber,
  epsOutcome,
  financialChange,
  sortPeriods,
  statementCSV,
  statementKeys,
} from "../src/lib/stockResearch";
test("financial growth preserves zero and rejects negative or zero comparison baselines", () => {
  assert.deepEqual(financialChange(0, 100), { absolute: -100, relative: -1 });
  assert.deepEqual(financialChange(10, 0), { absolute: 10, relative: null });
  assert.deepEqual(financialChange(-5, -10), { absolute: 5, relative: null });
  assert.equal(financialChange(null, 10), null);
});
test("reported EPS outcomes handle losses and floating point equality", () => {
  assert.deepEqual(epsOutcome(-0.1, -0.4), { kind: "beat", delta: 0.3 });
  assert.deepEqual(epsOutcome(0, 0), { kind: "met", delta: 0 });
  assert.deepEqual(epsOutcome(0.1 + 0.2, 0.3), { kind: "met", delta: 0 });
  assert.equal(epsOutcome(null, 1), null);
});
test("earnings source fractions and percentage points use the same display unit", () => {
  const source = {
    earnings_history: [
      {
        quarter: "2025-12-31",
        eps_actual: 1.1,
        eps_estimate: 1,
        surprise_percent: 0.1,
      },
    ],
    earnings_dates: [
      {
        date: "2026-12-31",
        reported_eps: null,
        eps_estimate: 1.2,
        surprise_percent: null,
      },
    ],
  };
  const rows = earningsRows(source);
  assert.equal(rows[0].surprise, 10);
  assert.equal(rows[1].actual, null);
  const dated = earningsRows({
    ...source,
    earnings_dates: [
      {
        date: "2026-01-30",
        reported_eps: 1.1,
        eps_estimate: 1,
        surprise_percent: 10,
      },
    ],
  });
  assert.equal(dated.length, 1);
  assert.equal(dated[0].surprise, 10);
});
test("statement periods are ordered without mutating input and malformed periods are removed", () => {
  const input = [
    { period: "2024-12-31", "Net Income": 0 },
    { period: "invalid", "Net Income": 99 },
    { period: "2025-12-31", "Net Income": 5 },
  ];
  const rows = sortPeriods(input);
  assert.deepEqual(
    rows.map((row) => row.period),
    ["2025-12-31", "2024-12-31"],
  );
  assert.equal(input[0].period, "2024-12-31");
  assert.deepEqual(statementKeys(rows, "income-statement"), ["Net Income"]);
});
test("CSV exports distinguish missing values from zero and neutralize formula labels", () => {
  const csv = statementCSV(
    [
      {
        period: "2025-12-31",
        Revenue: 0,
        Missing: null,
        '=WEBSERVICE("evil")': 3,
      },
    ],
    ["Revenue", "Missing", '=WEBSERVICE("evil")'],
  );
  assert.ok(csv.includes('"Revenue","0"'));
  assert.ok(csv.includes('"Missing",""'));
  assert.ok(csv.includes('"\'=WEBSERVICE(""evil"")","3"'));
});

test("financial display uses compact units without turning missing values into zero", () => {
  assert.equal(financialNumber(416161000000), "416.16B");
  assert.equal(financialNumber(-1200000), "-1.20M");
  assert.equal(financialNumber(0), "0.00");
  assert.equal(financialNumber(null), "—");
});
