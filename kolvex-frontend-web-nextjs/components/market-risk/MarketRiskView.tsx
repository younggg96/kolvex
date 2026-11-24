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
const TONE_CHIP: Record<Tone, string> = {
  positive: "border-positive/30 bg-positive/10 text-positive",
  warning: "border-warning/30 bg-warning/10 text-warning",
  negative: "border-negative/30 bg-negative/10 text-negative",
  muted: "border-foreground/15 bg-muted text-muted-foreground",
};
// Chart fills come from the same semantic tokens as the chips.
const STAGE_FILL: Record<RiskStage, string> = {
  stable: "rgb(var(--positive) / 0.08)",
  stress_build_up: "rgb(var(--warning) / 0.14)",
  stress_acceleration: "rgb(var(--negative) / 0.16)",
  post_stress_normalization: "rgb(var(--muted-foreground) / 0.12)",
};

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
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
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
      <div className="grid gap-4 md:grid-cols-2">
        <ScoreCard latest={latest} />
        <StageCard latest={latest} />
      </div>
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
        <p className="figure">
          {c("Cboe daily closes", "Cboe 日终收盘")} · {c("Data through", "数据截至")}{" "}
          {date(latest.as_of)} · {c("Model", "模型")} {latest.model_version}
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

function ScoreCard({ latest }: { latest: MarketRiskLatest }) {
  const c = useCopy();
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
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-1.5">
        <h2 className="text-base font-semibold">{c("Market stress score", "市场压力评分")}</h2>
        <InfoTip label={c("How the score works", "评分说明")}>
          {c(
            `Each input is ranked against its own last ${score.history_window} sessions (at least ${score.min_history}); the score is their weighted average, 0–100. It is relative: a high score means high versus the recent past, not a fixed VIX level. Put/call and tail risk are not in v1.0.`,
            `每个指标与自身过去 ${score.history_window} 个交易日（至少 ${score.min_history} 个）比较得到分位数，再加权平均为 0–100。这是相对评分：分高表示比近几年高，不对应某个固定的 VIX 数值。v1.0 不含 Put/Call 和尾部风险。`,
          )}
        </InfoTip>
      </div>
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className={cn("figure text-5xl font-semibold leading-none", TONE_TEXT[tone])}>
          {score.value.toFixed(1)}
        </span>
        <Chip tone={tone} className="mb-1">
          {levelLabel(score.level, c)}
        </Chip>
        {change !== null && (
          <span className="figure mb-1 text-sm text-muted-foreground">
            {withSign(change, (m) => m.toFixed(1), { digits: 1 })}{" "}
            {c("vs prior session", "较上一交易日")}
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
      <ul className="space-y-2.5" aria-label={c("Score contributions", "评分构成")}>
        {top.map((component) => (
          <li key={component.metric_key} className="space-y-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>
                <span className="font-medium">{metricName(component, c)}</span>{" "}
                <span className="text-muted-foreground">
                  {dimension(component.dimension)} · {Math.round(component.weight * 100)}%
                </span>
              </span>
              <span className="figure shrink-0 text-muted-foreground">
                {c("pct", "分位")} {component.percentile.toFixed(0)} · +
                {component.contribution.toFixed(1)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-foreground/60"
                style={{ width: `${component.percentile}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StageCard({ latest }: { latest: MarketRiskLatest }) {
  const c = useCopy();
  const date = useDate();
  const { stage } = latest;
  const meta = stageCopy(stage.current, c);
  const tone = stageTone(stage.current);
  const conditions = Object.entries(stage.stress_conditions);
  return (
    <Card className="space-y-4 p-5">
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
          {c("Since", "始于")} {date(stage.since)}
        </p>
      </div>
      {stage.pending && (
        <p className="flex items-center gap-1.5 text-sm text-warning">
          <CircleDashed className="h-4 w-4" aria-hidden />
          {c(
            `Pending: ${stageCopy(stage.pending, c).label} (${stage.pending_sessions}/${stage.sessions_to_confirm} sessions)`,
            `待确认：${stageCopy(stage.pending, c).label}（${stage.pending_sessions}/${stage.sessions_to_confirm} 个交易日）`,
          )}
        </p>
      )}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          {c("Stress conditions", "压力条件")}
        </h3>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {conditions.map(([key, met]) => (
            <li key={key} className="flex items-center gap-2 text-sm">
              {met === null ? (
                <Minus
                  className="h-4 w-4 text-muted-foreground"
                  aria-label={c("No data", "无数据")}
                />
              ) : met ? (
                <AlertTriangle className="h-4 w-4 text-negative" aria-label={c("Met", "成立")} />
              ) : (
                <Check
                  className="h-4 w-4 text-muted-foreground"
                  aria-label={c("Not met", "未成立")}
                />
              )}
              <span className={met ? "text-foreground" : "text-muted-foreground"}>
                {conditionLabel(key, c)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

function StageTimeline({ latest }: { latest: MarketRiskLatest }) {
  const c = useCopy();
  const date = useDate();
  const entered = (stage: RiskStage) =>
    latest.recent_events.find((e) => e.new_stage === stage)?.effective_date;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{c("Stages", "四个阶段")}</h2>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {STAGE_ORDER.map((stage, index) => {
          const meta = stageCopy(stage, c);
          const current = latest.stage.current === stage;
          const last = entered(stage);
          return (
            <li
              key={stage}
              aria-current={current ? "step" : undefined}
              className={cn(
                "space-y-1.5 rounded-2xl border p-4",
                current
                  ? cn("border-2", TONE_CHIP[stageTone(stage)].split(" ")[0])
                  : "border-border",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="figure text-xs text-muted-foreground">{index + 1}</span>
                {current && <Chip tone={stageTone(stage)}>{c("Now", "当前")}</Chip>}
              </div>
              <p
                className={cn(
                  "flex items-center gap-1.5 font-semibold",
                  current && TONE_TEXT[stageTone(stage)],
                )}
              >
                <meta.Icon className="h-4 w-4" aria-hidden />
                {meta.label}
              </p>
              <p className="text-sm leading-5 text-muted-foreground">{meta.description}</p>
              {last && (
                <p className="figure text-xs text-muted-foreground">
                  {c("Last entered", "最近进入")} {date(last)}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function TermStructure({ latest }: { latest: MarketRiskLatest }) {
  const c = useCopy();
  const date = useDate();
  const row = (key: string) => latest.metrics.find((m) => m.metric_key === key);
  const legs = ["vix9d", "vix", "vix3m"].map((key) => row(key));
  const data = legs.map((m, i) => ({
    name: ["9D", "30D", "3M"][i],
    today: m?.value ?? null,
    prior: m?.previous_value ?? null,
  }));
  const shape = termStructureShape(row("vix")?.value, row("vix3m")?.value);
  const shapeLabel =
    shape === "backwardation"
      ? c("Backwardation", "倒挂")
      : shape === "contango"
        ? c("Contango", "正向")
        : shape === "flat"
          ? c("Flat", "持平")
          : "—";
  const prior = row("vix")?.previous_date;
  return (
    <Card className="min-w-0 space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-base font-semibold">
          {c("Implied volatility term structure", "隐含波动率期限结构")}
          <InfoTip label={c("About the term structure", "期限结构说明")}>
            {c(
              "Cboe's 9-day, 30-day (VIX) and 3-month implied volatility indexes. When near-term volatility is above longer-term (backwardation), the market is paying up for short-term protection. These are index values, not VIX futures.",
              "Cboe 的 9 天、30 天（VIX）与 3 个月隐含波动率指数。短期高于长期（倒挂）说明市场在为近期保护付出更高价格。这里是指数值，不是 VIX 期货。",
            )}
          </InfoTip>
        </h2>
        {shape && (
          <Chip tone={shape === "backwardation" ? "negative" : "muted"}>
            {shape === "backwardation" && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
            {shapeLabel}
          </Chip>
        )}
      </div>
      <div className="h-52 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 4, bottom: 0, left: -12 }}
            barGap={4}
            accessibilityLayer
          >
            <CartesianGrid vertical={false} stroke="rgb(var(--border))" />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "rgb(var(--muted-foreground))", fontSize: 12 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              tick={{ fill: "rgb(var(--muted-foreground))", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "rgb(var(--muted) / 0.5)" }}
              formatter={(value: number) => value?.toFixed(2)}
              contentStyle={{
                background: "rgb(var(--background))",
                color: "rgb(var(--foreground))",
                borderColor: "rgb(var(--border))",
                borderRadius: 12,
              }}
            />
            <Bar
              dataKey="prior"
              name={c("Prior session", "上一交易日")}
              fill="rgb(var(--muted-foreground) / 0.35)"
              radius={[6, 6, 0, 0]}
              isAnimationActive={false}
            />
            <Bar
              dataKey="today"
              name={date(latest.as_of, true)}
              fill="rgb(var(--foreground) / 0.75)"
              radius={[6, 6, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="flex flex-wrap gap-x-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-foreground/75" aria-hidden />
          {date(latest.as_of)}
        </span>
        {prior && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/35" aria-hidden />
            {date(prior)}
          </span>
        )}
      </p>
    </Card>
  );
}

function Metrics({ latest }: { latest: MarketRiskLatest }) {
  const c = useCopy();
  const date = useDate();
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
    <Card className="min-w-0 space-y-2 p-5">
      <h2 className="flex items-center gap-1.5 text-base font-semibold">
        {c("Indicators", "指标")}
        <InfoTip label={c("About indicator status", "指标状态说明")}>
          {c(
            "Status uses fixed display bands (for VIX: 20 / 28 / 35; VVIX: 100 / 110 / 120; ratios: 0.95 / 1.00 / 1.10). The score uses percentiles instead, so the two can differ.",
            "状态按固定展示区间（VIX：20 / 28 / 35；VVIX：100 / 110 / 120；比值：0.95 / 1.00 / 1.10）。评分用的是历史分位数，所以两者可能不一致。",
          )}
        </InfoTip>
      </h2>
      <ul className="divide-y divide-border">
        {latest.metrics.map((row) => {
          const change = metricChange(row);
          const digits = row.unit === "ratio" ? 3 : 2;
          const lagging = row.latest_date && row.latest_date !== latest.as_of;
          return (
            <li key={row.metric_key} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="font-medium">{metricName(row, c)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.percentile !== null
                    ? `${c("Percentile", "分位")} ${row.percentile.toFixed(0)}`
                    : c("Not scored", "不计分")}
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
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <p className="figure font-semibold">{formatMetric(row.value, row.unit)}</p>
                  <p className="figure text-xs text-muted-foreground">
                    {change === null ? "—" : withSign(change, (m) => m.toFixed(digits), { digits })}
                  </p>
                </div>
                <span className="w-14 text-right">
                  {row.status && (
                    <Chip tone={statusTone(row.status)}>{statusLabel(row.status)}</Chip>
                  )}
                </span>
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
    <Card className="space-y-1 p-5">
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
                  <p className="figure text-xs text-muted-foreground">
                    {rule}
                    {item.first_triggered_on &&
                      ` · ${c("since", "自")} ${date(item.first_triggered_on, true)}`}
                  </p>
                </div>
                <Chip tone={meta.tone} className="shrink-0">
                  {meta.label}
                </Chip>
              </li>
            );
          })}
      </ul>
    </Card>
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
      <div className="grid gap-4 md:grid-cols-2">
        {column("escalation", c("Escalation signals", "风险升级信号"))}
        {column("recovery", c("Recovery signals", "风险修复信号"))}
      </div>
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
                      fill={STAGE_FILL[span.stage]}
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
                    style={{ background: STAGE_FILL[stage].replace(/0\.\d+\)$/, "0.5)") }}
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
                        <span className={cn("font-medium", TONE_TEXT[stageTone(event.new_stage)])}>
                          {stageCopy(event.new_stage, c).label}
                        </span>
                      </span>
                      <span className="figure text-muted-foreground">
                        {date(event.effective_date)} · {c("score", "评分")}{" "}
                        {event.risk_score?.toFixed(1) ?? "—"}
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
