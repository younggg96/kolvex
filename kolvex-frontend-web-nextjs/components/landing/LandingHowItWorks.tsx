"use client";
import { useCopy } from "@/components/decision/shared";
export default function LandingHowItWorks() {
  const c = useCopy();
  const steps = [
    [
      c("Research", "研究"),
      c("What is happening?", "发生了什么？"),
      c(
        "Creator opinions, price, news and fundamentals give an idea its context.",
        "通过创作者观点、价格、新闻与基本面，为想法建立背景。",
      ),
    ],
    [
      c("Analysis", "分析"),
      c("What does it mean?", "这意味着什么？"),
      c(
        "Validate your idea with technical evidence, deep research and opposing views.",
        "使用技术证据、深度研究与不同观点，检验自己的想法。",
      ),
    ],
    [
      c("Decision", "决策"),
      c("What will I do?", "我准备做什么？"),
      c(
        "Save your thesis, entry, target and the condition that would change your mind.",
        "保存投资判断、入场、目标，以及会让自己改变判断的条件。",
      ),
    ],
    [
      c("Review", "复盘"),
      c("Did my reasoning hold?", "我的理由仍然成立吗？"),
      c(
        "Revisit the evidence alongside your exposure and record what you learned.",
        "结合持仓重新检查证据，记录自己学到了什么。",
      ),
    ],
  ];
  return (
    <section id="workflow" className="border-b border-border py-14 md:py-20">
      <div className="landing-width">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          {c("A process you can return to.", "一个值得持续回顾的决策过程。")}
        </h2>
        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(([label, title, description], index) => (
            <article key={label} className="border-t-2 border-border pt-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-primary">{label}</p>
                <span className="text-xs text-muted-foreground">
                  {index + 1}
                </span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
