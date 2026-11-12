// The Web's phone "AI 图表操作" sheet (ChartView's mobile AI sheet + AiAnalysisPanel):
// an action row (AI 分析 / AI 画线 / settings), the job's progress, then the saved result.
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import * as Crypto from "expo-crypto";
import { router } from "expo-router";
import { apiRequest } from "../lib/http";
import { useAuth } from "../state/Auth";
import { useResource } from "../lib/useResource";
import { useMutation } from "../lib/useMutation";
import { useTheme } from "../lib/theme";
import type { AiTechnicalAnalysis, ChartVersion } from "../lib/technicalTypes";
import {
  DEFAULT_DRAWING_FOCUS,
  DEFAULT_TECHNICAL_FOCUS,
  DRAWING_CATEGORIES,
  TECHNICAL_CATEGORIES,
  type TechnicalCategory,
  type TechnicalFocus,
} from "../lib/technicalFocus";
import { intervalLabels, type ChartInterval } from "../lib/chartTimeframes";
import { Button, Chip, Copy, Section } from "./UI";
import { Field, Filters, Pager, ResourceState, TextBody } from "./Content";
import { CardsSkeleton } from "./Skeletons";
import { ModelPicker } from "./ModelPicker";
import { MutationStatus } from "./MutationStatus";
import { formatPrice } from "./AdvancedChart";

type Job = {
  id: string;
  status: string;
  operation: "analysis" | "drawings";
  result?: AiTechnicalAnalysis;
  error_code?: string | null;
  created_at?: string;
};
type Operation = "analysis" | "drawings";

const jobLabels: Record<Operation, Record<string, string>> = {
  analysis: {
    submitting: "正在提交分析",
    queued: "AI 分析排队中",
    running: "AI 正在分析图表",
  },
  drawings: {
    submitting: "正在提交画线",
    queued: "AI 画线排队中",
    running: "AI 正在画线",
  },
};
const jobHints: Record<string, string> = {
  submitting: "正在把当前图表区间发送给 AI。",
  queued: "等待后台处理，轮到后会自动开始。",
  running: "AI 正在读取 K 线并生成结果，可能需要几分钟。",
};
const trendLabels = {
  uptrend: "上升趋势",
  downtrend: "下降趋势",
  sideways: "横盘震荡",
};
const biasLabels = { bullish: "偏多", bearish: "偏空", neutral: "中性" };
const strengthLabels = { weak: "弱", medium: "中", strong: "强" };
export const categoryName: Record<string, string> = {
  trend: "趋势",
  momentum: "动量",
  levels: "支撑与阻力",
  structure: "市场结构",
  volume: "成交量确认",
  volatility: "波动率",
  waves: "波浪理论 / 数浪",
  moving_averages: "均线理论",
  trendlines: "趋势线 / 压力线",
  candlesticks: "蜡烛图形态",
  fibonacci: "斐波那契回撤",
  patterns: "技术形态",
  timeframes: "多周期分析",
  score: "技术评分",
  historical: "历史相似走势",
  scenarios: "多空情景",
  invalidation: "失效条件",
  trade_plan: "入场 / 止损 / 盈亏比",
  breakouts: "突破 / 跌破",
  retests: "回踩 / 反抽确认",
  false_breakouts: "假突破 / 假跌破",
};
const percent = (v: number) => `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;

function ActionButton({
  icon,
  label,
  onPress,
  disabled,
  busy,
}: {
  icon: SymbolViewProps["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: t.rim,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}
    >
      <SymbolView
        name={busy ? "hourglass" : icon}
        size={15}
        tintColor={t.text}
      />
      <Copy size={14} bold>
        {label}
      </Copy>
    </Pressable>
  );
}

export function ChartAiPanel({
  symbol,
  query,
  interval,
  viewStart,
  viewEnd,
  analysis,
  onResult,
  forecastVisible,
  onToggleForecast,
}: {
  symbol: string;
  /** The chart's history parameters (interval, period or start/end). */
  query: Record<string, string>;
  interval: string;
  viewStart?: string;
  viewEnd?: string;
  analysis: AiTechnicalAnalysis | null;
  onResult: (operation: Operation, result: AiTechnicalAnalysis) => void;
  forecastVisible: boolean;
  onToggleForecast?: () => void;
}) {
  const t = useTheme();
  const user = useAuth().session!.user.id;
  const [step, setStep] = useState<"actions" | "settings">("actions");
  const [pendingRun, setPendingRun] = useState<Operation | null>(null);
  const [model, setModel] = useState("");
  const [focusTab, setFocusTab] = useState<Operation>("analysis");
  const [focus, setFocus] = useState<Record<Operation, TechnicalFocus>>({
    analysis: DEFAULT_TECHNICAL_FOCUS,
    drawings: DEFAULT_DRAWING_FOCUS,
  });
  const [custom, setCustom] = useState("");
  const m = useMutation();
  const request = useRef<{ id: string; signature: string } | undefined>(
    undefined,
  );
  const jobs = useResource(`jobs:${user}:${symbol}`, (signal) =>
    apiRequest<{ items: Job[] }>(`/market/chart-jobs/${symbol}`, {
      signal,
      authenticated: true,
      expectedUser: user,
    }),
  );
  const active = jobs.data?.items.find((j) =>
    ["queued", "running"].includes(j.status),
  );
  const refreshJobs = jobs.refresh;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(refreshJobs, 5000);
    return () => clearInterval(timer);
  }, [active, refreshJobs]);
  // A finished job's result goes straight onto the chart, as on the Web.
  const seen = useRef<Set<string> | null>(null);
  const report = useEffectEvent(onResult);
  useEffect(() => {
    const items = jobs.data?.items;
    if (!items) return;
    if (!seen.current) {
      seen.current = new Set(
        items.filter((j) => j.status === "done").map((j) => j.id),
      );
      return;
    }
    for (const job of items)
      if (job.status === "done" && job.result && !seen.current.has(job.id)) {
        seen.current.add(job.id);
        report(job.operation, job.result);
      }
  }, [jobs.data]);
  const failed =
    jobs.data?.items[0]?.status === "failed" ? jobs.data.items[0] : null;

  const run = (operation: Operation) => {
    if (!model) {
      setPendingRun(operation);
      setStep("settings");
      return;
    }
    void m.run(async (signal) => {
      const chosen = focus[operation];
      const body = {
        ...query,
        model,
        operation,
        categories: chosen.categories,
        custom_scenarios: chosen.custom_scenarios,
        view_start: viewStart,
        view_end: viewEnd,
        locale: "zh",
      };
      const signature = JSON.stringify(body);
      if (request.current?.signature !== signature)
        request.current = { id: Crypto.randomUUID(), signature };
      await apiRequest(`/market/chart-jobs/${symbol}`, {
        method: "POST",
        body: { ...body, request_id: request.current.id },
        signal,
        authenticated: true,
        expectedUser: user,
      });
      jobs.refresh();
    });
  };
  const busy = m.busy || !!active;

  if (step === "settings") {
    const current = focus[focusTab];
    const categories =
      focusTab === "analysis" ? TECHNICAL_CATEGORIES : DRAWING_CATEGORIES;
    const toggle = (c: TechnicalCategory) =>
      setFocus((f) => ({
        ...f,
        [focusTab]: {
          ...f[focusTab],
          categories: f[focusTab].categories.includes(c)
            ? f[focusTab].categories.filter((x) => x !== c)
            : [...f[focusTab].categories, c],
        },
      }));
    return (
      <View style={{ gap: 16 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setStep("actions");
            setPendingRun(null);
          }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            minHeight: 44,
          }}
        >
          <SymbolView name="chevron.left" size={15} tintColor={t.accent} />
          <Copy size={15} bold color={t.accent}>
            AI 图表操作
          </Copy>
        </Pressable>
        <Copy size={17} bold>
          AI 设置
        </Copy>
        <Copy size={13} muted>
          {pendingRun
            ? "选择一个模型后即可开始。当前结果会保留，直到新结果生成。"
            : "选择模型、调整分析和画线内容，或切换已保存的画线版本。设置用于下一次生成。"}
        </Copy>
        <ModelPicker
          user={user}
          value={model}
          onChange={setModel}
          disabled={busy}
        />
        <Filters
          stretch
          size="sm"
          values={[
            ["analysis", "分析内容"],
            ["drawings", "画线内容"],
          ]}
          value={focusTab}
          onChange={(v) => setFocusTab(v as Operation)}
        />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {categories.map((c) => (
            <Chip
              key={c}
              size="sm"
              selected={current.categories.includes(c)}
              onPress={() => toggle(c)}
            >
              {categoryName[c] || c}
            </Chip>
          ))}
        </View>
        <Copy size={12} muted>
          修改在下次生成或更新分析时生效，已保存的结果不变。
        </Copy>
        <Field
          label="自定义关注情景"
          placeholder="例如：突破阻力后如何确认？"
          value={custom}
          onChangeText={setCustom}
          maxLength={200}
          returnKeyType="done"
          onSubmitEditing={() => {
            const value = custom.trim();
            if (
              !value ||
              current.custom_scenarios.includes(value) ||
              current.custom_scenarios.length >= 5
            )
              return;
            setFocus((f) => ({
              ...f,
              [focusTab]: {
                ...f[focusTab],
                custom_scenarios: [...f[focusTab].custom_scenarios, value],
              },
            }));
            setCustom("");
          }}
        />
        {current.custom_scenarios.map((s) => (
          <Chip
            key={s}
            size="sm"
            selected
            onPress={() =>
              setFocus((f) => ({
                ...f,
                [focusTab]: {
                  ...f[focusTab],
                  custom_scenarios: f[focusTab].custom_scenarios.filter(
                    (x) => x !== s,
                  ),
                },
              }))
            }
          >
            {`${s}  ✕`}
          </Chip>
        ))}
        <Copy size={12} muted>
          最多 5 个情景，每个 200 字。
        </Copy>
        <VersionHistory
          symbol={symbol}
          user={user}
          kind={focusTab}
          onShow={onResult}
        />
        {pendingRun ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button
                block
                onPress={() => {
                  setStep("actions");
                  setPendingRun(null);
                }}
              >
                取消
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Button
                variant="primary"
                disabled={!model}
                onPress={() => {
                  const operation = pendingRun;
                  setStep("actions");
                  setPendingRun(null);
                  run(operation);
                }}
              >
                {pendingRun === "analysis" ? "开始分析" : "开始画线"}
              </Button>
            </View>
          </View>
        ) : (
          <Button variant="primary" onPress={() => setStep("actions")}>
            关闭
          </Button>
        )}
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <ActionButton
          icon="text.viewfinder"
          label="AI 分析"
          disabled={busy}
          busy={active?.operation === "analysis"}
          onPress={() => run("analysis")}
        />
        <ActionButton
          icon="chart.xyaxis.line"
          label="AI 画线"
          disabled={busy}
          busy={active?.operation === "drawings"}
          onPress={() => run("drawings")}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="AI 设置"
          onPress={() => setStep("settings")}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: t.rim,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <SymbolView name="slider.horizontal.3" size={16} tintColor={t.text} />
        </Pressable>
      </View>
      {active && (
        <View
          style={{
            gap: 4,
            padding: 12,
            borderRadius: 16,
            backgroundColor: t.wash,
          }}
        >
          <Copy size={14} bold>
            {jobLabels[active.operation]?.[
              active.status === "queued" ? "queued" : "running"
            ] ?? "AI 正在分析图表"}
          </Copy>
          <Copy size={12} muted>
            {jobHints[active.status === "queued" ? "queued" : "running"]}
          </Copy>
          <Copy size={12} muted>
            可以离开页面，完成后结果会自动保存。
          </Copy>
        </View>
      )}
      <MutationStatus {...m} />
      {failed && !active && (
        <Copy size={13} color={t.chartDown}>
          {failed.error_code === "ai_not_configured"
            ? "请在设置中添加或更新所选模型的 API Key；分析仅使用你提供的 Key。"
            : "AI 分析失败，请稍后重试。"}
        </Copy>
      )}
      {!analysis && !active ? (
        <View style={{ gap: 8, paddingVertical: 8 }}>
          <Copy size={16} bold>
            尚未生成分析
          </Copy>
          <Copy size={13} muted>
            分析当前图表，查看趋势解读、关键价位与技术信号。生成的结果会显示在这里。
          </Copy>
          {!!viewStart && !!viewEnd && (
            <Copy size={12} muted localize={false}>
              {`当前可见区间 · ${viewStart.slice(0, 10)} — ${viewEnd.slice(0, 10)} · ${intervalLabels[interval as ChartInterval] ?? interval}`}
            </Copy>
          )}
          <Button
            variant="primary"
            disabled={busy}
            onPress={() => run("analysis")}
          >
            {model ? "开始分析" : "选择模型并开始"}
          </Button>
          <Copy size={12} muted>
            想在图表上标注关键价位？点击上方「AI
            画线」，绘制支撑、阻力与趋势线。
          </Copy>
        </View>
      ) : analysis ? (
        <AnalysisPanel
          result={analysis}
          symbol={symbol}
          forecastVisible={forecastVisible}
          onToggleForecast={onToggleForecast}
          onRerun={() => run("analysis")}
          busy={busy}
        />
      ) : null}
    </View>
  );
}

function AnalysisPanel({
  result: r,
  symbol,
  forecastVisible,
  onToggleForecast,
  onRerun,
  busy,
}: {
  result: AiTechnicalAnalysis;
  symbol: string;
  forecastVisible: boolean;
  onToggleForecast?: () => void;
  onRerun: () => void;
  busy: boolean;
}) {
  const t = useTheme();
  const [details, setDetails] = useState(false);
  const [evidence, setEvidence] = useState(false);
  const levels = [...r.levels].sort((a, b) => b.price - a.price);
  const tone =
    r.bias === "bullish"
      ? t.chartUp
      : r.bias === "bearish"
        ? t.chartDown
        : t.secondary;
  const findings = (r.findings ?? []).flatMap((f) => {
    const custom = /^custom_\d+$/.test(f.id)
      ? r.custom_scenarios?.[Number(f.id.slice(7))]
      : undefined;
    const title = categoryName[f.id] ?? custom;
    return title ? [{ ...f, title }] : [];
  });
  const indicators = (
    ["rsi14", "ema20", "ema50", "ema200", "atr14"] as const
  ).flatMap((k) => {
    const v = r.indicators[k];
    return typeof v === "number" && Number.isFinite(v) ? [{ k, v }] : [];
  });
  const card = {
    padding: 16,
    borderRadius: 24,
    backgroundColor: t.wash,
    gap: 8,
  } as const;
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <Copy size={12} muted>
          AI 技术分析
        </Copy>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Copy size={20} bold>
            {trendLabels[r.trend]}
          </Copy>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: tone,
            }}
          >
            <Copy size={12} bold color={tone}>
              {biasLabels[r.bias]}
            </Copy>
          </View>
        </View>
        <Copy size={12} muted localize={false}>
          {`${intervalLabels[r.interval as ChartInterval] ?? r.interval} · ${r.view.start.slice(0, 10)} — ${r.view.end.slice(0, 10)}${r.model ? ` · ${r.provider || ""} / ${r.model}` : ""}`}
        </Copy>
      </View>
      <TextBody text={r.summary} symbols={[symbol]} size={15} />
      {r.invalidation && (
        <View style={card}>
          <Copy size={14} bold color="#F59E0B">
            失效条件
          </Copy>
          <Copy size={13} muted>
            {r.invalidation}
          </Copy>
        </View>
      )}
      {r.setup && (
        <View style={card}>
          <Copy size={14} bold>
            {`条件计划 · ${r.setup.direction === "bullish" ? "偏多计划" : "偏空计划"}`}
          </Copy>
          <Copy size={13} localize={false}>
            {`入场区间 ${formatPrice(r.setup.entry_low)} — ${formatPrice(r.setup.entry_high)}`}
          </Copy>
          <Copy size={13} localize={false} color={t.chartDown}>
            {`止损 ${formatPrice(r.setup.invalidation)}`}
          </Copy>
          <Copy size={13} localize={false} color={t.chartUp}>
            {`目标 ${r.setup.targets.map(formatPrice).join(" / ")}`}
          </Copy>
          <Copy size={13} muted localize={false}>
            {`盈亏比 ${r.setup.risk_reward.toFixed(2)}`}
          </Copy>
          <Copy size={13} muted>
            {r.setup.reason}
          </Copy>
          <Button
            onPress={() => {
              const setup = r.setup!;
              // Carries an editable plan only: neither a quote nor an order.
              router.push({
                pathname: "/paper-trading",
                params: {
                  symbol,
                  side: setup.direction === "bullish" ? "long" : "short",
                  entry: String(setup.entry_low),
                  stop: String(setup.invalidation),
                  target: String(setup.targets[0] ?? ""),
                  note: [setup.name, setup.reason].join("\n").slice(0, 2000),
                  source: "ai_setup",
                },
              });
            }}
          >
            用此计划模拟交易
          </Button>
        </View>
      )}
      {r.forecast && (
        <View style={card}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Copy size={14} bold>
              Kronos 预测（实验）
            </Copy>
            {onToggleForecast && (
              <Button
                size="sm"
                selected={forecastVisible}
                onPress={onToggleForecast}
              >
                {forecastVisible ? "在图上隐藏" : "在图上显示"}
              </Button>
            )}
          </View>
          <Copy size={13} localize={false}>
            {`${r.forecast.horizon} 根K线中位数 ${percent(r.forecast.summary.median_return)} · P10–P90 ${percent(r.forecast.summary.p10_return)} ~ ${percent(r.forecast.summary.p90_return)} · 上涨概率 ${Math.round(r.forecast.summary.prob_up * 100)}%`}
          </Copy>
          <Copy size={12} muted>
            {`基于截至 ${r.forecast.context_end} 的K线`}
          </Copy>
        </View>
      )}
      {levels.length > 0 && (
        <View style={{ gap: 4 }}>
          <Copy size={16} bold>
            关键价位
          </Copy>
          {levels.map((l) => (
            <View
              key={`${l.kind}-${l.price}`}
              style={{
                paddingVertical: 10,
                gap: 4,
                borderBottomWidth: 1,
                borderBottomColor: t.border,
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <Copy
                  size={18}
                  bold
                  localize={false}
                  color={l.kind === "support" ? t.chartUp : t.chartDown}
                >
                  {formatPrice(l.price)}
                </Copy>
                <Copy size={13}>{l.kind === "support" ? "支撑" : "阻力"}</Copy>
                <View
                  style={{
                    marginLeft: "auto",
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 12,
                    backgroundColor: t.washStrong,
                  }}
                >
                  <Copy size={11} bold>
                    {strengthLabels[l.strength]}
                  </Copy>
                </View>
              </View>
              <Copy size={13} muted>
                {l.reason}
              </Copy>
            </View>
          ))}
        </View>
      )}
      {findings.length > 0 && (
        <Disclosure
          title={`分析依据 · ${findings.length}`}
          open={evidence}
          onToggle={() => setEvidence((v) => !v)}
        >
          {findings.map((f) => (
            <View key={f.id} style={{ gap: 2 }}>
              <Copy size={14} bold>
                {f.title}
              </Copy>
              <Copy size={13} muted>
                {f.status === "unavailable"
                  ? `暂无足够数据 · ${f.explanation}`
                  : f.explanation}
              </Copy>
            </View>
          ))}
        </Disclosure>
      )}
      {(indicators.length > 0 ||
        r.trendlines.length > 0 ||
        (!findings.length && r.signals.length > 0)) && (
        <Disclosure
          title="指标与趋势线"
          open={details}
          onToggle={() => setDetails((v) => !v)}
        >
          {indicators.length > 0 && (
            <View
              style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 10 }}
            >
              {indicators.map(({ k, v }) => (
                <View key={k} style={{ width: "50%" }}>
                  <Copy size={12} muted localize={false}>
                    {k.startsWith("ema") ? `EMA${k.slice(3)}` : k.toUpperCase()}
                  </Copy>
                  <Copy size={14} bold localize={false}>
                    {k.startsWith("rsi") ? v.toFixed(1) : formatPrice(v)}
                  </Copy>
                </View>
              ))}
            </View>
          )}
          {r.trendlines.map((line) => (
            <View
              key={`${line.start.date}-${line.end.date}-${line.kind}`}
              style={{ gap: 2 }}
            >
              <Copy
                size={14}
                bold
                color={line.kind === "support" ? t.chartUp : t.chartDown}
              >
                {line.kind === "support" ? "趋势支撑线" : "趋势阻力线"}
              </Copy>
              <Copy size={13} muted>
                {line.reason}
              </Copy>
            </View>
          ))}
          {!findings.length &&
            r.signals.map((s) => (
              <Copy key={s} size={13} muted>
                {s}
              </Copy>
            ))}
        </Disclosure>
      )}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: t.border,
          paddingTop: 12,
          gap: 8,
        }}
      >
        <Button size="sm" disabled={busy} onPress={onRerun}>
          重新分析
        </Button>
        <Copy size={12} muted>
          生成结果可能错误，画线不是预测或下单指令。
        </Copy>
      </View>
    </View>
  );
}

function Disclosure({
  title,
  open,
  onToggle,
  children,
}: React.PropsWithChildren<{
  title: string;
  open: boolean;
  onToggle: () => void;
}>) {
  const t = useTheme();
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: t.border }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 48,
        }}
      >
        <Copy size={15} bold>
          {title}
        </Copy>
        <SymbolView
          name={open ? "chevron.up" : "chevron.down"}
          size={13}
          tintColor={t.secondary}
        />
      </Pressable>
      {open && <View style={{ gap: 14, paddingBottom: 14 }}>{children}</View>}
    </View>
  );
}

/** Saved versions for this ticker; choosing one puts it back on the chart. */
function VersionHistory({
  symbol,
  user,
  kind,
  onShow,
}: {
  symbol: string;
  user: string;
  kind: Operation;
  onShow: (operation: Operation, result: AiTechnicalAnalysis) => void;
}) {
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState("all");
  const m = useMutation();
  const apiKind = kind === "analysis" ? "technical" : "drawings";
  const history = useResource(
    `versions:${user}:${symbol}:${apiKind}:${scope}:${page}`,
    (signal) =>
      apiRequest<{
        items: ChartVersion[];
        total: number;
        current: ChartVersion | null;
      }>(
        `/market/analysis-history/${symbol}?kind=${apiKind}&scope=${scope}&limit=10&offset=${(page - 1) * 10}`,
        { signal, authenticated: true, expectedUser: user },
      ),
  );
  return (
    <View style={{ gap: 10 }}>
      <Section title={kind === "analysis" ? "分析版本" : "画线版本"} />
      <Filters
        size="sm"
        values={[
          ["all", "全部共享结果"],
          ["mine", "我的结果"],
        ]}
        value={scope}
        onChange={(v) => {
          setScope(v);
          setPage(1);
        }}
      />
      <ResourceState
        skeleton={
          <CardsSkeleton
            count={2}
            lines={[{ size: 12, width: "40%" }]}
            buttons={1}
            padding={12}
            gap={8}
          />
        }
        resource={history}
        empty={!history.data?.items.length}
        message="尚无分析版本"
      />
      {history.data?.items.map((v) => (
        <View key={v.id} style={{ gap: 6, paddingVertical: 8 }}>
          <Copy size={12} muted localize={false}>
            {`${v.created_at.slice(0, 16).replace("T", " ")} · ${v.payload?.model ?? ""}${history.data?.current?.id === v.id ? " · 当前" : ""}`}
          </Copy>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            <Button
              size="sm"
              onPress={() => onShow(kind, { ...v.payload, version_id: v.id })}
            >
              在图上显示
            </Button>
            {v.user_id === user && history.data?.current?.id !== v.id && (
              <Button
                size="sm"
                disabled={m.busy}
                onPress={() =>
                  void m.run(async (signal) => {
                    await apiRequest(
                      `/market/analysis-history/${symbol}/${v.id}/current`,
                      {
                        method: "PATCH",
                        body: {
                          expected_current_id:
                            history.data?.current?.user_id === user
                              ? history.data.current.id
                              : null,
                        },
                        signal,
                        authenticated: true,
                        expectedUser: user,
                      },
                    );
                    history.refresh();
                    onShow(kind, { ...v.payload, version_id: v.id });
                  })
                }
              >
                设为当前版本
              </Button>
            )}
          </View>
        </View>
      ))}
      <MutationStatus {...m} />
      <Pager
        page={page}
        hasMore={page * 10 < (history.data?.total ?? 0)}
        loading={history.loading}
        onChange={setPage}
      />
    </View>
  );
}
