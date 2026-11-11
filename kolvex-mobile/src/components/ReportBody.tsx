import { useState } from "react";
import { Pressable, Share, View } from "react-native";
import { useTheme } from "../lib/theme";
import type { TradingAnalysis } from "../lib/contentTypes";
import { exportText } from "../lib/exportFile";
import { buildFullReport } from "../lib/fullReport";
import { useText } from "../lib/i18n";
import { useTranslated } from "../lib/useTranslated";
import { Button, Copy, Failure, Glass, Section } from "./UI";
import { TextBody } from "./Content";
import { TranslateToggle } from "./Translate";
function TranslatableSection({
  title,
  text,
  symbols,
}: {
  title: string;
  text: string;
  symbols: string[];
}) {
  const state = useTranslated(text);
  return (
    <Glass style={{ padding: 20, gap: 16 }}>
      <Section title={title} />
      <TextBody text={state.shown} symbols={symbols} />
      <TranslateToggle state={state} />
    </Glass>
  );
}
/**
 * The Web's DebateCard: the judge's verdict first on a tinted panel, then each side as
 * a collapsible panel. Running histories are left to the exported full report.
 */
function Debate({
  title,
  debate,
  bull,
  bear,
  symbols,
}: {
  title: string;
  debate: object;
  bull: string;
  bear: string;
  symbols: string[];
}) {
  const t = useTheme();
  const record = debate as Record<string, unknown>;
  const keys = Object.keys(record);
  const pick = (test: (key: string) => boolean) => {
    const key = keys.find(test);
    const value = key ? record[key] : null;
    return typeof value === "string" && value ? value : null;
  };
  const bullText = pick((k) => k.includes("bull") || k.includes("aggressive"));
  const bearText = pick(
    (k) => k.includes("bear") || k.includes("conservative"),
  );
  const judgeText = pick((k) => k.includes("judge"));
  if (!bullText && !bearText && !judgeText) return null;
  return (
    <Glass style={{ padding: 20, gap: 16 }}>
      <Section title={title} />
      {!!judgeText && (
        <View
          style={{
            gap: 12,
            padding: 16,
            borderRadius: 20,
            backgroundColor: t.wash,
          }}
        >
          <Copy bold>评审结论</Copy>
          <TextBody text={judgeText} symbols={symbols} />
        </View>
      )}
      {!!bullText && (
        <DebatePanel
          label={bull}
          text={bullText}
          tone={t.accent}
          symbols={symbols}
        />
      )}
      {!!bearText && (
        <DebatePanel
          label={bear}
          text={bearText}
          tone={t.negative}
          symbols={symbols}
        />
      )}
    </Glass>
  );
}
function DebatePanel({
  label,
  text,
  tone,
  symbols,
}: {
  label: string;
  text: string;
  tone: string;
  symbols: string[];
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: t.rim,
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          minHeight: 48,
          paddingHorizontal: 16,
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: tone,
          }}
        />
        <View style={{ flex: 1 }}>
          <Copy size={14} bold>
            {label}
          </Copy>
        </View>
        <Copy muted localize={false}>
          {open ? "⌃" : "⌄"}
        </Copy>
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <TextBody text={text} symbols={symbols} />
        </View>
      )}
    </View>
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
            symbols={[item.ticker]}
          />
        ) : null,
      )}
      {item.investment_debate && (
        <Debate
          title="多空讨论"
          debate={item.investment_debate}
          bull="多方研究员"
          bear="空方研究员"
          symbols={[item.ticker]}
        />
      )}
      {item.risk_debate && (
        <Debate
          title="风险讨论"
          debate={item.risk_debate}
          bull="激进分析师"
          bear="保守分析师"
          symbols={[item.ticker]}
        />
      )}
      <Copy muted size={12}>
        AI 研究可能存在错误，请结合原始资料核实，不构成投资建议。
      </Copy>
    </>
  );
}
