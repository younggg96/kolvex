"use client";

import Link from "next/link";
import { LandingParallax } from "./LandingScrollEffects";
import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import OpinionDistribution from "@/components/youtube/OpinionDistribution";
import TechnicalFindings from "@/components/youtube/chart/TechnicalFindings";
import CompanyLogo from "@/components/ui/company-logo";
import { DirectionBadge, useCopy } from "@/components/decision/shared";
import { useTranslation } from "@/lib/i18n";
import type { AiTechnicalAnalysis } from "@/lib/stockApi";

export default function LandingPreview() {
  const c = useCopy();
  const { t } = useTranslation();
  const [verticalTabs, setVerticalTabs] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 801px)");
    const update = () => setVerticalTabs(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const technical: AiTechnicalAnalysis = {
    symbol: "NVDA",
    interval: "1d",
    view: { start: "", end: "" },
    generated_at: "",
    indicators: { rsi: 64, resistance: 212 },
    trend: "uptrend",
    bias: "bullish",
    summary: c(
      "Momentum remains constructive near resistance.",
      "接近阻力，动能仍保持积极。",
    ),
    levels: [],
    trendlines: [],
    fib: null,
    signals: [],
    invalidation: null,
    findings: [
      {
        id: "momentum",
        status: "available",
        explanation: c(
          "RSI 64 suggests positive momentum, without confirming a breakout.",
          "RSI 64 显示动能偏强，但不能单独确认突破。",
        ),
      },
      {
        id: "levels",
        status: "available",
        explanation: c(
          "The illustrative resistance level is $212. A sustained move above it would change the technical context.",
          "示例阻力位为 212 美元。能否持续站上这一位置，是后续观察重点。",
        ),
      },
    ],
  };
  return (
    <section
      id="product"
      className="landing-section landing-product"
      aria-labelledby="product-title"
    >
      <div className="landing-width">
        <div className="landing-section-heading">
          <h2 id="product-title">
            {c(
              "Everything around a stock.\nOne connected view.",
              "围绕一只股票，\n把信息连起来。",
            )}
          </h2>
          <p>
            {c(
              "A headline is only the beginning. Follow it through market voices, price context and the reasoning behind the research.",
              "新闻只是起点。结合博主观点、价格结构与研究依据，理解事件的完整背景。",
            )}
          </p>
        </div>
        <LandingParallax className="landing-workspace" distance={38}>
          <div className="workspace-top">
            <div className="flex items-center gap-3">
              <CompanyLogo symbol="NVDA" size="sm" />
              <strong>NVDA</strong>
              <span className="text-muted-foreground">NVIDIA</span>
            </div>
            <span>
              {c(
                "Product example · Not live research",
                "产品示例 · 非实时研究",
              )}
            </span>
          </div>
          <Tabs
            defaultValue="news"
            orientation={verticalTabs ? "vertical" : "horizontal"}
            className="workspace-layout"
          >
            <TabsList
              className="workspace-tabs"
              aria-label={c("Explore intelligence layers", "探索情报维度")}
            >
              <TabsTrigger value="news">{c("News", "市场新闻")}</TabsTrigger>
              <TabsTrigger value="creators">
                {c("Market voices", "博主观点")}
              </TabsTrigger>
              <TabsTrigger value="technical">
                {c("Technicals", "技术分析")}
              </TabsTrigger>
              <TabsTrigger value="research">
                {c("AI research", "AI 研究")}
              </TabsTrigger>
            </TabsList>
            <div className="workspace-reader">
              <TabsContent value="news">
                <div className="workspace-panel-grid">
                  <div>
                    <span className="workspace-category">
                      {c("NEWS CONTEXT", "新闻背景")}
                    </span>
                    <h3>
                      {c(
                        "The catalyst behind the move.",
                        "理解行情背后的催化因素。",
                      )}
                    </h3>
                    <p>
                      {c(
                        "A stronger AI spending outlook puts semiconductor demand in focus. Read the headline alongside the companies and assumptions it affects.",
                        "AI 支出前景升温，让半导体需求成为焦点。把新闻与受影响的公司、关键假设放在一起阅读。",
                      )}
                    </p>
                    <Link className="landing-text-link" href="/stocks/NVDA">
                      {c("Open stock coverage", "查看个股信息")}
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                  <dl className="workspace-evidence-list">
                    <div>
                      <dt>{c("What changed", "发生了什么")}</dt>
                      <dd>
                        {c(
                          "AI infrastructure spending expectations",
                          "AI 基础设施支出预期",
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>{c("Why it matters", "为什么重要")}</dt>
                      <dd>
                        {c(
                          "Demand visibility for chipmakers",
                          "芯片制造商的需求能见度",
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>{c("What to watch", "后续关注")}</dt>
                      <dd>
                        {c(
                          "Earnings, margins and order conversion",
                          "盈利、利润率与订单转化",
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              </TabsContent>
              <TabsContent value="creators">
                <div className="workspace-panel-grid">
                  <div>
                    <span className="workspace-category">
                      {c("MARKET VOICES", "市场声音")}
                    </span>
                    <h3>
                      {c(
                        "See the conviction.\nKeep the disagreement.",
                        "看清倾向，\n也保留分歧。",
                      )}
                    </h3>
                    <p>
                      {c(
                        "Compare creator views over time, with the reasoning, risks and original video kept together. A consensus is context, never a recommendation.",
                        "对照博主历次观点，把理由、风险与原始视频一起读。观点分布提供背景，不代表投资建议。",
                      )}
                    </p>
                    <Link href="/creators" className="landing-text-link">
                      {c("Browse creator opinions", "浏览博主观点")}
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                  <div className="workspace-distribution">
                    <OpinionDistribution
                      compact
                      summary={{
                        total_opinions: 10,
                        total_stocks: 1,
                        total_creators: 5,
                        bullish_count: 7,
                        bearish_count: 1,
                        neutral_count: 2,
                        avg_score: 0,
                      }}
                    />
                    <p className="landing-fine-print">
                      {c(
                        "Illustrative distribution of 10 opinions.",
                        "10 条观点的示例分布。",
                      )}
                    </p>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="technical">
                <div className="workspace-panel-grid">
                  <div>
                    <span className="workspace-category">
                      {c("TECHNICAL CONTEXT", "技术背景")}
                    </span>
                    <h3>
                      {c(
                        "A signal needs a second look.",
                        "信号背后，也有条件。",
                      )}
                    </h3>
                    <p>
                      {c(
                        "Read momentum, price levels and the conditions that could change the interpretation. Technical analysis adds context to the move.",
                        "结合动能、关键价位与可能改变判断的条件，理解行情的技术背景。",
                      )}
                    </p>
                    <Link
                      className="landing-text-link"
                      href="/dashboard/market/NVDA"
                    >
                      {c("Open technical analysis", "打开技术分析")}
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                  <div>
                    <div className="workspace-technical">
                      <DirectionBadge direction="bullish" />
                      <strong>RSI 64</strong>
                      <span>{c("Resistance $212", "阻力位 $212")}</span>
                    </div>
                    <TechnicalFindings result={technical} t={t} />
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="research">
                <div className="workspace-panel-grid">
                  <div>
                    <span className="workspace-category">
                      {c("RESEARCH & REASONING", "研究与推理")}
                    </span>
                    <h3>
                      {c(
                        "The conclusion.\nAnd how it got there.",
                        "看结论，\n也看推理过程。",
                      )}
                    </h3>
                    <p>
                      {c(
                        "Published research brings the investment case, analyst evidence and opposing arguments into one read. Inspect the assumptions before forming a view.",
                        "研究报告汇集投资逻辑、分析依据与相反观点。在形成判断前，先核实结论所依赖的假设。",
                      )}
                    </p>
                    <Link href="/research" className="landing-text-link">
                      {c("Read published research", "阅读已发布研究")}
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                  <dl className="workspace-evidence-list">
                    <div>
                      <dt>{c("Bullish case", "看多逻辑")}</dt>
                      <dd>
                        {c(
                          "Sustained demand for AI infrastructure",
                          "AI 基础设施需求持续",
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>{c("Bearish case", "看空逻辑")}</dt>
                      <dd>
                        {c(
                          "Growth expectations already in the price",
                          "增长预期可能已被定价",
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>{c("Key assumption", "关键假设")}</dt>
                      <dd>
                        {c(
                          "Spending converts into durable earnings",
                          "资本支出转化为可持续盈利",
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              </TabsContent>
            </div>
          </Tabs>
          <div className="workspace-bottom">
            <p>
              {c(
                "Creator opinions retain their original video links. Research separates evidence from interpretation.",
                "博主观点保留原始视频链接，研究区分依据与解读。",
              )}
            </p>
            <Link href="/research">
              {c("Browse research", "浏览研究")}
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
        </LandingParallax>
      </div>
    </section>
  );
}
