import { useState } from "react";
import { Share, View } from "react-native";
import type { TradingAnalysis } from "../lib/contentTypes";
import { exportText } from "../lib/exportFile";
import { buildFullReport, debateSpeaker } from "../lib/fullReport";
import { useText } from "../lib/i18n";
import { useTranslated } from "../lib/useTranslated";
import { Button, Copy, Failure, Glass, Section } from "./UI";
import { TextBody } from "./Content";
import { TranslateToggle } from "./Translate";
function TranslatableSection({ title, text }: { title: string; text: string }) {
  const state = useTranslated(text);
  return (
    <Glass style={{ padding: 20, gap: 16 }}>
      <Section title={title} />
      <TextBody text={state.shown} />
      <TranslateToggle state={state} />
    </Glass>
  );
}
function Debate({
  title,
  debate,
  bull,
  bear,
}: {
  title: string;
  debate: object;
  bull: string;
  bear: string;
}) {
  const text = useText();
  const entries = Object.entries(debate).filter(
    ([, value]) => typeof value === "string" && value,
  ) as [string, string][];
  if (!entries.length) return null;
  return (
    <Glass style={{ padding: 20, gap: 16 }}>
      <Section title={title} />
      {entries.map(([key, value]) => (
        <View key={key} style={{ gap: 8 }}>
          <Copy size={13} bold localize={false}>
            {text(debateSpeaker(key, bull, bear, "评审结论"))}
          </Copy>
          <TextBody text={value} />
        </View>
      ))}
    </Glass>
  );
}
function ReportActions({ item }: { item: TradingAnalysis }) {
  const text = useText();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const report = () =>
    buildFullReport(item, {
      market: text("市场分析"),
      sentiment: text("社交情绪"),
      news: text("新闻分析"),
      fundamentals: text("基本面"),
      investmentDebate: text("多空讨论"),
      investmentPlan: text("投资研究"),
      traderPlan: text("交易研究"),
      riskDebate: text("风险讨论"),
      finalSignal: text("完整信号"),
      bullResearcher: text("多方研究员"),
      bearResearcher: text("空方研究员"),
      aggressiveAnalyst: text("激进分析师"),
      conservativeAnalyst: text("保守分析师"),
      judgeDecision: text("评审结论"),
    });
  async function run(work: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Button
          disabled={busy}
          onPress={() =>
            void run(() =>
              Share.share({
                title: `${item.ticker} — ${item.trade_date}`,
                message: report(),
              }),
            )
          }
        >
          分享研究报告
        </Button>
        <Button
          disabled={busy}
          onPress={() =>
            void run(() =>
              exportText(
                `${item.ticker}_${item.trade_date}`,
                "md",
                "text/markdown",
                "net.daringfireball.markdown",
                report(),
              ),
            )
          }
        >
          导出完整报告
        </Button>
      </View>
      {failed && <Failure message="此环境无法导出或分享，请稍后重试。" />}
    </View>
  );
}
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
      <ReportActions item={item} />
      {sections.map(([key, title]) =>
        typeof item[key] === "string" && item[key] ? (
          <TranslatableSection
            key={key}
            title={title}
            text={item[key] as string}
          />
        ) : null,
      )}
      {item.investment_debate && (
        <Debate
          title="多空讨论"
          debate={item.investment_debate}
          bull="多方研究员"
          bear="空方研究员"
        />
      )}
      {item.risk_debate && (
        <Debate
          title="风险讨论"
          debate={item.risk_debate}
          bull="激进分析师"
          bear="保守分析师"
        />
      )}
      <Copy muted size={12}>
        AI 研究可能存在错误，请结合原始资料核实，不构成投资建议。
      </Copy>
    </>
  );
}
