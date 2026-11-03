import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compactNumber, financialFormat } from "../src/lib/financialFormat";
import { nativePathFor } from "../src/lib/deepLinks";
import { anchorAt, toViewBox } from "../src/lib/chartGeometry";
import {
  groupResearchByStock,
  loadResearchCatalog,
} from "../src/lib/researchGroups";
import { buildFullReport } from "../src/lib/fullReport";
import {
  protectIdentifiers,
  restoreIdentifiers,
} from "../src/lib/translateText";
import { describeStrength } from "../src/lib/opinionStrength";
import {
  creatorShareContent,
  creatorSocialLinks,
} from "../src/lib/creatorSharing";
import {
  DISABLED_FEATURES,
  portfolioEnabled,
} from "../src/lib/productFeatures";
import type { TradingAnalysis } from "../src/lib/contentTypes";
import { translate } from "../src/lib/translation";
import { textBlocks } from "../src/lib/markdownBlocks";
const web = new URL("../../kolvex-frontend-web-nextjs/lib/", import.meta.url);
test("compact numbers match the Web's Intl output in both locales", () => {
  for (const value of [
    0, 12, 999.5, 1234, 9999, 12345, 99999.9, 999_999, 1_000_000, 123456789,
    999_999_999, 391_035_000_000, 3.9e12, -2_500_000_000, 0.123,
  ])
    for (const [locale, intl] of [
      ["en", "en-US"],
      ["zh", "zh-CN"],
    ] as const)
      assert.equal(
        compactNumber(value, locale),
        new Intl.NumberFormat(intl, {
          notation: "compact",
          maximumFractionDigits: 2,
        }).format(value),
        `${locale} ${value}`,
      );
});
test("percent, date and missing values match the Web format", () => {
  const f = financialFormat("en");
  assert.equal(f.percent(0.12345), "12.35%");
  assert.equal(f.percent(null), "—");
  assert.equal(f.number(undefined), "—");
  for (const [locale, intl] of [
    ["en", "en-US"],
    ["zh", "zh-CN"],
  ] as const)
    assert.equal(
      financialFormat(locale).date("2025-09-27"),
      new Date("2025-09-27").toLocaleDateString(intl, {
        timeZone: "UTC",
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    );
  assert.equal(f.date("not a date"), "—");
});
const task = (id: string, ticker: string, date: string) =>
  ({
    id,
    ticker,
    trade_date: date,
    created_at: `${date}T00:00:00Z`,
  }) as TradingAnalysis;
test("research groups keep a stock together and order newest first", () => {
  const groups = groupResearchByStock([
    task("a", "aapl ", "2026-01-01"),
    task("b", "MSFT", "2026-03-01"),
    task("c", "AAPL", "2026-02-01"),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.ticker, g.tasks.map((t) => t.id)]),
    [
      ["MSFT", ["b"]],
      ["AAPL", ["c", "a"]],
    ],
  );
});
test("research catalog reads every page and refuses a short result", async () => {
  const pages = [
    { items: [task("a", "A", "2026-01-01")], total: 2 },
    { items: [task("b", "B", "2026-01-01")], total: 2 },
  ];
  const offsets: number[] = [];
  const items = await loadResearchCatalog(async (offset) => {
    offsets.push(offset);
    return pages[offset];
  });
  assert.deepEqual(offsets, [0, 1]);
  assert.equal(items.length, 2);
  await assert.rejects(
    loadResearchCatalog(async () => ({ items: [], total: 3 })),
    /不完整/,
  );
});
test("Website URLs resolve to the native screen for the same content", () => {
  const cases: [string, string][] = [
    ["/dashboard", "/"],
    [
      "/dashboard/market/nvda?tab=peers&peers=AMD,INTC",
      "/stock/NVDA?tab=peers&peers=AMD%2CINTC",
    ],
    ["https://kolvex.app/stocks/AAPL", "/stock/AAPL"],
    ["/share/creators/UC123", "/creator/youtube/UC123"],
    ["/research/abc", "/report/abc"],
    ["/dashboard/trading-analysis/explore/abc", "/report/abc"],
    ["/dashboard/briefs/2026-01-01", "/brief/2026-01-01"],
    ["/dashboard/chat/xyz", "/chat/xyz"],
    ["/dashboard/settings", "/preferences"],
    ["/dashboard/journal", "/updates"],
    ["/dashboard/x-opinions", "/opinions"],
    ["/dashboard/youtube-opinions?creator=UC9", "/creator/youtube/UC9"],
    ["/dashboard/ai-research?view=authoring", "/research-tasks"],
    ["/auth/reset-password?code=1", "/auth/recovery?code=1"],
    ["/auth/callback?code=1", "/auth/callback?code=1"],
    ["kolvex://stock/AAPL", "/stock/AAPL"],
    ["kolvex://auth/callback?code=1", "/auth/callback?code=1"],
    // Disabled on the Web, so it must not open a native portfolio.
    ["/dashboard/portfolio", "/"],
    ["/dashboard/market/..%2Fusers", "/"],
  ];
  for (const [input, expected] of cases)
    assert.equal(nativePathFor(input), expected, input);
});
test("a touch on the chart becomes the price and bar drawn there", () => {
  const bars = [
    { date: "2026-01-01" },
    { date: "2026-01-02" },
    { date: "2026-01-03" },
    { date: "2026-01-04" },
  ];
  // Wider than the viewBox: scale 1, centered horizontally.
  assert.deepEqual(toViewBox(40, 120, 400, 260), { x: 0, y: 120 });
  // Narrower: scales down and centers vertically.
  const narrow = toViewBox(160, 130, 320, 260);
  assert.deepEqual(narrow, { x: 160, y: 130 });
  const min = 100;
  const span = 50;
  const drawnY = 220 - ((125 - min) / span) * 200;
  const at = anchorAt({ x: 10 + 75 * 2.5, y: drawnY }, bars, min, span);
  assert.equal(at.price, 125);
  assert.equal(at.time, Date.parse("2026-01-03") / 1000);
  // Outside the plot clamps to a real bar; prices cannot go negative.
  assert.equal(
    anchorAt({ x: 9999, y: 9999 }, bars, min, span).time,
    Date.parse("2026-01-04") / 1000,
  );
  assert.equal(anchorAt({ x: 0, y: 9999 }, bars, min, span).price, 0);
});
test("full report export keeps Web section order and debate speakers", () => {
  const labels = Object.fromEntries(
    [
      "market",
      "sentiment",
      "news",
      "fundamentals",
      "investmentDebate",
      "investmentPlan",
      "traderPlan",
      "riskDebate",
      "finalSignal",
      "bullResearcher",
      "bearResearcher",
      "aggressiveAnalyst",
      "conservativeAnalyst",
      "judgeDecision",
    ].map((key) => [key, key]),
  ) as Parameters<typeof buildFullReport>[1];
  const report = buildFullReport(
    {
      ...task("a", "AAPL", "2026-01-01"),
      final_decision: "HOLD",
      market_report: "m",
      news_report: "n",
      investment_debate: { bull_history: "b", judge_decision: "j" },
    } as unknown as TradingAnalysis,
    labels,
  );
  assert.ok(report.startsWith("# AAPL — 2026-01-01"));
  assert.ok(report.indexOf("## market") < report.indexOf("## news"));
  assert.ok(report.includes("### bullResearcher\n\nb"));
  assert.ok(report.includes("### judgeDecision\n\nj"));
});
test("translation keeps cashtags and URLs literal, even when dropped", () => {
  const { masked, literals } = protectIdentifiers(
    "Buy $NVDA see https://x.com/a now",
  );
  assert.deepEqual(literals, ["$NVDA", "https://x.com/a"]);
  assert.equal(masked, "Buy ⟨0⟩ see ⟨1⟩ now");
  assert.equal(
    restoreIdentifiers("买入 ⟨0⟩ 查看 ⟨1⟩", literals),
    "买入 $NVDA 查看 https://x.com/a",
  );
  assert.equal(
    restoreIdentifiers("买入 ⟨0⟩", literals),
    "买入 $NVDA https://x.com/a",
  );
  assert.equal(restoreIdentifiers("坏⟨9", []), "坏");
});
test("opinion strength reads as words at the Web's thresholds", () => {
  assert.equal(describeStrength(null).label, "暂无数据");
  assert.equal(describeStrength(0).label, "中性");
  assert.equal(describeStrength(0, true).label, "持平");
  assert.equal(describeStrength(20).label, "轻度看涨");
  assert.equal(describeStrength(-50).label, "中度看跌");
  assert.equal(describeStrength(90).label, "强烈看涨");
  // A change spans ±200, so 90 is still moderate.
  assert.equal(describeStrength(90, true).label, "中度转强");
});
test("every opinion strength phrase has an English reading", () => {
  for (const value of [-90, -50, -20, 0, 20, 50, 90, null])
    for (const change of [false, true]) {
      const { label } = describeStrength(
        value === null || !change ? value : value * 2,
        change,
      );
      assert.ok(!/[\u4e00-\u9fff]/.test(translate(label, "en")), label);
    }
});
test("creator sharing matches the Web link and never posts by itself", () => {
  const content = creatorShareContent(
    { channel_id: "UC 1", channel_title: "A\nB" },
    {
      video: { video_id: "x", opinion_date: "2026-02-03", video_title: "T" },
      opinions: [
        {
          id: "1",
          ticker: "AAPL",
          sentiment: "bullish",
          opinion_date: "2026-02-03",
          summary: "S",
        },
      ],
    },
    "en",
  );
  assert.equal(content.url, "https://kolvex.app/share/creators/UC%201");
  assert.ok(content.title.startsWith("A B's latest"));
  assert.ok(content.text.includes("AAPL · Bullish\nS"));
  assert.ok(
    creatorSocialLinks(content).every((link) =>
      link.href.startsWith("https://"),
    ),
  );
});
test("native feature gates follow the Web manifest", () => {
  const source = readFileSync(new URL("productFeatures.ts", web), "utf8");
  const disabled = [
    ...source.matchAll(/id: "(\w+)",\s*label: "[^"]+",\s*enabled: false/g),
  ].map((match) => match[1]);
  assert.deepEqual([...DISABLED_FEATURES], disabled);
  assert.equal(portfolioEnabled, !disabled.includes("portfolio"));
});
test("report text splits into headings, rules, bullets and paragraphs", () => {
  assert.deepEqual(
    textBlocks("Intro\nline\n---\n## Trend\n- up **now**\n\nEnd"),
    [
      { kind: "paragraph", text: "Intro\nline" },
      { kind: "rule" },
      { kind: "heading", text: "Trend" },
      { kind: "bullet", text: "up **now**" },
      { kind: "paragraph", text: "End" },
    ],
  );
  assert.deepEqual(textBlocks(""), []);
});
