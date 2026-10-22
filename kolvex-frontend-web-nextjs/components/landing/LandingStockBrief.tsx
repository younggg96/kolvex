"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import CompanyLogo from "@/components/ui/company-logo";
import { useCopy } from "@/components/decision/shared";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

/** Illustrative examples, not current market data. */
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
  },
] as const;

export default function LandingStockBrief() {
  const c = useCopy();
  const [symbol, setSymbol] = useState("NVDA");
  const [source, setSource] = useState("news");
  const sources = [{ key: "news", label: c("News", "新闻") }, { key: "voices", label: c("Voices", "博主观点") }, { key: "technical", label: c("Technicals", "技术信号") }] as const;
  return <Tabs value={symbol} onValueChange={setSymbol} className="focus-reader">
    <div className="focus-reader-bar">
      <TabsList className="focus-stock-tabs" aria-label={c("Choose a stock", "选择股票")}>
        {examples.map(stock => <TabsTrigger key={stock.symbol} value={stock.symbol}>{stock.symbol}</TabsTrigger>)}
      </TabsList>
      <span className="focus-sample-label">{c("Demo · Not live data", "演示 · 非实时数据")}</span>
    </div>
    {examples.map(stock => <TabsContent key={stock.symbol} value={stock.symbol} className="focus-stock-view">
      <div className="focus-stock-identity">
        <div className="focus-company"><CompanyLogo symbol={stock.symbol} name={stock.name} size="sm" /><span>{stock.name}</span><span className="focus-exchange">NASDAQ</span></div>
        <h2>{stock.symbol}</h2>
        <div className="focus-market-line"><strong className={stock.move.startsWith("−") ? "text-negative" : "text-positive"}>{stock.move}</strong><span>{c(stock.theme[0], stock.theme[1])}</span></div>
      </div>
      <div className="focus-reading">
        <h3>{c(stock.title[0], stock.title[1]).replace(/\n/g, " ")}</h3>
        <Tabs value={source} onValueChange={setSource} className="focus-evidence">
          <TabsList className="focus-source-tabs" aria-label={c("Explore the evidence", "查看依据")}>
            {sources.map(item => <TabsTrigger key={item.key} value={item.key}>{item.label}</TabsTrigger>)}
          </TabsList>
          {sources.map(item => <TabsContent key={item.key} value={item.key}><p>{c(stock[item.key][0], stock[item.key][1])}</p></TabsContent>)}
        </Tabs>
        <Link href={`/stocks/${stock.symbol}`} className="focus-stock-link">{c("Open research", "查看研究")}<ArrowUpRight size={17} aria-hidden /></Link>
      </div>
    </TabsContent>)}
  </Tabs>;
}
