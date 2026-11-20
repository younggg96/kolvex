const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const ROOT = path.join(__dirname, "..");
function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.join(ROOT, file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    { exports: module.exports, module, URLSearchParams },
  );
  return module.exports;
}
const share = load("lib/contentShare.ts");

const chat = {
  id: "AbCdEf1234",
  kind: "chat",
  visibility: "public",
  locale: "zh",
  locked: false,
  created_at: "2026-11-19T10:00:00Z",
  card: {
    v: 1,
    title: "NVDA 基本面怎么样？",
    summary: "",
    tickers: [],
    data: {
      question: "NVDA 基本面怎么样？",
      answer:
        "## 结论\n\n**毛利率** 75%，见 [财报](https://x.test)。\n\n| 指标 | 数值 |\n| --- | --- |\n| 收入 | 94% |",
    },
  },
};

test("share ids and URLs", () => {
  assert.ok(share.isShareId("AbCdEf1234"));
  assert.ok(!share.isShareId("../etc/pw"));
  assert.equal(
    share.shareUrl("AbCdEf1234", "http://localhost:3000/"),
    "http://localhost:3000/share/AbCdEf1234",
  );
});

test("markdown becomes readable text for chat apps", () => {
  assert.equal(
    share.markdownToText(chat.card.data.answer),
    "结论\n\n毛利率 75%，见 财报。\n\n指标 · 数值\n收入 · 94%",
  );
});

test("headline and text name the source and the link", () => {
  assert.equal(share.shareHeadline(chat, true), "Kolvex AI 回答：NVDA 基本面怎么样？");
  const text = share.shareText(chat, true, "https://kolvex.app/share/AbCdEf1234");
  assert.match(text, /问：NVDA 基本面怎么样？/);
  assert.match(text, /在 Kolvex 查看：https:\/\/kolvex.app\/share\/AbCdEf1234$/);
  const opinion = {
    ...chat,
    kind: "opinion",
    card: {
      ...chat.card,
      tickers: ["TSLA"],
      author: { name: "博主" },
      source: { platform: "youtube", url: "https://www.youtube.com/watch?v=abcdefghijk" },
      data: { sentiment: "bullish", summary: "看好交付" },
    },
  };
  assert.equal(share.shareHeadline(opinion, true), "博主 · TSLA · 看多");
  assert.equal(share.shareHeadline(opinion, false), "博主 · TSLA · Bullish");
  assert.match(share.shareText(opinion, true, "u"), /原始来源：https:\/\/www.youtube.com/);
});

test("locked shares never leak a body into the copied text", () => {
  const locked = {
    ...chat,
    kind: "options_candidate",
    locked: true,
    card: { ...chat.card, tickers: ["NVDA"], data: {} },
  };
  assert.equal(share.shareText(locked, true, "u").split("\n\n").length, 2);
});

test("social links only prefill the composer", () => {
  const links = share.shareSocialLinks("https://kolvex.app/share/AbCdEf1234", "标题");
  assert.deepEqual(JSON.parse(JSON.stringify(links.map((link) => new URL(link.href).hostname))), [
    "twitter.com",
    "service.weibo.com",
    "t.me",
    "api.whatsapp.com",
    "www.facebook.com",
  ]);
});
