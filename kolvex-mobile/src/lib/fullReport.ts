import type { TradingAnalysis } from "./contentTypes";
export type ReportLabels = {
  market: string;
  sentiment: string;
  news: string;
  fundamentals: string;
  investmentDebate: string;
  investmentPlan: string;
  traderPlan: string;
  riskDebate: string;
  finalSignal: string;
  bullResearcher: string;
  bearResearcher: string;
  aggressiveAnalyst: string;
  conservativeAnalyst: string;
  judgeDecision: string;
};
/** Who spoke in a debate field, by the same key rules as the Web export. */
export function debateSpeaker(
  key: string,
  bull: string,
  bear: string,
  judge: string,
) {
  if (key.includes("bull") || key.includes("aggressive")) return bull;
  if (key.includes("bear") || key.includes("conservative")) return bear;
  if (key.includes("judge")) return judge;
  return key;
}
function debateToMarkdown(
  debate: object | null | undefined,
  bull: string,
  bear: string,
  judge: string,
) {
  if (!debate) return "";
  const lines: string[] = [];
  for (const [key, value] of Object.entries(debate)) {
    if (!value) continue;
    lines.push(`### ${debateSpeaker(key, bull, bear, judge)}\n\n${value}\n`);
  }
  return lines.join("\n");
}
export function buildFullReport(item: TradingAnalysis, labels: ReportLabels) {
  const sections = [`# ${item.ticker} — ${item.trade_date}\n`];
  if (item.final_decision)
    sections.push(`**Decision: ${item.final_decision}**\n`);
  const reports: [string | null | undefined, string][] = [
    [item.market_report, labels.market],
    [item.sentiment_report, labels.sentiment],
    [item.news_report, labels.news],
    [item.fundamentals_report, labels.fundamentals],
  ];
  for (const [content, label] of reports)
    if (content) sections.push(`## ${label}\n\n${content}\n`);
  if (item.investment_debate)
    sections.push(
      `## ${labels.investmentDebate}\n\n${debateToMarkdown(item.investment_debate, labels.bullResearcher, labels.bearResearcher, labels.judgeDecision)}`,
    );
  if (item.investment_plan)
    sections.push(`## ${labels.investmentPlan}\n\n${item.investment_plan}\n`);
  if (item.trader_plan)
    sections.push(`## ${labels.traderPlan}\n\n${item.trader_plan}\n`);
  if (item.risk_debate)
    sections.push(
      `## ${labels.riskDebate}\n\n${debateToMarkdown(item.risk_debate, labels.aggressiveAnalyst, labels.conservativeAnalyst, labels.judgeDecision)}`,
    );
  if (item.full_signal)
    sections.push(`## ${labels.finalSignal}\n\n${item.full_signal}\n`);
  return sections.join("\n");
}
