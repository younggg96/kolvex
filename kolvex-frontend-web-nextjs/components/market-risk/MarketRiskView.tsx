"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Check,
  CircleDashed,
  Clock,
  Minus,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCopy } from "@/components/decision/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import { withSign } from "@/lib/format";
import {
  HISTORY_RANGES,
  STAGE_ORDER,
  fetchMarketRiskHistory,
  fetchMarketRiskLatest,
  formatMetric,
  levelTone,
  metricChange,
  stageSpans,
  stageTone,
  statusTone,
  termStructureShape,
  type ChecklistItem,
  type HistoryRange,
  type MarketRiskHistory,
  type MarketRiskLatest,
  type MetricRow,
  type RiskLevel,
  type RiskStage,
} from "@/lib/marketRisk";
import { cn } from "@/lib/utils";

type Copy = ReturnType<typeof useCopy>;
type Tone = "positive" | "warning" | "negative" | "muted";

const TONE_TEXT: Record<Tone, string> = {
  positive: "text-positive",
  warning: "text-warning",
  negative: "text-negative",
  muted: "text-muted-foreground",
};
/*
 * Colour is spent in one place: the current level / stage (score number, stage name, the current
 * stretch of the stage strip). Everything else is neutral and ordered by weight, so chips, gauges
 * and chart fills read calm → stressed as light → dark, and their text says which is which.
 */
const TONE_CHIP: Record<Tone, string> = {
  positive: "border-foreground/15 text-muted-foreground",
  muted: "border-foreground/15 text-muted-foreground",
  warning: "border-foreground/25 text-foreground",
  negative: "border-foreground/40 bg-foreground/[0.07] font-semibold text-foreground",
};
/** Stage weight on the neutral ladder (foreground opacity): stable lightest, acceleration darkest. */
const STAGE_WEIGHT: Record<RiskStage, number> = {
  stable: 0.1,
  post_stress_normalization: 0.18,
  stress_build_up: 0.28,
  stress_acceleration: 0.42,
};
const stageGray = (stage: RiskStage, scale = 1) =>
  `rgb(var(--foreground) / ${(STAGE_WEIGHT[stage] * scale).toFixed(3)})`;

function useDate() {
  const { locale } = useTranslation();
  const intl = locale === "zh" ? "zh-CN" : "en-US";
  return (value: string | null | undefined, short = false) =>
    value
      ? new Date(`${value.slice(0, 10)}T12:00:00Z`).toLocaleDateString(intl, {
          timeZone: "UTC",
          year: short ? undefined : "numeric",
          month: "short",
          day: "numeric",
        })
      : "—";
}

export function stageCopy(stage: RiskStage, c: Copy) {
  switch (stage) {
    case "stable":
      return {
        label: c("Stable", "平稳"),
        description: c("No broad, sustained stress signals.", "没有持续、广泛的压力信号。"),
        Icon: ShieldCheck,
      };
    case "stress_build_up":
      return {
        label: c("Stress build-up", "压力积累"),
        description: c("Risk gauges are clearly rising.", "风险指标明显升高。"),
        Icon: TrendingUp,
      };
    case "stress_acceleration":
      return {
        label: c("Stress acceleration", "压力加速"),
        description: c("Several stress gauges are high at once.", "多个压力指标同时处于高位。"),
        Icon: ShieldAlert,
      };
    default:
      return {
        label: c("Post-stress normalization", "压力后修复"),
        description: c("Stress is easing from a recent peak.", "压力正从近期高点回落。"),
        Icon: TrendingDown,
      };
  }
}

function levelLabel(level: RiskLevel, c: Copy) {
  return {
    low: c("Low", "低"),
    moderate: c("Moderate", "中等"),
    elevated: c("Elevated", "偏高"),
    high: c("High", "高"),
    extreme: c("Extreme", "极高"),
  }[level];
}

function metricName(row: Pick<MetricRow, "metric_key">, c: Copy) {
  return (
    {
      vix: "VIX",
      vvix: "VVIX",
      vix9d: "VIX9D",
      vix3m: "VIX3M",
      vix9d_vix_ratio: "VIX9D / VIX",
      vix_vix3m_ratio: "VIX / VIX3M",
    }[row.metric_key] ?? row.metric_key
  );
}

function conditionLabel(key: string, c: Copy) {
  return (
    {
      vix_above_28: c("VIX above 28", "VIX 高于 28"),
      vvix_above_110: c("VVIX above 110", "VVIX 高于 110"),
      vix9d_vix_above_1: c("VIX9D / VIX above 1", "VIX9D / VIX 高于 1"),
      vix_vix3m_above_1: c("VIX / VIX3M above 1", "VIX / VIX3M 高于 1"),
      vvix_below_110: c("VVIX below 110", "VVIX 低于 110"),
      vix_vix3m_below_1: c("VIX / VIX3M below 1", "VIX / VIX3M 低于 1"),
      vix9d_vix_below_1: c("VIX9D / VIX below 1", "VIX9D / VIX 低于 1"),
    }[key] ?? key
  );
}

function ruleCopy(item: ChecklistItem, c: Copy) {
  return (
    {
      "RISK-001": [
        c("Volatility stress", "波动率压力"),
        c("VIX > 28 and VVIX > 110", "VIX > 28 且 VVIX > 110"),
      ],
      "RISK-002": [c("Term structure inverted", "期限结构倒挂"), "VIX / VIX3M > 1"],
      "RISK-003": [c("Short-term volatility stress", "短期波动率压力"), "VIX9D / VIX > 1"],
      "RISK-004": [
        c("Put/call spread", "Put/Call 扩散"),
        c("Not in model v1.0", "v1.0 模型未纳入"),
      ],
      "RECOVERY-001": [c("VVIX back below alert line", "VVIX 回到警戒线下"), "VVIX < 110"],
      "RECOVERY-002": [c("Term structure normal", "期限结构恢复正常"), "VIX / VIX3M < 1"],
      "RECOVERY-003": [c("Short-term stress eased", "短期压力缓解"), "VIX9D / VIX < 1"],
      "RECOVERY-004": [
        c("Score off its peak", "评分从高点回落"),
        c("15+ below the 20-session peak", "比近 20 个交易日高点低 15 分以上"),
      ],
    }[item.rule_key] ?? [item.rule_key, ""]
  );
}

function Chip({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE_CHIP[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

function Status({ text, retry, loading }: { text: string; retry?: () => void; loading?: boolean }) {
  const c = useCopy();
  return (
    <div
      role={retry && !loading ? "alert" : "status"}
      className="space-y-3 rounded-2xl bg-muted/40 p-5"
    >
      <p className="text-sm text-muted-foreground">{text}</p>
      {retry && !loading && (
        <Button variant="outline" size="sm" onClick={retry}>
          {c("Retry", "重试")}
        </Button>
      )}
    </div>
  );
}

/** Loads the latest evaluation and its history; failures are shown, never replaced. */
export function MarketRiskView() {
  const c = useCopy();
  const [latest, setLatest] = useState<MarketRiskLatest | null>(null);
  const [latestError, setLatestError] = useState<string | null>(null);
  const [range, setRange] = useState<HistoryRange>("1Y");
  const [history, setHistory] = useState<MarketRiskHistory | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [slow, setSlow] = useState(false);

  const loadLatest = useCallback(() => {
    setLatestError(null);
    fetchMarketRiskLatest()
      .then(setLatest)
      .catch((err) => setLatestError(err?.code || err?.message || "error"));
  }, []);

  useEffect(() => {
    loadLatest();
    const timer = setTimeout(() => setSlow(true), 300);
    return () => clearTimeout(timer);
  }, [loadLatest]);

  const loadHistory = useCallback(() => {
    setHistoryError(false);
    fetchMarketRiskHistory(range)
      .then(setHistory)
      .catch(() => setHistoryError(true));
  }, [range]);
  useEffect(loadHistory, [loadHistory]);

  if (latestError) {
    return (
      <Status
        text={
          latestError === "no_score"
            ? c("No risk score has been published yet.", "还没有发布风险评分。")
            : c(
                "Market risk data failed to load. No score is shown in its place.",
                "市场风险数据加载失败，不显示替代数值。",
              )
        }
        retry={loadLatest}
      />
    );
  }
  if (!latest) {
    return slow ? <Status loading text={c("Loading market risk…", "正在加载市场风险…")} /> : null;
  }
  return (
    <MarketRiskContent
      latest={latest}
      history={history}
      historyError={historyError}
      range={range}
      onRange={setRange}
      onRetryHistory={loadHistory}
    />
  );
}

export function MarketRiskContent({
  latest,
  history,
  historyError,
  range,
  onRange,
  onRetryHistory,
}: {
  latest: MarketRiskLatest;
  history: MarketRiskHistory | null;
  historyError: boolean;
  range: HistoryRange;
  onRange: (range: HistoryRange) => void;
  onRetryHistory: () => void;
}) {
  const c = useCopy();
  const date = useDate();
  return (
    <div className="space-y-8">
      <DataStatus latest={latest} />
      {/* One panel split by a rule: the score and the stage it puts the market in are read together. */}
      <Card className="grid divide-y divide-border overflow-hidden md:grid-cols-2 md:divide-x md:divide-y-0">
        <ScoreCard latest={latest} />
        <StageCard latest={latest} />
      </Card>
      <StageTimeline latest={latest} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <TermStructure latest={latest} />
        <Metrics latest={latest} />
      </div>
      <Checklist latest={latest} />
      <HistorySection
        history={history}
        error={historyError}
        range={range}
        onRange={onRange}
        onRetry={onRetryHistory}
      />
      <footer className="space-y-1 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
        <p>
          {c(
            "Model estimate, not yet validated by backtests. Not investment advice. Levels describe stress, not the odds of a decline.",
            "模型估算，尚未经回测充分验证，不构成投资建议。等级描述压力程度，不代表下跌概率。",
          )}
        </p>
        <p className="figure flex flex-wrap gap-x-4">
          <span>{c("Cboe daily closes", "Cboe 日终收盘")}</span>
          <span>
            {c("Data through", "数据截至")} {date(latest.as_of)}
          </span>
          <span>
            {c("Model", "模型")} {latest.model_version}
          </span>
        </p>
      </footer>
    </div>
  );
}

function DataStatus({ latest }: { latest: MarketRiskLatest }) {
  const c = useCopy();
  const date = useDate();
  const errors = Object.keys(latest.source_errors);
  const tone: Tone =
    latest.freshness === "fresh"
      ? "positive"
      : latest.freshness === "delayed"
        ? "warning"
        : "negative";
  const label = {
    fresh: c("End of day", "日终"),
    delayed: c("Awaiting update", "待更新"),
    stale: c("Stale", "已过期"),
  }[latest.freshness];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
      <Chip tone={tone}>
        <Clock className="h-3.5 w-3.5" aria-hidden />
        {label}
      </Chip>
      <span className="figure">
        {c("As of", "截至")} {date(latest.as_of)}
      </span>
      {latest.unscored_latest_date && (
        <span className="text-warning">
          {c(
            `${date(latest.unscored_latest_date)} is incomplete and not scored`,
            `${date(latest.unscored_latest_date)} 数据不全，未评分`,
          )}
        </span>
      )}
      {errors.length > 0 && (
        <span className="text-negative">
          {c("Source failed:", "来源失败：")}{" "}
          {errors.map((k) => metricName({ metric_key: k }, c)).join(", ")}
        </span>
      )}
      {latest.data_source === "live" && (
        <Chip tone="muted">{c("Read directly from Cboe", "直接读取 Cboe")}</Chip>
      )}
    </div>
  );
}

const TONE_BG: Record<Tone, string> = {
  positive: "bg-positive",
  warning: "bg-warning",
  negative: "bg-negative",
  muted: "bg-foreground",
};
/** Level bands of the 0–100 score, matching the backend (<40 low … ≥90 extreme). */
const LEVEL_BANDS: { level: RiskLevel; from: number; to: number }[] = [
  { level: "low", from: 0, to: 40 },
  { level: "moderate", from: 40, to: 60 },
  { level: "elevated", from: 60, to: 75 },
  { level: "high", from: 75, to: 90 },
  { level: "extreme", from: 90, to: 100 },
];
const LEVEL_FILL = [0.07, 0.12, 0.2, 0.3, 0.42];

/** The score on its own 0–100 scale: the level bands, today's position and the prior session's. */
function ScoreScale({ latest }: { latest: MarketRiskLatest }) {
  const c = useCopy();
  const { score } = latest;
  const tone = levelTone(score.level);
  const clamp = (value: number) => Math.min(100, Math.max(0, value));
  const band = LEVEL_BANDS.find((item) => item.level === score.level);
  return (
    <div
      role="img"
      aria-label={c(
        `Score ${score.value.toFixed(1)} on a 0–100 scale, in the ${levelLabel(score.level, c)} band${band ? ` (${band.from}–${band.to})` : ""}`,
        `评分 ${score.value.toFixed(1)}（0–100），位于${levelLabel(score.level, c)}区间${band ? `（${band.from}–${band.to}）` : ""}`,
      )}
    >
      <div className="relative">
        <div className="flex h-2.5 gap-px overflow-hidden rounded-full">
          {LEVEL_BANDS.map((item, i) => (
            <span
              key={item.level}
              style={{
                width: `${item.to - item.from}%`,
                background: `rgb(var(--foreground) / ${LEVEL_FILL[i]})`,
              }}
            />
          ))}
        </div>
        {score.previous_value !== null && (
          <span
            className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground"
            style={{ left: `${clamp(score.previous_value)}%` }}
          />
        )}
        <span
          className={cn(
            "absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card",
            TONE_BG[tone],
          )}
          style={{ left: `${clamp(score.value)}%` }}
        />
      </div>
      <div className="mt-2 flex text-[0.6875rem] leading-4" aria-hidden>
        {LEVEL_BANDS.map((item) => {
          const current = item.level === score.level;
          return (
            <span
              key={item.level}
              className={cn(
                "min-w-0 truncate border-l border-border pl-1.5 first:border-l-0 first:pl-0",
                current ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
              style={{ width: `${item.to - item.from}%` }}
            >
              <span className="figure block">{item.from}</span>
              {levelLabel(item.level, c)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function ScoreCard({ latest }: { latest: MarketRiskLatest }) {
  const c = useCopy();
  const date = useDate();
  const { score } = latest;
  const tone = levelTone(score.level);
  const change = score.previous_value === null ? null : score.value - score.previous_value;
  const top = [...score.components].sort((a, b) => b.contribution - a.contribution);
  const dimension = (key: string) =>
    ({
      volatility_level: c("Volatility level", "波动率水平"),
      volatility_of_volatility: c("Volatility of volatility", "波动率的波动"),
      term_structure: c("Term structure", "期限结构"),
    })[key] ?? key;
  return (
    <section className="min-w-0 space-y-5 p-5 sm:p-6">
      <div className="flex items-center gap-1.5">
        <h2 className="text-base font-semibold">{c("Market stress score", "市场压力评分")}</h2>
        <InfoTip label={c("How the score works", "评分说明")}>
          {c(
            `Each input is ranked against its own last ${score.history_window} sessions (at least ${score.min_history}); the score is their weighted average, 0–100. It is relative: a high score means high versus the recent past, not a fixed VIX level. Put/call and tail risk are not in v1.0.`,
            `每个指标与自身过去 ${score.history_window} 个交易日（至少 ${score.min_history} 个）比较得到分位数，再加权平均为 0–100。这是相对评分：分高表示比近几年高，不对应某个固定的 VIX 数值。v1.0 不含 Put/Call 和尾部风险。`,
          )}
        </InfoTip>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={cn(
            "figure text-5xl font-semibold leading-none tracking-tight",
            TONE_TEXT[tone],
          )}
        >
          {score.value.toFixed(1)}
        </span>
        <span className={cn("text-lg font-semibold", TONE_TEXT[tone])}>
          {levelLabel(score.level, c)}
        </span>
        {change !== null && (
          <span className="figure text-sm text-muted-foreground">
            {c(
              `${withSign(change, (m) => m.toFixed(1), { digits: 1 })} from ${date(score.previous_date, true)}`,
              `较 ${date(score.previous_date, true)} ${withSign(change, (m) => m.toFixed(1), { digits: 1 })}`,
            )}
          </span>
        )}
      </div>
      {score.confidence === "partial" && (
        <p className="text-sm text-warning">
          {c(
            `Partial score: ${Math.round(score.coverage * 100)}% of inputs`,
            `部分评分：覆盖 ${Math.round(score.coverage * 100)}% 的指标`,
          )}
        </p>
      )}
      <ScoreScale latest={latest} />
      <table className="w-full text-sm">
        <caption className="sr-only">{c("Score contributions", "评分构成")}</caption>
        <thead>
          <tr className="text-left text-[0.6875rem] text-muted-foreground">
            <th scope="col" className="pb-1.5 font-normal">
              {c("Input", "指标")}
            </th>
            <th scope="col" className="pb-1.5 text-right font-normal">
              {c("Weight", "权重")}
            </th>
            <th scope="col" className="pb-1.5 text-right font-normal">
              {c("Percentile", "分位")}
            </th>
            <th scope="col" className="pb-1.5 text-right font-normal">
              {c("Points", "贡献")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border border-t border-border">
          {top.map((component) => (
            <tr key={component.metric_key}>
              <th scope="row" className="py-2 pr-3 text-left font-normal">
                <span className="font-medium">{metricName(component, c)}</span>
                <span className="block text-xs text-muted-foreground">
                  {dimension(component.dimension)}
                </span>
              </th>
              <td className="figure py-2 text-right text-muted-foreground">
                {Math.round(component.weight * 100)}%
              </td>
              <td className="figure py-2 pl-3 text-right">{component.percentile.toFixed(0)}</td>
              <td className="figure py-2 pl-3 text-right font-medium">
                +{component.contribution.toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function StageCard({ latest }: { latest: MarketRiskLatest }) {
  const c = useCopy();
  const date = useDate();
  const { stage } = latest;
  const meta = stageCopy(stage.current, c);
  const tone = stageTone(stage.current);
  const conditions = Object.entries(stage.stress_conditions);
  const met = conditions.filter(([, value]) => value === true).length;
  const days = daysBetween(stage.since, latest.as_of);
  return (
    <section className="min-w-0 space-y-4 p-5 sm:p-6">
      <div className="flex items-center gap-1.5">
        <h2 className="text-base font-semibold">{c("Risk stage", "风险阶段")}</h2>
        <InfoTip label={c("How stages change", "阶段如何切换")}>
          {c(
            `Build-up from a score of ${stage.rules.build_up_enter} (back to stable below ${stage.rules.build_up_exit}). Acceleration needs ${stage.rules.acceleration_enter}+ and at least ${stage.rules.min_stress_conditions} of the stress conditions. Normalization: ${stage.rules.peak_drop}+ below the ${stage.rules.peak_window}-session peak with ${stage.rules.min_recovery_conditions} recovery conditions. Every change needs ${stage.rules.confirm_sessions} sessions in a row (${stage.rules.confirm_normalized_to_stable} to return to stable). Initial rules, not yet backtested.`,
            `评分达到 ${stage.rules.build_up_enter} 进入压力积累（低于 ${stage.rules.build_up_exit} 回到平稳）。压力加速需要 ${stage.rules.acceleration_enter} 分以上且至少 ${stage.rules.min_stress_conditions} 个压力条件成立。压力后修复：比近 ${stage.rules.peak_window} 个交易日高点低 ${stage.rules.peak_drop} 分以上，且 ${stage.rules.min_recovery_conditions} 个修复条件成立。每次切换需连续 ${stage.rules.confirm_sessions} 个交易日确认（回到平稳需 ${stage.rules.confirm_normalized_to_stable} 个）。初始规则，尚未回测。`,
          )}
        </InfoTip>
      </div>
      <div className="space-y-1">
        <p className={cn("flex items-center gap-2 text-2xl font-semibold", TONE_TEXT[tone])}>
          <meta.Icon className="h-6 w-6" aria-hidden />
          {meta.label}
        </p>
        <p className="figure text-sm text-muted-foreground">
          {c(`Since ${date(stage.since)}`, `始于 ${date(stage.since)}`)}
          {days !== null && c(`, ${days} days so far`, `，已持续 ${days} 天`)}
        </p>
      </div>
      {stage.pending && (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CircleDashed className="h-4 w-4" aria-hidden />
          {c(
            `Pending: ${stageCopy(stage.pending, c).label} (${stage.pending_sessions}/${stage.sessions_to_confirm} sessions)`,
            `待确认：${stageCopy(stage.pending, c).label}（${stage.pending_sessions}/${stage.sessions_to_confirm} 个交易日）`,
          )}
        </p>
      )}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          {c(
            `Stress conditions: ${met} of ${conditions.length} met`,
            `压力条件：${conditions.length} 条中 ${met} 条成立`,
          )}
        </h3>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {conditions.map(([key, isMet]) => (
            <li key={key} className="flex items-center gap-2 text-sm">
              {isMet === null ? (
                <Minus
                  className="h-4 w-4 text-muted-foreground"
                  aria-label={c("No data", "无数据")}
                />
              ) : isMet ? (
                <AlertTriangle className="h-4 w-4 text-foreground" aria-label={c("Met", "成立")} />
              ) : (
                <Check
                  className="h-4 w-4 text-muted-foreground"
                  aria-label={c("Not met", "未成立")}
                />
              )}
              <span className={isMet ? "text-foreground" : "text-muted-foreground"}>
                {conditionLabel(key, c)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// Strip fills: past stretches are quiet, the current one is solid. Swatches in the key match.
// Only the current stretch carries the stage colour; past stretches sit on the neutral ladder.
const STAGE_NOW: Record<RiskStage, string> = {
  stable: "bg-positive text-background",
  stress_build_up: "bg-warning text-background",
  stress_acceleration: "bg-negative text-background",
  post_stress_normalization: "bg-foreground/70 text-background",
};

/** Whole calendar days from `from` to `to` (both YYYY-MM-DD…). */
function daysBetween(from: string, to: string) {
  const start = Date.parse(`${from.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${to.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(0, Math.round((end - start) / 86_400_000))
    : null;
}

/** Stage stretches from the recorded switches up to the evaluation date, oldest first. */
function stageStretches(latest: MarketRiskLatest) {
  const switches = [...latest.recent_events]
    .filter((event) => event.effective_date <= latest.as_of)
    .sort((a, b) => a.effective_date.localeCompare(b.effective_date));
  if (!switches.length || switches[switches.length - 1].new_stage !== latest.stage.current)
    switches.push({
      effective_date: latest.stage.since,
      previous_stage: null,
      new_stage: latest.stage.current,
      risk_score: null,
      rules: [],
    });
  return switches.map((event, i) => ({
    stage: event.new_stage,
    start: event.effective_date,
    end: switches[i + 1]?.effective_date ?? latest.as_of,
  }));
}

/**
 * The stages as time actually spent in them: a strip from the first recorded switch to the latest
 * close, each stretch as wide as it lasted, then a key that says what each stage means.
 */
function StageTimeline({ latest }: { latest: MarketRiskLatest }) {
  const c = useCopy();
  const date = useDate();
  const { stage } = latest;
  const meta = stageCopy(stage.current, c);
  const days = daysBetween(stage.since, latest.as_of);
  const stretches = stageStretches(latest);
  const from = stretches[0].start;
  const total = Math.max(1, daysBetween(from, latest.as_of) ?? 1);
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-1.5 text-lg font-semibold">
        {c("Stages", "四个阶段")}
        <InfoTip label={c("About the stages", "阶段说明")}>
          {c(
            "Stress usually moves stable → build-up → acceleration → normalization, then back to stable. It can also step back early, e.g. from build-up straight to stable. The strip shows the switches recorded so far.",
            "压力通常按 平稳 → 压力积累 → 压力加速 → 压力后修复 → 平稳 的顺序变化，也可能中途回退（例如压力积累直接回到平稳）。色带显示目前记录到的阶段切换。",
          )}
        </InfoTip>
      </h2>

      <Card className="space-y-5 p-5 sm:p-6">
        <div>
          <ol
            className="flex h-9 gap-0.5 overflow-hidden rounded-lg bg-card"
            aria-label={c("Stage history", "阶段历史")}
          >
            {stretches.map((stretch, i) => {
              const now = i === stretches.length - 1;
              const span = Math.max(1, daysBetween(stretch.start, stretch.end) ?? 1);
              const share = (span / total) * 100;
              const label = stageCopy(stretch.stage, c).label;
              const range = `${date(stretch.start, true)} – ${now ? c("now", "至今") : date(stretch.end, true)}`;
              return (
                <li
                  key={`${stretch.stage}-${stretch.start}`}
                  title={`${label} ${range}`}
                  className={cn(
                    "flex min-w-[6px] items-center overflow-hidden px-2 text-xs font-medium",
                    now ? STAGE_NOW[stretch.stage] : "text-foreground/80",
                  )}
                  style={{
                    flexGrow: share,
                    flexBasis: 0,
                    background: now ? undefined : stageGray(stretch.stage),
                  }}
                >
                  <span className="sr-only">
                    {label} {range}
                  </span>
                  {share >= 14 && (
                    <span aria-hidden className="truncate">
                      {label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <div
            className="figure mt-1.5 flex justify-between text-[0.6875rem] text-muted-foreground"
            aria-hidden
          >
            <span>{date(from, true)}</span>
            <span>{date(latest.as_of, true)}</span>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-5 gap-y-4 lg:grid-cols-4">
          {STAGE_ORDER.map((key) => {
            const item = stageCopy(key, c);
            const current = key === stage.current;
            return (
              <div
                key={key}
                className={cn("border-t-2 pt-2.5", current ? "border-foreground" : "border-border")}
              >
                <dt className="flex items-center gap-2 text-sm font-semibold">
                  <span
                    className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", current && STAGE_NOW[key])}
                    style={current ? undefined : { background: stageGray(key) }}
                    aria-hidden
                  />
                  <span className={current ? TONE_TEXT[stageTone(key)] : undefined}>
                    {item.label}
                  </span>
                  {current && <span className="sr-only">{c("(current)", "（当前）")}</span>}
                </dt>
                <dd className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</dd>
              </div>
            );
          })}
        </dl>
      </Card>
    </section>
  );
}

/** Plain reading of the curve: is the 30-day index above or below the 3-month one? */
function termReading(
  shape: ReturnType<typeof termStructureShape>,
  c: Copy,
): { title: string; body: string } | null {
  if (shape === "backwardation")
    return {
      title: c("Inverted", "倒挂"),
      body: c(
        "30-day volatility is above 3-month: the market is more worried about the next few weeks than the months after.",
        "30 天波动率高于 3 个月：市场对未来几周的担心大于更远的将来。",
      ),
    };
  if (shape === "contango")
    return {
      title: c("Normal", "正常"),
      body: c(
        "30-day volatility is below 3-month: the curve slopes up as usual; no special near-term worry.",
        "30 天波动率低于 3 个月：曲线正常向上倾斜，市场没有特别担心短期。",
      ),
    };
  if (shape === "flat")
    return {
      title: c("Flat", "持平"),
      body: c("30-day and 3-month volatility are about equal.", "30 天与 3 个月波动率基本持平。"),
    };
  return null;
}

function TermStructure({ latest }: { latest: MarketRiskLatest }) {
  const c = useCopy();
  const date = useDate();
  const row = (key: string) => latest.metrics.find((m) => m.metric_key === key);
  const legs = (["vix9d", "vix", "vix3m"] as const).map((key) => row(key));
  const names = [c("9D", "9天"), c("30D", "30天"), c("3M", "3个月")];
  const data = legs.map((m, i) => ({
    name: names[i],
    today: m?.value ?? null,
    prior: m?.previous_value ?? null,
  }));
  const shape = termStructureShape(row("vix")?.value, row("vix3m")?.value);
  const reading = termReading(shape, c);
  const inverted = shape === "backwardation";
  const todayColor = "rgb(var(--foreground))";
  const prior = row("vix")?.previous_date;
  return (
    <Card className="min-w-0 space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-base font-semibold">
          {c("Volatility curve", "波动率期限结构")}
          <InfoTip label={c("About the term structure", "期限结构说明")}>
            {c(
              "Cboe's 9-day, 30-day (VIX) and 3-month implied volatility indexes, i.e. how much movement options price in over each horizon. Normally the curve slopes up; when near-term is above longer-term (inverted), the market is paying up for short-term protection. These are index values, not VIX futures.",
              "Cboe 的 9 天、30 天（VIX）与 3 个月隐含波动率指数，即期权市场对不同期限内波动幅度的定价。正常时曲线向上倾斜；短期高于长期（倒挂）说明市场在为近期保护付出更高价格。这里是指数值，不是 VIX 期货。",
            )}
          </InfoTip>
        </h2>
        {reading && (
          <Chip tone={inverted ? "negative" : "muted"}>
            {inverted && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
            {reading.title}
          </Chip>
        )}
      </div>
      {reading && <p className="text-sm leading-6 text-foreground/90">{reading.body}</p>}
      <div className="h-44 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 22, right: 24, bottom: 0, left: 24 }}
            accessibilityLayer
          >
            <CartesianGrid vertical={false} stroke="rgb(var(--border))" />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              interval={0}
              padding={{ left: 8, right: 8 }}
              tick={{ fill: "rgb(var(--muted-foreground))", fontSize: 12 }}
            />
            <YAxis hide domain={["dataMin - 2", "dataMax + 2"]} />
            <Tooltip
              cursor={{ stroke: "rgb(var(--border))" }}
              formatter={(value: number) => value?.toFixed(2)}
              contentStyle={{
                background: "rgb(var(--background))",
                color: "rgb(var(--foreground))",
                borderColor: "rgb(var(--border))",
                borderRadius: 12,
              }}
            />
            <Line
              dataKey="prior"
              name={prior ? date(prior, true) : c("Prior session", "上一交易日")}
              stroke="rgb(var(--muted-foreground))"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              dot={{ r: 3, fill: "rgb(var(--muted-foreground))", strokeWidth: 0 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="today"
              name={date(latest.as_of, true)}
              stroke={todayColor}
              strokeWidth={2.5}
              dot={{ r: 4, fill: todayColor, strokeWidth: 0 }}
              isAnimationActive={false}
            >
              <LabelList
                dataKey="today"
                position="top"
                offset={10}
                formatter={(value: number | null) => (value == null ? "" : value.toFixed(2))}
                style={{ fill: "rgb(var(--foreground))", fontSize: 12, fontWeight: 600 }}
              />
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-foreground" aria-hidden />
          {date(latest.as_of)}
        </span>
        {prior && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t border-dashed border-muted-foreground" aria-hidden />
            {date(prior)}
          </span>
        )}
      </p>
    </Card>
  );
}

function metricMeaning(key: string, c: Copy) {
  return (
    {
      vix: c("S&P 500 expected move, next 30 days", "标普 500 未来 30 天预期波动"),
      vvix: c("How unsettled VIX itself is", "VIX 自身的波动，恐慌是否不稳定"),
      vix9d: c("Expected move, next 9 days", "未来 9 天预期波动"),
      vix3m: c("Expected move, next 3 months", "未来 3 个月预期波动"),
      vix9d_vix_ratio: c(
        "9-day vs 30-day; above 1 = near-term stress",
        "9 天 ÷ 30 天，高于 1 表示短期更紧张",
      ),
      vix_vix3m_ratio: c(
        "30-day vs 3-month; above 1 = inverted",
        "30 天 ÷ 3 个月，高于 1 表示期限倒挂",
      ),
    }[key] ?? null
  );
}

const BAND_TONES: Tone[] = ["positive", "muted", "warning", "negative"];
// Bands on the neutral ladder, light → dark; the legend and the axis numbers name them.
const BAND_FILL: Record<Tone, string> = {
  positive: "bg-foreground/[0.08]",
  muted: "bg-foreground/[0.18]",
  warning: "bg-foreground/[0.32]",
  negative: "bg-foreground/[0.5]",
};

/**
 * Where a value sits against its fixed display bands: four zones (normal / watch / elevated /
 * critical) with a marker at the value. The scale pads 60% of the band span on each side.
 */
function BandGauge({ row, label }: { row: MetricRow; label: string }) {
  const bands = row.bands;
  if (!bands || row.value === null) return null;
  const span = bands[2] - bands[0];
  const min = bands[0] - span * 0.6;
  const max = bands[2] + span * 0.6;
  const at = (value: number) => Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const stops = [0, at(bands[0]), at(bands[1]), at(bands[2]), 100];
  const digits = row.unit === "ratio" ? 2 : 0;
  return (
    <div className="min-w-0" role="img" aria-label={label}>
      <div className="relative h-2">
        <div className="flex h-full overflow-hidden rounded-full">
          {BAND_TONES.map((tone, i) => (
            <span
              key={tone}
              className={BAND_FILL[tone]}
              style={{ width: `${stops[i + 1] - stops[i]}%` }}
            />
          ))}
        </div>
        <span
          className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground ring-2 ring-card"
          style={{ left: `${at(row.value)}%` }}
        />
      </div>
      <div className="figure relative mt-1 h-3.5 text-[0.625rem] text-muted-foreground" aria-hidden>
        {bands.map((band, i) => (
          <span key={i} className="absolute -translate-x-1/2" style={{ left: `${stops[i + 1]}%` }}>
            {band.toFixed(digits)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Metrics({ latest }: { latest: MarketRiskLatest }) {
  const c = useCopy();
  const date = useDate();
  const sessions = latest.score.history_window;
  const statusLabel = (status: MetricRow["status"]) =>
    status
      ? {
          normal: c("Normal", "正常"),
          watch: c("Watch", "观察"),
          elevated: c("Elevated", "偏高"),
          critical: c("Critical", "高压"),
        }[status]
      : null;
  return (
    <Card className="min-w-0 space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <h2 className="flex items-center gap-1.5 text-base font-semibold">
          {c("Indicators", "指标")}
          <InfoTip label={c("About indicator status", "指标状态说明")}>
            {c(
              `The bar shows where today's value sits in fixed bands (VIX: 20 / 28 / 35; VVIX: 100 / 110 / 120; ratios: 0.95 / 1.00 / 1.10). The percentile compares it with its own last ${sessions} sessions and is what the score uses, so the two can differ.`,
              `色条表示当前值落在哪个固定区间（VIX：20 / 28 / 35；VVIX：100 / 110 / 120；比值：0.95 / 1.00 / 1.10）。分位数是与自身过去 ${sessions} 个交易日比较，评分用的是分位数，所以两者可能不一致。`,
            )}
          </InfoTip>
        </h2>
        <ul
          className="flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] text-muted-foreground"
          aria-label={c("Bands", "区间")}
        >
          {BAND_TONES.map((tone, i) => (
            <li key={tone} className="inline-flex items-center gap-1">
              <span className={cn("h-2 w-2 rounded-full", BAND_FILL[tone])} aria-hidden />
              {
                [
                  c("Normal", "正常"),
                  c("Watch", "观察"),
                  c("Elevated", "偏高"),
                  c("Critical", "高压"),
                ][i]
              }
            </li>
          ))}
        </ul>
      </div>
      <ul className="divide-y divide-border">
        {latest.metrics.map((row) => {
          const change = metricChange(row);
          const digits = row.unit === "ratio" ? 3 : 2;
          const lagging = row.latest_date && row.latest_date !== latest.as_of;
          const name = metricName(row, c);
          const status = statusLabel(row.status);
          return (
            <li
              key={row.metric_key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(7rem,1fr)_auto]"
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2">
                  <span className="font-semibold">{name}</span>
                  {row.status && <Chip tone={statusTone(row.status)}>{status}</Chip>}
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  {metricMeaning(row.metric_key, c)}
                </p>
                <p className="figure text-[0.6875rem] leading-4 text-muted-foreground">
                  {row.percentile !== null
                    ? c(
                        `Higher than ${row.percentile.toFixed(0)}% of the last ${sessions} sessions`,
                        `高于过去 ${sessions} 个交易日中 ${row.percentile.toFixed(0)}% 的时候`,
                      )
                    : c("Not in the score", "不计入评分")}
                  {row.quality === "suspect" && (
                    <span className="text-warning"> · {c("Suspect value", "可疑值")}</span>
                  )}
                  {row.value === null && (
                    <span className="text-warning"> · {c("Missing", "缺失")}</span>
                  )}
                  {lagging && (
                    <span>
                      {" "}
                      · {c("Latest", "最新")} {date(row.latest_date)}
                    </span>
                  )}
                </p>
              </div>
              <div className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                <BandGauge
                  row={row}
                  label={c(
                    `${name} ${formatMetric(row.value, row.unit)}${status ? `, ${status}` : ""}`,
                    `${name} ${formatMetric(row.value, row.unit)}${status ? `，${status}` : ""}`,
                  )}
                />
              </div>
              <div className="col-start-2 row-start-1 text-right sm:col-start-3">
                <p className="figure font-semibold">{formatMetric(row.value, row.unit)}</p>
                <p className="figure text-xs text-muted-foreground">
                  {change === null ? "—" : withSign(change, (m) => m.toFixed(digits), { digits })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Checklist({ latest }: { latest: MarketRiskLatest }) {
  const c = useCopy();
  const date = useDate();
  const statusMeta = (item: ChecklistItem): { label: string; tone: Tone } => {
    const recovery = item.rule_type === "recovery";
    switch (item.status) {
      case "triggered":
        return {
          label: recovery ? c("Met", "满足") : c("Triggered", "触发"),
          tone: recovery ? "positive" : "negative",
        };
      case "pending_confirmation":
        return { label: c("Pending", "待确认"), tone: "warning" };
      case "not_triggered":
        return {
          label: recovery ? c("Not met", "未满足") : c("Not triggered", "未触发"),
          tone: "muted",
        };
      case "insufficient_data":
        return { label: c("No data", "数据不足"), tone: "muted" };
      default:
        return { label: c("Disabled", "未启用"), tone: "muted" };
    }
  };
  const column = (type: ChecklistItem["rule_type"], title: string) => (
    <div className="min-w-0 space-y-1 p-5 sm:p-6">
      <h3 className="text-base font-semibold">{title}</h3>
      <ul className="divide-y divide-border">
        {latest.checklist
          .filter((item) => item.rule_type === type)
          .map((item) => {
            const [name, rule] = ruleCopy(item, c);
            const meta = statusMeta(item);
            return (
              <li
                key={item.rule_key}
                className={cn(
                  "flex items-start justify-between gap-3 py-2.5",
                  item.status === "disabled" && "opacity-60",
                )}
              >
                <div className="min-w-0">
                  <p className="font-medium">{name}</p>
                  <p className="figure flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>{rule}</span>
                    {item.first_triggered_on && (
                      <span>
                        {c(
                          `since ${date(item.first_triggered_on, true)}`,
                          `自 ${date(item.first_triggered_on, true)}`,
                        )}
                      </span>
                    )}
                  </p>
                </div>
                <Chip tone={meta.tone} className="shrink-0">
                  {meta.label}
                </Chip>
              </li>
            );
          })}
      </ul>
    </div>
  );
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-1.5 text-lg font-semibold">
        {c("Checklist", "风险检查")}
        <InfoTip label={c("About the checklist", "风险检查说明")}>
          {c(
            "Evaluated automatically on each session's close. A rule counts as triggered after two sessions in a row; one session shows as pending.",
            "每个交易日收盘后自动判定。连续两个交易日成立才算触发，只成立一天显示为待确认。",
          )}
        </InfoTip>
      </h2>
      <Card className="grid divide-y divide-border overflow-hidden md:grid-cols-2 md:divide-x md:divide-y-0">
        {column("escalation", c("Escalation signals", "风险升级信号"))}
        {column("recovery", c("Recovery signals", "风险修复信号"))}
      </Card>
    </section>
  );
}

function HistorySection({
  history,
  error,
  range,
  onRange,
  onRetry,
}: {
  history: MarketRiskHistory | null;
  error: boolean;
  range: HistoryRange;
  onRange: (range: HistoryRange) => void;
  onRetry: () => void;
}) {
  const c = useCopy();
  const date = useDate();
  const labels: Record<HistoryRange, string> = {
    "1M": c("1M", "1月"),
    "3M": c("3M", "3月"),
    "6M": c("6M", "6月"),
    "1Y": c("1Y", "1年"),
    "3Y": c("3Y", "3年"),
    MAX: c("Max", "全部"),
  };
  const points = history?.range === range ? history.points : [];
  const spans = stageSpans(points);
  const events = history?.range === range ? history.events.slice(-6).reverse() : [];
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{c("History", "历史")}</h2>
        <SegmentedControl
          size="sm"
          label={c("History range", "历史区间")}
          options={HISTORY_RANGES.map((value) => ({ value, label: labels[value] }))}
          value={range}
          onChange={onRange}
        />
      </div>
      <Card className="min-w-0 space-y-4 p-5">
        {error ? (
          <Status text={c("History failed to load.", "历史数据加载失败。")} retry={onRetry} />
        ) : points.length < 2 ? (
          <Status loading text={c("Loading history…", "正在加载历史…")} />
        ) : (
          <>
            <div className="h-64 min-w-0 md:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={points}
                  margin={{ top: 8, right: 4, bottom: 0, left: -4 }}
                  accessibilityLayer
                >
                  {spans.map((span) => (
                    <ReferenceArea
                      key={`${span.start}-${span.stage}`}
                      yAxisId="score"
                      x1={span.start}
                      x2={span.end}
                      fill={stageGray(span.stage, 0.22)}
                      fillOpacity={1}
                      strokeOpacity={0}
                    />
                  ))}
                  <CartesianGrid vertical={false} stroke="rgb(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    minTickGap={48}
                    tickFormatter={(value) => date(value, range === "1M" || range === "3M")}
                    tick={{ fill: "rgb(var(--muted-foreground))", fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="score"
                    domain={[0, 100]}
                    ticks={[0, 40, 60, 75, 90, 100]}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                    tick={{ fill: "rgb(var(--muted-foreground))", fontSize: 11 }}
                  />
                  <YAxis yAxisId="vix" orientation="right" hide domain={[0, "dataMax"]} />
                  <ReferenceLine
                    yAxisId="score"
                    y={60}
                    stroke="rgb(var(--muted-foreground) / 0.4)"
                    strokeDasharray="3 4"
                  />
                  <Tooltip
                    labelFormatter={(value) => date(String(value))}
                    formatter={(value: number, name: string) => [
                      value?.toFixed(name === "VIX" ? 2 : 1),
                      name,
                    ]}
                    contentStyle={{
                      background: "rgb(var(--background))",
                      color: "rgb(var(--foreground))",
                      borderColor: "rgb(var(--border))",
                      borderRadius: 12,
                    }}
                  />
                  <Area
                    yAxisId="vix"
                    dataKey="vix"
                    name="VIX"
                    stroke="rgb(var(--muted-foreground) / 0.6)"
                    fill="rgb(var(--muted-foreground) / 0.08)"
                    strokeWidth={1}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="score"
                    dataKey="score"
                    name={c("Score", "评分")}
                    stroke="rgb(var(--foreground))"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <ul
              className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground"
              aria-label={c("Chart legend", "图例")}
            >
              <li className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-4 bg-foreground" aria-hidden />
                {c("Score", "评分")}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-4 rounded-sm border border-muted-foreground/60 bg-muted-foreground/10"
                  aria-hidden
                />
                VIX
              </li>
              {STAGE_ORDER.map((stage) => (
                <li key={stage} className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: stageGray(stage) }}
                    aria-hidden
                  />
                  {stageCopy(stage, c).label}
                </li>
              ))}
            </ul>
            {events.length > 0 && (
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {c("Stage changes", "阶段变化")}
                </h3>
                <ul className="divide-y divide-border">
                  {events.map((event) => (
                    <li
                      key={`${event.effective_date}-${event.new_stage}`}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm"
                    >
                      <span>
                        {event.previous_stage
                          ? `${stageCopy(event.previous_stage, c).label} → `
                          : ""}
                        <span className="font-medium">{stageCopy(event.new_stage, c).label}</span>
                      </span>
                      <span className="figure flex gap-4 text-muted-foreground">
                        <span>{date(event.effective_date)}</span>
                        <span className="w-20 text-right">
                          {c("score", "评分")} {event.risk_score?.toFixed(1) ?? "—"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </Card>
    </section>
  );
}
