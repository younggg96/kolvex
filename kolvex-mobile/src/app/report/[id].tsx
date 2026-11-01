import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../state/Auth";
import { report } from "../../lib/contentApi";
import { useResource } from "../../lib/useResource";
import { AuthGate, ResourceState, TextBody } from "../../components/Content";
import { Copy, Glass, Page, Section } from "../../components/UI";
import type { TradingAnalysis } from "../../lib/contentTypes";
export default function Report() {
  return (
    <AuthGate title="研究报告">
      <Reader />
    </AuthGate>
  );
}
function Reader() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth().session!.user.id;
  const resource = useResource(`${user}:${id}`, (signal) =>
    report(id, user, signal),
  );
  const item = resource.data;
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
    <Page
      title={item?.ticker ?? "研究报告"}
      subtitle={item?.trade_date}
      onRefresh={resource.refresh}
      refreshing={resource.loading && !!item}
    >
      <ResourceState resource={resource} empty={!item} message="报告不可用。" />
      {sections.map(([key, label]) =>
        typeof item?.[key] === "string" && item[key] ? (
          <Glass key={key} style={{ padding: 20, gap: 16 }}>
            <Section title={label} />
            <TextBody text={item[key] as string} />
          </Glass>
        ) : null,
      )}
      {item?.investment_debate && (
        <Glass style={{ padding: 20, gap: 12 }}>
          <Section title="多空讨论" />
          {[
            ["多方", item.investment_debate.bull_history],
            ["空方", item.investment_debate.bear_history],
            ["综合判断", item.investment_debate.judge_decision],
          ].map(([title, text]) =>
            text ? (
              <Glass key={title} style={{ padding: 16, gap: 12 }}>
                <Copy bold>{title}</Copy>
                <TextBody text={text} />
              </Glass>
            ) : null,
          )}
        </Glass>
      )}
      {item?.risk_debate && (
        <Glass style={{ padding: 20, gap: 12 }}>
          <Section title="风险讨论" />
          {[
            item.risk_debate.aggressive_history,
            item.risk_debate.conservative_history,
            item.risk_debate.neutral_history,
            item.risk_debate.judge_decision,
          ]
            .filter(Boolean)
            .map((text, i) => (
              <TextBody key={i} text={text} />
            ))}
        </Glass>
      )}
      <Copy size={12} muted>
        AI 研究仅供信息参考，不构成投资建议。
      </Copy>
    </Page>
  );
}
