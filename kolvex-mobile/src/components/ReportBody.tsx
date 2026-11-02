import type { TradingAnalysis } from "../lib/contentTypes";
import { Glass, Section, Copy } from "./UI";
import { TextBody } from "./Content";
export function ReportBody({ item }: { item: TradingAnalysis }) {
  const sections: [keyof TradingAnalysis, string][] = [
    ["final_decision", "研究结论"],
    ["market_report", "市场分析"],
    ["news_report", "新闻分析"],
    ["sentiment_report", "社交情绪"],
    ["fundamentals_report", "基本面"],
    ["investment_plan", "投资研究"],
    ["trader_plan", "交易研究"],
    ["full_signal", "完整信号"],
  ];
  return (
    <>
      {sections.map(([key, title]) =>
        typeof item[key] === "string" && item[key] ? (
          <Glass key={key} style={{ padding: 20, gap: 16 }}>
            <Section title={title} />
            <TextBody text={item[key] as string} />
          </Glass>
        ) : null,
      )}
      {[item.investment_debate, item.risk_debate].map((debate, i) =>
        debate ? (
          <Glass key={i} style={{ padding: 20, gap: 16 }}>
            <Section title={i === 0 ? "多空讨论" : "风险讨论"} />
            {Object.entries(debate)
              .filter(([, v]) => typeof v === "string" && v)
              .map(([key, text]) => (
                <TextBody key={key} text={text} />
              ))}
          </Glass>
        ) : null,
      )}
      <Copy muted size={12}>
        AI 研究可能存在错误，请结合原始资料核实，不构成投资建议。
      </Copy>
    </>
  );
}
