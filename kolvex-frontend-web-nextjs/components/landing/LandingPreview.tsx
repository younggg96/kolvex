"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowUpRight,
  AudioLines,
  BookOpen,
  LineChart,
  Link2,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCopy } from "@/components/decision/shared";
import { LandingReveal, landingEase, useLandingMotion } from "./LandingMotion";

export default function LandingPreview() {
  const c = useCopy();
  const { disabled: reduce } = useLandingMotion();
  const perspectives = [
    {
      value: "opinions",
      icon: AudioLines,
      label: c("Creator opinions", "博主观点"),
      detail: c("The view, and what supports it", "倾向与背后的理由"),
      category: c("OPINION BRIEF", "观点摘要"),
      title: c(
        "Same stock. Different convictions.",
        "同一只股票，观点各有依据。",
      ),
      body: c(
        "Read the case for AI demand alongside the concerns about valuation. Keep the reasoning attached to the opinion.",
        "有人关注 AI 需求的增长，也有人担心估值已透支预期。把理由和观点一起读，理解分歧来自哪里。",
      ),
      evidence: [
        [
          c("Bullish case", "看多理由"),
          c("AI infrastructure demand", "AI 基础设施需求"),
          c(
            "Watch whether spending becomes sustained revenue growth.",
            "关注资本支出能否转化为持续的收入增长。",
          ),
        ],
        [
          c("Cautious case", "谨慎理由"),
          c("Expectations in the price", "价格中的增长预期"),
          c(
            "Strong demand does not remove valuation risk.",
            "需求强劲，并不意味着估值风险消失。",
          ),
        ],
      ],
      question: c(
        "What changed in the creator’s latest view?",
        "博主的最新观点，和之前有什么不同？",
      ),
      href: "/creators",
      action: c("Read creator opinions", "查看博主观点"),
    },
    {
      value: "technical",
      icon: LineChart,
      label: c("Technical analysis", "技术分析"),
      detail: c("Price structure in context", "结合价格结构看行情"),
      category: c("TECHNICAL BRIEF", "技术摘要"),
      title: c("A trend needs context.", "看趋势，也看它成立的条件。"),
      body: c(
        "Bring price structure, support and opposing signals into the same read. A chart is evidence to inspect, not a conclusion on its own.",
        "把价格结构、支撑位与相反信号放在一起看。图表提供判断依据，也需要结合条件理解。",
      ),
      evidence: [
        [
          c("Structure", "价格结构"),
          c("Higher highs and higher lows", "高点与低点逐步抬升"),
          c(
            "Compare recent swings before calling a trend intact.",
            "对照近期波段，判断趋势结构是否延续。",
          ),
        ],
        [
          c("Invalidation", "失效条件"),
          c("A break below support", "价格跌破支撑"),
          c(
            "Check whether a close confirms the break or price recovers.",
            "关注收盘能否确认跌破，还是重新收回支撑。",
          ),
        ],
      ],
      question: c(
        "Which price level would change this interpretation?",
        "价格到了什么位置，需要重新评估这个判断？",
      ),
      href: "/dashboard/market/NVDA",
      action: c("Open the stock workspace", "打开股票工作台"),
    },
    {
      value: "research",
      icon: BookOpen,
      label: c("AI research", "AI 研究"),
      detail: c("The conclusion and the debate", "结论、依据与不同意见"),
      category: c("RESEARCH BRIEF", "研究摘要"),
      title: c(
        "Read how the conclusion was reached.",
        "从结论，读到推理过程。",
      ),
      body: c(
        "Read the investment case, analyst evidence and opposing arguments together. Return to the details when an assumption needs a closer look.",
        "结合投资逻辑、分析依据与不同意见阅读报告。遇到需要核实的假设，继续追看对应的论证。",
      ),
      evidence: [
        [
          c("Investment case", "投资逻辑"),
          c("Demand and earnings quality", "需求与盈利质量"),
          c(
            "Inspect growth assumptions alongside margins and cash flow.",
            "结合利润率与现金流，核实增长假设。",
          ),
        ],
        [
          c("Opposing argument", "不同意见"),
          c("Growth already priced in", "增长是否已被定价"),
          c(
            "Compare the optimistic case with a slower-growth scenario.",
            "对照乐观预期与增长放缓的情景。",
          ),
        ],
      ],
      question: c(
        "Which assumptions does the conclusion depend on?",
        "这份结论，依赖哪些关键假设？",
      ),
      href: "/research",
      action: c("Read AI research", "查看 AI 研究"),
    },
  ];

  return (
    <section id="decision-preview" className="landing-preview-section">
      <div className="landing-width">
        <LandingReveal className="landing-section-heading dossier-heading">
          <p className="dossier-eyebrow">
            {c("INSIDE THE WORKSPACE", "走进股票工作台")}
          </p>
          <h2>{c("Follow the reasoning.", "不止看观点，更看依据。")}</h2>
          <p>
            {c(
              "One stock, seen through the opinions, evidence and questions that matter.",
              "围绕一只股票，把观点、分析依据与值得追问的问题连起来。",
            )}
          </p>
        </LandingReveal>
        <LandingReveal className="landing-preview-frame" delay={0.08}>
          <div className="preview-toolbar">
            <div className="flex items-center gap-3">
              <span className="preview-stock-mark" aria-hidden="true">
                N
              </span>
              <div>
                <p className="font-semibold">
                  NVDA{" "}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    NVIDIA
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {c("Stock research dossier", "股票研究档案")}
                </p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              {c(
                "Illustrative content · Not live research",
                "内容示例 · 非实时研究",
              )}
            </span>
          </div>
          <Tabs
            defaultValue="opinions"
            orientation="vertical"
            className="dossier-body"
          >
            <div className="dossier-sidebar">
              <p className="dossier-sidebar-label">
                {c("EXPLORE THE EVIDENCE", "从不同角度，了解依据")}
              </p>
              <TabsList
                aria-label={c("Research perspective", "研究视角")}
                className="dossier-tabs"
              >
                {perspectives.map(({ value, icon: Icon, label, detail }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="dossier-trigger"
                  >
                    <Icon size={20} aria-hidden="true" />
                    <span>
                      <strong>{label}</strong>
                      <small>{detail}</small>
                    </span>
                    <ArrowUpRight
                      size={16}
                      className="dossier-tab-arrow"
                      aria-hidden="true"
                    />
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="dossier-source-note">
                <Link2 size={17} aria-hidden="true" />
                <p>
                  {c(
                    "In the workspace, creator opinions link back to their original videos.",
                    "工作台中的博主观点保留原始视频来源，方便回看完整背景。",
                  )}
                </p>
              </div>
            </div>
            <div className="dossier-reader">
              {perspectives.map((item) => (
                <TabsContent
                  key={item.value}
                  value={item.value}
                  className="dossier-panel"
                >
                  <motion.div
                    initial={false}
                    animate={
                      reduce ? { opacity: 1, y: 0 } : { opacity: [0, 1], y: [8, 0] }
                    }
                    transition={{ duration: 0.3, ease: landingEase }}
                  >
                    <p className="dossier-category">{item.category}</p>
                    <h3>{item.title}</h3>
                    <p className="dossier-summary">{item.body}</p>
                    <dl className="dossier-evidence">
                      {item.evidence.map(([label, title, body]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>
                            <strong>{title}</strong>
                            <p>{body}</p>
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="dossier-question">
                      <span>{c("A QUESTION TO FOLLOW", "值得继续追问")}</span>
                      <p>{item.question}</p>
                    </div>
                    <Link
                      href={item.href}
                      className="landing-text-link dossier-action"
                    >
                      {item.action}
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </Link>
                  </motion.div>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </LandingReveal>
      </div>
    </section>
  );
}
