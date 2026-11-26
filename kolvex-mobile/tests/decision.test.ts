import assert from "node:assert/strict";
import { test } from "node:test";
import { decisionLabel, decisionTone } from "../src/lib/decision";

test("research ratings map to fixed labels, never to machine translation", () => {
  assert.equal(decisionLabel("BUY"), "看多");
  assert.equal(decisionLabel("SELL"), "看空");
  assert.equal(decisionLabel("HOLD"), "中性");
  assert.equal(decisionLabel("hold"), "中性");
});

test("technical biases use the softer labels", () => {
  assert.equal(decisionLabel("bullish", true), "偏多");
  assert.equal(decisionLabel("bearish", true), "偏空");
});

test("a missing rating says so instead of guessing", () => {
  assert.equal(decisionLabel(null), "暂无结论");
  assert.equal(decisionLabel(""), "暂无结论");
  assert.equal(decisionTone(undefined), null);
});

test("tones follow the Web: only BUY and SELL carry a direction", () => {
  assert.equal(decisionTone("BUY"), "positive");
  assert.equal(decisionTone("SELL"), "negative");
  assert.equal(decisionTone("HOLD"), "neutral");
  assert.equal(decisionTone("OVERWEIGHT"), "neutral");
});
