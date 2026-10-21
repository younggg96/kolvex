"use client";

import Link from "next/link";
import { LandingParallax } from "./LandingScrollEffects";
import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import CompanyLogo from "@/components/ui/company-logo";
import { useCopy } from "@/components/decision/shared";

export default function LandingIntelligence() {
  const c = useCopy();
  const stocks = [
    {
      symbol: "NVDA",
      name: "NVIDIA",
      focus: c("AI demand", "AI 需求"),
      title: c("Strong demand. High expectations.", "强劲需求，高位预期。"),
      text: c(
        "Follow infrastructure spending alongside the valuation debate.",
        "关注基础设施支出，也关注估值分歧。",
      ),
    },
    {
      symbol: "TSLA",
      name: "Tesla",
      focus: c("Margins & deliveries", "利润率与交付"),
      title: c("Look beyond the delivery number.", "不止看交付数字。"),
      text: c(
        "Weigh volume, pricing and what creators see in the next catalyst.",
        "结合销量、定价与博主关注的下一个催化因素。",
      ),
    },
    {
      symbol: "AMD",
      name: "AMD",
      focus: c("Data center growth", "数据中心增长"),
      title: c("Where the growth needs to show up.", "增长需要在哪里兑现。"),
      text: c(
        "Connect the AI opportunity to execution and earnings quality.",
        "把 AI 机遇与执行力、盈利质量联系起来。",
      ),
    },
    {
      symbol: "PLTR",
      name: "Palantir",
      focus: c("Growth & valuation", "增长与估值"),
      title: c("The business. And the price of it.", "看业务，也看它的价格。"),
      text: c(
        "Compare commercial momentum with the assumptions in the price.",
        "对照商业化动能与价格中包含的假设。",
      ),
    },
  ];
  const questions = [
    [
      c("What changed today?", "今天有什么变化？"),
      c(
        "Start with the catalyst, then connect it to demand, earnings and the views around the stock.",
        "先了解催化因素，再把它与需求、盈利和个股观点联系起来。",
      ),
    ],
    [
      c("Where do the signals disagree?", "哪些信号存在分歧？"),
      c(
        "Positive momentum can coexist with valuation risk. Read the supporting case and the opposing argument together.",
        "积极的动能与估值风险可能同时存在。把支持逻辑与相反观点一起读。",
      ),
    ],
    [
      c("What risk should I watch?", "哪些风险值得关注？"),
      c(
        "Watch whether spending becomes revenue, whether margins hold, and whether price confirms the expected breakout.",
        "关注支出能否转化为收入、利润率能否保持，以及价格能否确认预期中的突破。",
      ),
    ],
  ];
  return (
    <>
      <section
        className="landing-section landing-curated"
        aria-labelledby="curated-title"
      >
        <div className="landing-width">
          <div className="landing-section-heading landing-heading-inline">
            <div>
              <h2 id="curated-title">
                {c("What deserves your attention.", "值得你关注的，不必太多。")}
              </h2>
              <p>
                {c(
                  "A few stocks. The questions that matter. See how Kolvex brings the context into focus.",
                  "几只股票，几个关键问题。看看 Kolvex 如何梳理值得关注的背景。",
                )}
              </p>
            </div>
            <Link href="/stocks" className="landing-text-link">
              {c("Explore stocks", "浏览股票")}
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="curated-stocks">
            {stocks.map((stock) => (
              <Link
                href={`/stocks/${stock.symbol}`}
                key={stock.symbol}
                className="curated-stock"
              >
                <div className="curated-stock-header">
                  <CompanyLogo symbol={stock.symbol} size="sm" />
                  <div>
                    <strong>{stock.symbol}</strong>
                    <small>{stock.name}</small>
                  </div>
                  <ArrowUpRight
                    size={17}
                    className="curated-arrow"
                    aria-hidden
                  />
                </div>
                <span className="curated-focus">{stock.focus}</span>
                <h3>{stock.title}</h3>
                <p>{stock.text}</p>
              </Link>
            ))}
          </div>
          <p className="landing-fine-print">
            {c(
              "Illustrative research themes, not a live market feed or investment recommendations.",
              "研究主题示例，非实时市场信息或投资建议。",
            )}
          </p>
        </div>
      </section>

      <section
        id="features"
        className="landing-section landing-portfolio"
        aria-labelledby="portfolio-title"
      >
        <div className="landing-width portfolio-layout">
          <div className="portfolio-copy">
            <h2 id="portfolio-title">
              {c(
                "The market is broad.\nYour context is personal.",
                "市场很广，\n你的关注更具体。",
              )}
            </h2>
            <p>
              {c(
                "Bring creator opinions and research closer to what you own. Connect your portfolio through Plaid to see your positions alongside the market context that affects them.",
                "让博主观点与研究更贴近你的持仓。通过 Plaid 连接投资组合，把持仓与相关的市场背景放在一起看。",
              )}
            </p>
            <ul>
              <li>
                {c(
                  "Holdings, allocation and performance in one place",
                  "集中查看持仓、配置与表现",
                )}
              </li>
              <li>
                {c(
                  "Creator coverage connected to your positions",
                  "对照持仓查看博主观点",
                )}
              </li>
              <li>
                {c(
                  "Portfolio analysis with your exposure in view",
                  "结合风险敞口分析投资组合",
                )}
              </li>
            </ul>
            <Link href="/dashboard/portfolio" className="landing-text-link">
              {c("Explore your portfolio context", "查看投资组合背景")}
              <ArrowRight size={16} />
            </Link>
          </div>
          <LandingParallax className="portfolio-context" distance={52}>
            <div className="portfolio-context-title">
              <h3>
                {c(
                  "From your holdings to the bigger picture",
                  "从你的持仓，看更大的背景",
                )}
              </h3>
              <span>{c("Example", "示例")}</span>
            </div>
            {stocks.slice(0, 3).map((stock, index) => (
              <div className="portfolio-context-row" key={stock.symbol}>
                <CompanyLogo symbol={stock.symbol} size="sm" />
                <div>
                  <strong>{stock.symbol}</strong>
                  <p>{stock.focus}</p>
                </div>
                <span>
                  {
                    [
                      c("Creator opinions", "博主观点"),
                      c("Research & risks", "研究与风险"),
                      c("Technical context", "技术背景"),
                    ][index]
                  }
                </span>
              </div>
            ))}
            <div className="portfolio-context-note">
              <p>
                {c(
                  "Your positions give the research a point of reference.",
                  "让持仓成为理解研究的参照。",
                )}
              </p>
            </div>
          </LandingParallax>
        </div>
      </section>

      <section
        className="landing-section landing-trust"
        aria-labelledby="trust-title"
      >
        <div className="landing-width trust-layout">
          <div>
            <h2 id="trust-title">
              {c(
                "A clearer view.\nA visible source.",
                "信息更清晰，\n来源看得见。",
              )}
            </h2>
            <p>
              {c(
                "Know what was reported, what a creator said, and what the analysis inferred. Keep the original context within reach as you form your own view.",
                "分清新闻报道、博主观点与分析解读。在形成自己的判断时，随时回到原始背景。",
              )}
            </p>
            <Link href="/creators" className="landing-text-link">
              {c("Explore source-linked opinions", "查看有来源的观点")}
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <ol className="source-ledger">
            {[
              [
                c("News", "市场新闻"),
                c(
                  "The reported event and original article",
                  "事件报道与原始文章",
                ),
              ],
              [
                c("Creator opinion", "博主观点"),
                c(
                  "The original video and the creator’s reasoning",
                  "原始视频与博主的判断依据",
                ),
              ],
              [
                c("Market data", "市场数据"),
                c(
                  "Price context and computed technical indicators",
                  "价格背景与计算得出的技术指标",
                ),
              ],
              [
                c("AI interpretation", "AI 解读"),
                c(
                  "The conclusion, assumptions and opposing arguments",
                  "结论、假设与相反观点",
                ),
              ],
            ].map(([title, desc]) => (
              <li key={title}>
                <div>
                  <strong>{title}</strong>
                  <p>{desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        className="landing-section landing-research"
        aria-labelledby="research-title"
      >
        <div className="landing-width research-layout">
          <div>
            <h2 id="research-title">
              {c(
                "Start with perspective.\nThen go deeper.",
                "先看清背景，\n再深入研究。",
              )}
            </h2>
            <p>
              {c(
                "Research organized around the questions a move raises. Read the conclusion, the evidence and the debate without starting from an empty chat box.",
                "围绕行情引发的问题阅读研究。先看结论，再看依据与讨论，不必面对空白对话框从头提问。",
              )}
            </p>
            <Link href="/research" className="landing-text-link">
              {c("Explore AI research", "探索 AI 研究")}
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <LandingParallax className="research-questions" distance={32}>
            <p className="research-example">
              NVDA{" "}
              <span>
                {c("Illustrative research questions", "研究问题示例")}
              </span>
            </p>
            {questions.map(([question, answer], i) => (
              <details key={question} open={i === 0}>
                <summary>
                  {question}
                  <ChevronDown size={18} aria-hidden />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </LandingParallax>
        </div>
      </section>
    </>
  );
}
