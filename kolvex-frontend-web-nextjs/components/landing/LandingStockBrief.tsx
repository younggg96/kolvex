"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import CompanyLogo from "@/components/ui/company-logo";
import { DirectionBadge, useCopy } from "@/components/decision/shared";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/** Labeled demonstration fixtures. These are not current prices or live research. */
const examples = [
  {
    symbol: "NVDA",
    name: "NVIDIA",
    move: "+2.84%",
    theme: ["AI infrastructure", "AI 基础设施"],
    news: [
      "Infrastructure spending brings chip demand into focus.",
      "基础设施支出升温，芯片需求成为焦点。",
    ],
    voices: [
      "Demand supports the thesis. Valuation divides opinion.",
      "需求支撑增长逻辑，估值仍是分歧所在。",
    ],
    technical: [
      "RSI 64 · Above EMA 20 · Resistance $212",
      "RSI 64 · 高于 EMA 20 · 阻力 $212",
    ],
    title: [
      "Demand builds the case.\nValuation sets the risk.",
      "需求支撑趋势，\n估值决定风险。",
    ],
    summary: [
      "Momentum is constructive, but expectations are high. Watch whether infrastructure spending translates into sustained earnings.",
      "动能保持积极，但市场预期已经不低。接下来，关注基础设施支出能否转化为持续盈利。",
    ],
    watch: ["Earnings quality & order conversion", "盈利质量与订单转化"],
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    move: "−1.26%",
    theme: ["Margins & deliveries", "利润率与交付"],
    news: [
      "Delivery expectations put pricing and margins in focus.",
      "交付预期变化，让定价与利润率受到关注。",
    ],
    voices: [
      "Long-term opportunity meets near-term execution risk.",
      "长期机遇与短期执行风险同时存在。",
    ],
    technical: [
      "RSI 46 · Below EMA 20 · Support $240",
      "RSI 46 · 低于 EMA 20 · 支撑 $240",
    ],
    title: [
      "Volume tells one story.\nMargins tell another.",
      "销量是一面，\n利润是另一面。",
    ],
    summary: [
      "Delivery growth alone does not settle the investment case. Read pricing, margins and execution alongside the longer-term opportunity.",
      "交付增长并不能回答所有问题。把定价、利润率与执行力放在一起，再看长期机会。",
    ],
    watch: ["Pricing discipline & operating margins", "定价策略与营业利润率"],
  },
  {
    symbol: "AMD",
    name: "AMD",
    move: "+1.62%",
    theme: ["Data center growth", "数据中心增长"],
    news: [
      "Data center demand raises the stakes for execution.",
      "数据中心需求增长，让交付能力更受关注。",
    ],
    voices: [
      "The AI opportunity is clear. Its timing is debated.",
      "AI 机遇清晰，兑现节奏仍有分歧。",
    ],
    technical: [
      "RSI 58 · Above EMA 20 · Resistance $180",
      "RSI 58 · 高于 EMA 20 · 阻力 $180",
    ],
    title: [
      "The opportunity is big.\nExecution makes it real.",
      "机会足够大，\n兑现才是关键。",
    ],
    summary: [
      "An expanding market supports the growth case. Watch product delivery and revenue conversion before treating potential as proven earnings.",
      "市场扩张支撑增长逻辑，但潜力不等于已实现的盈利。关注产品交付与收入兑现。",
    ],
    watch: ["Product delivery & revenue conversion", "产品交付与收入兑现"],
  },
] as const;

export default function LandingStockBrief() {
  const c = useCopy();
  const [symbol, setSymbol] = useState("NVDA");
  return (
    <Tabs value={symbol} onValueChange={setSymbol} className="focus-reader">
      <div className="focus-reader-bar">
        <TabsList
          className="focus-stock-tabs"
          aria-label={c("Choose a stock example", "选择股票示例")}
        >
          {examples.map((stock) => (
            <TabsTrigger value={stock.symbol} key={stock.symbol}>
              {stock.symbol}
            </TabsTrigger>
          ))}
        </TabsList>
        <span className="focus-sample-label">
          {c(
            "Illustrative product example · Not live data",
            "产品内容示例 · 非实时数据",
          )}
        </span>
      </div>
      {examples.map((stock) => (
        <TabsContent
          value={stock.symbol}
          key={stock.symbol}
          className="focus-stock-view"
        >
          <div className="focus-stock-identity">
            <div className="focus-company">
              <CompanyLogo symbol={stock.symbol} name={stock.name} size="sm" />
              <span>{stock.name}</span>
              <span className="focus-exchange">NASDAQ</span>
            </div>
            <div className="focus-symbol-row">
              <h2>{stock.symbol}</h2>
              <div
                className={
                  stock.move.startsWith("−") ? "text-negative" : "text-positive"
                }
              >
                <strong>{stock.move}</strong>
                <span>{c("Example move", "示例涨跌")}</span>
              </div>
            </div>
            <p className="focus-theme">{c(stock.theme[0], stock.theme[1])}</p>
          </div>
          <div className="focus-intelligence">
            <div className="focus-inputs">
              <div className="focus-input-row">
                <span>{c("News", "市场新闻")}</span>
                <p>{c(stock.news[0], stock.news[1])}</p>
              </div>
              <div className="focus-input-row">
                <span>{c("Market voices", "博主观点")}</span>
                <p>{c(stock.voices[0], stock.voices[1])}</p>
              </div>
              <div className="focus-input-row">
                <span>{c("Technicals", "技术背景")}</span>
                <p className="focus-technical-data">
                  {c(stock.technical[0], stock.technical[1])}
                </p>
              </div>
            </div>
            <div className="focus-synthesis">
              <div className="focus-synthesis-label">
                <span>{c("THE CONNECTED VIEW", "综合解读")}</span>
                <DirectionBadge
                  direction={stock.symbol === "TSLA" ? "neutral" : "bullish"}
                />
              </div>
              <h3>{c(stock.title[0], stock.title[1])}</h3>
              <p>{c(stock.summary[0], stock.summary[1])}</p>
              <div className="focus-watch">
                <span>{c("Watch next", "接下来关注")}</span>
                <strong>{c(stock.watch[0], stock.watch[1])}</strong>
              </div>
              <Link
                href={`/stocks/${stock.symbol}`}
                className="focus-stock-link"
              >
                {c("Explore this stock", "查看这只股票")}
                <ArrowUpRight size={16} aria-hidden />
              </Link>
            </div>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
