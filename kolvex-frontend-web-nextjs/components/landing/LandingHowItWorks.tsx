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
        "Read technical evidence, published research and opposing views.",
        "阅读技术证据、已发布的研究报告与不同观点。",
      ),
    ],
    [
      c("Updates", "变化"),
      c("What changed?", "有什么变化？"),
      c(
        "See new creator views and how their direction changed from the previous update.",
        "直接查看博主的新观点，以及相较上一次更新的倾向变化。",
      ),
    ],
    [
      c("Holdings", "持仓"),
      c("How does this relate to my holdings?", "与我的持仓有什么关系？"),
      c(
        "Related creator updates appear alongside your linked brokerage holdings.",
        "根据已连接的券商持仓，查看相关股票的博主动态。",
      ),
    ],
  ];
  return (
    <section id="workflow" className="border-b border-border py-14 md:py-20">
      <div className="landing-width">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          {c("Information ready to read.", "打开即可查看的股票信息。")}
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
