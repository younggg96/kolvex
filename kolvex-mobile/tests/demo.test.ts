import assert from "node:assert/strict";
import { test } from "node:test";
import { isSymbol, number, percent } from "../src/lib/models";

delete process.env.EXPO_PUBLIC_API_URL;
test("demo mode is explicit and supplies no fabricated creator opinions", async () => {
  const { demoMode, opinions, quote } = await import("../src/lib/api");
  const signal = new AbortController().signal;
  assert.equal(demoMode, true);
  assert.deepEqual(await opinions(signal), { latest: [] });
  assert.equal((await quote("NVDA", signal)).symbol, "NVDA");
  await assert.rejects(quote("UNKNOWN", signal), /演示数据中没有/);
});
test("symbols reject URL paths and missing values stay unavailable", () => {
  assert.equal(isSymbol("BRK-B"), true);
  assert.equal(isSymbol("^GSPC"), true);
  assert.equal(isSymbol("../users"), false);
  assert.equal(isSymbol(""), false);
  assert.equal(number(null), "—");
  assert.equal(number(NaN), "—");
  assert.equal(percent(undefined), "—");
  assert.equal(percent(-1.25), "-1.25%");
  assert.equal(percent(0.5), "+0.50%");
});
