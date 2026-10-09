"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  History,
  Wallet,
  Plus,
  Minus,
  Video,
  FileText,
  Search,
  Link2,
} from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { LandingReveal, landingEase } from "./LandingMotion";
import LogoIcon from "@/components/common/LogoIcon";

export default function LandingHowItWorks() {
  const c = useCopy();
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const features = [
    {
      icon: AudioLines,
      title: c("Opinions with a source.", "每个观点，都有出处。"),
      body: c(
        "See who said what, about which stock, and when. Follow the original video to understand the full context.",
        "谁在什么时候，对哪只股票说了什么。观点保留原始视频来源，方便回看完整背景。",
      ),
      href: "/dashboard/youtube-opinions",
      link: c("Explore creator opinions", "了解博主观点"),
      nodes: [
        c("Source video", "来源视频"),
        c("Creator opinion", "博主观点"),
        c("Stock context", "股票背景"),
      ],
      nodeIcons: [Video, AudioLines, Search],
      note: c(
        "Follow an opinion back to its original source.",
        "从股票观点，追溯到原始内容。",
      ),
    },
    {
      icon: BookOpen,
      title: c("Research you can read into.", "看结论，也看推理过程。"),
      body: c(
        "Read technical evidence, published AI research and opposing views together. Make room for more than one interpretation.",
        "结合技术证据、AI 研究与不同观点，了解结论背后的理由，保留多角度的判断空间。",
      ),
      href: "/dashboard/ai-research",
      link: c("Explore AI research", "了解 AI 研究"),
      nodes: [
        c("Evidence", "分析依据"),
        c("Analyst debate", "多方讨论"),
        c("Research report", "研究报告"),
      ],
      nodeIcons: [Search, AudioLines, FileText],
      note: c(
        "A conclusion is only the beginning of the research.",
        "结论，是继续研究的起点。",
      ),
    },
    {
      icon: History,
      title: c("A view that evolves.", "追踪观点如何变化。"),
      body: c(
        "Read new creator calls beside earlier opinions. Understand what changed instead of starting from scratch each time.",
        "将博主的新观点与过去的判断对照，了解倾向与理由如何变化。每次回来，都能接着看。",
      ),
      href: "/dashboard/journal",
      link: c("Explore updates", "了解变化动态"),
      nodes: [
        c("Earlier view", "先前观点"),
        c("New opinion", "新的观点"),
        c("What changed", "变化原因"),
      ],
      nodeIcons: [History, AudioLines, FileText],
      note: c(
        "Keep the history. Understand the change.",
        "保留历史，理解变化。",
      ),
    },
    {
      icon: Wallet,
      title: c("Relevant to what you own.", "与你的持仓，建立关联。"),
      body: c(
        "Connect brokerage holdings and find related creator updates. Give the stocks in your portfolio their own research context.",
        "连接券商持仓，查看相关股票的博主动态，让研究信息与你实际关注的投资组合联系起来。",
      ),
      href: "/dashboard/portfolio",
      link: c("Explore your portfolio", "了解投资组合"),
      nodes: [
        c("Brokerage", "券商账户"),
        c("Your holdings", "我的持仓"),
        c("Related opinions", "相关观点"),
      ],
      nodeIcons: [Link2, Wallet, AudioLines],
      note: c(
        "The information that matters to your portfolio.",
        "找到与你的投资组合相关的信息。",
      ),
    },
  ];
  const feature = features[active];
  return (
    <section id="workflow" className="landing-workflow-section">
      <div className="landing-width">
        <LandingReveal className="landing-section-heading">
          <h2>{c("The dots connect here.", "分散的信息，在这里连起来。")}</h2>
          <p>
            {c(
              "Less jumping between tabs. More time understanding what matters.",
              "少一些页面切换，多一些对重要信息的理解。",
            )}
          </p>
        </LandingReveal>
        <div className="landing-workflow-grid">
          <LandingReveal className="workflow-accordion">
            {features.map((item, i) => (
              <div
                key={item.href}
                className="workflow-item"
                data-active={active === i && expanded}
              >
                <h3>
                  <button
                    type="button"
                    id={`workflow-trigger-${i}`}
                    aria-expanded={active === i && expanded}
                    aria-controls={`workflow-content-${i}`}
                    onClick={() => {
                      setExpanded(active === i ? !expanded : true);
                      setActive(i);
                    }}
                  >
                    <item.icon size={20} aria-hidden="true" />
                    <span>{item.title}</span>
                    {active === i && expanded ? (
                      <Minus size={18} />
                    ) : (
                      <Plus size={18} />
                    )}
                  </button>
                </h3>
                <div
                  id={`workflow-content-${i}`}
                  role="region"
                  aria-labelledby={`workflow-trigger-${i}`}
                  hidden={active !== i || !expanded}
                  className="workflow-item-body"
                >
                  <p>{item.body}</p>
                  <Link href={item.href} className="landing-text-link">
                    {item.link}
                    <ArrowUpRight size={15} />
                  </Link>
                </div>
              </div>
            ))}
          </LandingReveal>
          <LandingReveal className="workflow-diagram">
            <div className="workflow-brand">
              <LogoIcon size={30} />
              <span>Kolvex</span>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={active}
                className="workflow-diagram-content"
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: landingEase }}
              >
                <div className="workflow-nodes">
                  {feature.nodes.map((node, i) => {
                    const Icon = feature.nodeIcons[i];
                    return (
                      <div key={node} className="workflow-node-wrap">
                        <div className="workflow-node">
                          <Icon size={26} strokeWidth={1.5} />
                          <span>{node}</span>
                        </div>
                        {i < 2 && (
                          <ArrowRight
                            className="workflow-node-arrow"
                            size={20}
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
                <p>{feature.note}</p>
              </motion.div>
            </AnimatePresence>
            <div className="workflow-diagram-base" aria-hidden="true" />
          </LandingReveal>
        </div>
      </div>
    </section>
  );
}
