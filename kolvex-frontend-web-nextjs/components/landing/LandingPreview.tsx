"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Check,
  AudioLines,
  BookOpen,
  History,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCopy } from "@/components/decision/shared";
import { LandingReveal, landingEase } from "./LandingMotion";

const prices = [
  184, 186, 182, 185, 189, 187, 192, 190, 194, 191, 196, 198, 195, 199, 197,
  201,
];

export default function LandingPreview() {
  const c = useCopy();
  const reduce = useReducedMotion();
  const [step, setStep] = useState("research");
  const steps = [
    {
      value: "research",
      label: c("Research", "研究"),
      icon: AudioLines,
      title: c("Start with the whole picture.", "从完整视角开始。"),
      body: c(
        "Creator opinions, market context and your position. Understand the stock from more than one angle.",
        "把博主观点、市场背景和自己的持仓放在一起，从多个角度理解一只股票。",
      ),
      items: [
        [c("Creator outlook", "博主倾向"), c("Bullish", "看多")],
        [c("Technical structure", "技术结构"), c("Uptrend", "上升趋势")],
        [c("Key risk", "核心风险"), c("Valuation", "估值")],
      ],
      href: "/dashboard/youtube-opinions",
      action: c("Explore creator opinions", "了解博主观点"),
    },
    {
      value: "validate",
      label: c("Validate", "验证"),
      icon: Layers,
      title: c("Look beyond the conclusion.", "结论之外，还有依据。"),
      body: c(
        "Inspect the evidence and the opposing view before forming your own perspective.",
        "看懂支持观点的证据，也了解不同意见，再形成自己的判断。",
      ),
      items: [
        [c("Price structure", "价格结构"), c("Higher highs", "高点抬升")],
        [
          c("Moving averages", "均线"),
          c("Above EMA20 / 50", "位于 EMA20 / 50 上方"),
        ],
        [c("Counterpoint", "不同观点"), c("Valuation risk", "估值风险")],
      ],
      href: "/dashboard/market/NVDA",
      action: c("Explore stock analysis", "了解股票分析"),
    },
    {
      value: "analysis",
      label: c("Analysis", "分析"),
      icon: BookOpen,
      title: c(
        "Read the reasoning, not just a rating.",
        "读懂分析，而不只看评级。",
      ),
      body: c(
        "AI research brings the conclusion, analyst evidence and debate into a readable report.",
        "AI 研究将结论、分析依据与多方讨论整理为一份可阅读的报告。",
      ),
      items: [
        [c("Research focus", "研究重点"), c("AI demand", "AI 需求")],
        [c("Technical context", "技术背景"), c("Pullback support", "回调支撑")],
        [c("Risk to inspect", "关注风险"), c("Valuation", "估值")],
      ],
      href: "/dashboard/ai-research",
      action: c("Explore AI research", "了解 AI 研究"),
    },
    {
      value: "updates",
      label: c("Updates", "动态"),
      icon: History,
      title: c("Know when the view changes.", "观点变了，你也看得见。"),
      body: c(
        "Compare new opinions with earlier calls and follow the updates related to your holdings.",
        "对比博主的新旧观点，持续了解与你持仓相关的变化。",
      ),
      items: [
        [c("Earlier opinion", "先前观点"), c("Bullish", "看多")],
        [c("Latest opinion", "最新观点"), c("Neutral", "中性")],
        [
          c("What to read", "查看内容"),
          c("Reasons and source", "变化原因与来源"),
        ],
      ],
      href: "/dashboard/journal",
      action: c("Explore updates", "了解变化动态"),
    },
  ];
  return (
    <section id="decision-preview" className="landing-preview-section">
      <div className="landing-width">
        <LandingReveal className="landing-section-heading">
          <h2>
            {c("One stock. A richer perspective.", "一只股票，不止一种视角。")}
          </h2>
          <p>
            {c(
              "Try the preview. Follow the journey from a first look to the latest change.",
              "点击切换，体验从了解股票到追踪变化的完整过程。",
            )}
          </p>
        </LandingReveal>
        <LandingReveal className="landing-preview-frame" delay={0.08}>
          <Tabs value={step} onValueChange={setStep}>
            <div className="preview-toolbar">
              <div className="flex items-center gap-3">
                <span className="preview-stock-mark">N</span>
                <div>
                  <p className="font-semibold">
                    NVDA{" "}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      NVIDIA
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c("Stock workspace", "股票工作台")}
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground">
                {c(
                  "Illustrative example, not live market data",
                  "示例数据，非实时行情",
                )}
              </span>
            </div>
            <div className="preview-body">
              <div className="preview-chart-panel">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {c("Example price", "示例价格")}
                    </p>
                    <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
                      $201.00
                    </p>
                  </div>
                  <span className="text-xs text-positive">
                    {c("Price context", "价格背景")}
                  </span>
                </div>
                <svg
                  viewBox="0 0 580 265"
                  role="img"
                  aria-label={c(
                    "Illustrative NVDA candlestick chart, from $184 to $201",
                    "NVDA 示例 K 线，价格从 184 美元到 201 美元",
                  )}
                  className="mt-8 w-full"
                >
                  <g stroke="currentColor" className="text-border">
                    {[30, 90, 150, 210].map((y) => (
                      <line
                        key={y}
                        x1="0"
                        x2="515"
                        y1={y}
                        y2={y}
                        strokeDasharray="3 5"
                      />
                    ))}
                  </g>
                  {prices.map((close, i) => {
                    const open = i === 0 ? 181 : prices[i - 1];
                    const y = (p: number) => 228 - (p - 175) * 6;
                    return (
                      <motion.g
                        key={i}
                        className={
                          close >= open ? "text-positive" : "text-negative"
                        }
                        stroke="currentColor"
                        fill="currentColor"
                        initial={false}
                        whileInView={
                          reduce
                            ? undefined
                            : { opacity: [0, 1], scaleY: [0.7, 1] }
                        }
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.025, duration: 0.5 }}
                        style={{ transformOrigin: "center" }}
                      >
                        <line
                          x1={18 + i * 31}
                          x2={18 + i * 31}
                          y1={y(Math.max(open, close) + 2)}
                          y2={y(Math.min(open, close) - 2)}
                        />
                        <rect
                          x={11 + i * 31}
                          y={y(Math.max(open, close))}
                          width="13"
                          height={Math.max(Math.abs(open - close) * 6, 3)}
                          rx="2"
                        />
                      </motion.g>
                    );
                  })}
                  <g
                    fontSize="11"
                    fill="currentColor"
                    className="text-muted-foreground"
                  >
                    <text x="533" y="35">
                      $205
                    </text>
                    <text x="533" y="95">
                      $195
                    </text>
                    <text x="533" y="155">
                      $185
                    </text>
                    <text x="533" y="215">
                      $175
                    </text>
                    <text x="0" y="260">
                      {c("Earlier", "先前")}
                    </text>
                    <text x="477" y="260">
                      {c("Latest", "最近")}
                    </text>
                  </g>
                </svg>
                <div className="preview-chart-caption">
                  <Check
                    size={15}
                    className="text-positive shrink-0"
                    aria-hidden="true"
                  />
                  <p>
                    {c(
                      "Price, opinions and research stay connected to the same stock.",
                      "行情、观点与研究，始终围绕同一只股票。",
                    )}
                  </p>
                </div>
              </div>
              <div className="preview-insight-panel">
                <TabsList
                  aria-label={c("Stock information preview", "股票信息预览")}
                  className="preview-tabs"
                >
                  {steps.map((item) => (
                    <TabsTrigger value={item.value} key={item.value}>
                      {item.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {steps.map(
                  ({ value, icon: Icon, title, body, items, href, action }) => (
                    <TabsContent
                      value={value}
                      key={value}
                      className="preview-tab-content"
                    >
                      <motion.div
                        key={value}
                        initial={false}
                        animate={
                          reduce ? undefined : { opacity: [0, 1], y: [10, 0] }
                        }
                        transition={{ duration: 0.4, ease: landingEase }}
                      >
                        <Icon
                          size={24}
                          className="text-positive"
                          aria-hidden="true"
                        />
                        <h3 className="mt-5 text-2xl font-semibold tracking-tight">
                          {title}
                        </h3>
                        <p className="mt-3 text-sm leading-7 text-muted-foreground">
                          {body}
                        </p>
                        <dl className="preview-evidence">
                          {items.map(([label, val]) => (
                            <div key={label}>
                              <dt>{label}</dt>
                              <dd>{val}</dd>
                            </div>
                          ))}
                        </dl>
                        <Button
                          variant="ghost"
                          asChild
                          className="preview-action"
                        >
                          <Link href={href}>
                            {action}
                            <ArrowUpRight size={15} className="ml-2" />
                          </Link>
                        </Button>
                      </motion.div>
                    </TabsContent>
                  ),
                )}
              </div>
            </div>
          </Tabs>
        </LandingReveal>
      </div>
    </section>
  );
}
