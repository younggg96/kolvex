import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { translate } from "../src/lib/translation";
import messages from "../src/lib/uiMessages.json";
import templates from "../translations/templates-en.json";
test("Chinese UI remains unchanged while all declared English labels are nonempty", () => {
  for (const [zh, en] of Object.entries(messages)) {
    assert.equal(translate(zh, "zh"), zh);
    assert.ok(en.trim());
    assert.equal(translate(zh, "en"), en);
  }
});
test("dynamic labels retain ticker, provider and status values", () => {
  assert.equal(translate("AAPL 技术图表", "en"), "AAPL technical chart");
  assert.equal(translate("删除 deepseek 密钥", "en"), "Delete deepseek key");
  assert.equal(
    translate("服务暂时不可用（503），请稍后重试。", "en"),
    "Service temporarily unavailable (503). Please retry later.",
  );
  assert.equal(translate("  自选  ", "en"), "  Watchlist  ");
});
test("template translations never lose or introduce interpolation fields", () => {
  for (const [source, en] of Object.entries(templates)) {
    const fields = (text: string) =>
      [...text.matchAll(/\{(\d+)\}/g)].map((m) => m[1]).sort();
    assert.deepEqual(fields(source), fields(en), source);
  }
});
test("unknown source prose and entered data are preserved; numeric unit labels localize", () => {
  const source = "作者认为目前的价格需要更多观察，这段原文应当完整保留。";
  assert.equal(translate(source, "en"), source);
  assert.equal(translate("user@example.com", "en"), "user@example.com");
  assert.equal(translate("-0.28 个百分点", "en"), "-0.28 pp");
});
test("current interface literals and templates have a reproducible English catalogue", () => {
  execFileSync(
    process.execPath,
    [
      new URL("../scripts/generate-ui-messages.cjs", import.meta.url).pathname,
      "--check",
    ],
    { stdio: "pipe" },
  );
});
