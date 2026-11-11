import { useState } from "react";
import { CardsSkeleton, ChartCardSkeleton, ChipsSkeleton } from "./Skeletons";
import { ScrollView, View } from "react-native";
import Svg, { Line, Rect, Text as SvgText } from "react-native-svg";
import { exportCSV } from "../lib/exportFile";
import { apiRequest } from "../lib/http";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import {
  finite,
  metricValue,
  financialNumber,
  financialChange,
  sortPeriods,
  statementKeys,
  metricLabels,
  statementCSV,
  epsOutcome,
  earningsRows,
  type StatementKind,
  type StatementPeriod,
  type EarningsData,
  type AnalystData,
} from "../lib/stockResearch";
import { number, percent } from "../lib/models";
import { Button, Copy, Empty, Failure, Glass, Section } from "./UI";
import { Filters, ResourceState } from "./Content";
export function Statements({ symbol }: { symbol: string }) {
  const [kind, setKind] = useState<StatementKind>("income-statement");
  const [quarterly, setQuarterly] = useState("annual");
  const [mode, setMode] = useState("chart");
  const [all, setAll] = useState(false);
  const [selected, setSelected] = useState("");
  const [shareError, setShareError] = useState<string>();
  const [sharing, setSharing] = useState(false);
  const resource = useResource(
    `${symbol}:${kind}:${quarterly}`,
    async (signal) => {
      const result = await apiRequest<{ data: StatementPeriod[] }>(
        `/market/${kind}/${encodeURIComponent(symbol)}?quarterly=${quarterly === "quarterly"}`,
        { signal },
      );
      if (!Array.isArray(result.data))
        throw new Error("报表格式无效，请重试。");
      return sortPeriods(result.data);
    },
  );
  const currency = useResource(
    `reporting:${symbol}`,
    async (signal) =>
      (
        await apiRequest<{ financials: { financial_currency?: string } }>(
          `/market/overview/${encodeURIComponent(symbol)}`,
          { signal },
        )
      ).financials.financial_currency,
  );
  const rows = resource.data ?? [];
  const keys = statementKeys(rows, kind, all);
  const metric = keys.includes(selected) ? selected : keys[0];
  const latest = metric && rows[0] ? rows[0][metric] : null;
  const previous = metric && rows[1] ? rows[1][metric] : null;
  const change = financialChange(latest, previous);
  const title = metricLabels[metric] || metric;
  async function share() {
    if (sharing) return;
    setSharing(true);
    try {
      await exportCSV(`${symbol}-${kind}`, statementCSV(rows, keys));
      setShareError(undefined);
    } catch {
      setShareError("此环境无法导出或分享，请使用报表列表查看数据。");
    } finally {
      setSharing(false);
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <Filters
        values={[
          ["income-statement", "利润表"],
          ["balance-sheet", "资产负债表"],
          ["cash-flow", "现金流量表"],
        ]}
        value={kind}
        onChange={(v) => {
          setKind(v as StatementKind);
          setSelected("");
        }}
      />
      <Filters
        values={[
          ["annual", "年度"],
          ["quarterly", "季度"],
        ]}
        value={quarterly}
        onChange={setQuarterly}
      />
      <Copy size={12} muted>
        原始报表数值 · 财报币种 {currency.data || "未提供"} ·
        未自动换算为报价币种
      </Copy>
      <ResourceState
        skeleton={
          <>
            <ChipsSkeleton count={2} />
            <ChartCardSkeleton height={200} />
          </>
        }
        resource={resource}
        empty={!rows.length}
        message="数据源没有返回此类报表。"
      />
      {!!currency.error && (
        <Failure
          message="财报币种暂时无法加载，报表保留原始数值。"
          retry={currency.refresh}
        />
      )}
      {!!rows.length && (
        <>
          <Filters
            values={[
              ["chart", "图表"],
              ["list", "列表"],
            ]}
            value={mode}
            onChange={setMode}
          />
          <Button selected={all} onPress={() => setAll((v) => !v)}>
            {all ? "显示核心项目" : "显示全部项目"}
          </Button>
          {mode === "chart" && metric ? (
            <Glass style={{ padding: 16, gap: 16 }}>
              <Filters
                values={keys.map(
                  (key) => [key, metricLabels[key] || key] as const,
                )}
                value={metric}
                onChange={setSelected}
              />
              <Section title={title} note={rows[0]?.period.slice(0, 10)} />
              <Copy size={30} bold>
                {financialNumber(latest)}
              </Copy>
              <Copy size={14} muted>
                较上一{quarterly === "annual" ? "年度" : "季度"}：
                {change
                  ? `${number(change.absolute)} · ${percent(change.relative === null ? null : change.relative * 100)}`
                  : "—"}
              </Copy>
              <MetricBars
                points={[...rows].reverse().map((row) => ({
                  label: row.period.slice(0, 10),
                  value: finite(row[metric]) ? (row[metric] as number) : null,
                }))}
              />
            </Glass>
          ) : (
            <StatementTable rows={rows} keys={keys} />
          )}
          <Copy size={12} muted>
            M=百万，B=十亿，T=万亿；CSV 保留原始数值。
          </Copy>
          <Button disabled={sharing} onPress={() => void share()}>
            导出 / 分享 CSV
          </Button>
          {shareError && <Failure message={shareError} />}
          <Copy size={12} muted>
            无数据以 —
            显示。上一期不大于零时，不计算相对增长率。每股与比率项目不属于总金额。
          </Copy>
        </>
      )}
    </View>
  );
}
function StatementTable({
  rows,
  keys,
}: {
  rows: StatementPeriod[];
  keys: string[];
}) {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      accessibilityLabel="财务报表，左右滑动查看各期数据"
    >
      <View style={{ gap: 16 }}>
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: 180 }}>
            <Copy bold>项目</Copy>
          </View>
          {rows.map((row) => (
            <View key={row.period} style={{ width: 144, paddingHorizontal: 8 }}>
              <Copy size={14} bold>
                {row.period.slice(0, 10)}
              </Copy>
            </View>
          ))}
        </View>
        {keys.map((key) => (
          <View
            key={key}
            accessible
            accessibilityLabel={`${metricLabels[key] || key}，${rows.map((row) => `${row.period.slice(0, 10)}：${number(finite(row[key]) ? (row[key] as number) : null)}`).join("；")}`}
            style={{
              flexDirection: "row",
              paddingVertical: 8,
              borderBottomWidth: 0.5,
              borderBottomColor: theme.border,
            }}
          >
            <View style={{ width: 180, paddingRight: 8 }}>
              <Copy size={14}>{metricLabels[key] || key}</Copy>
            </View>
            {rows.map((row) => (
              <View
                key={row.period}
                style={{ width: 144, paddingHorizontal: 8 }}
              >
                <Copy size={14}>{financialNumber(row[key])}</Copy>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
const chartMetrics = [
  { id: "revenue", label: "营业收入", keys: ["Total Revenue"] },
  { id: "income", label: "净利润", keys: ["Net Income"] },
  { id: "margin", label: "净利率", keys: [] },
  { id: "eps", label: "稀释每股收益", keys: ["Diluted EPS"] },
  { id: "gross", label: "毛利润", keys: ["Gross Profit"] },
  { id: "operating", label: "营业利润", keys: ["Operating Income"] },
  { id: "ebitda", label: "息税折旧摊销前利润", keys: ["EBITDA"] },
];
/** Several income-statement trends at once, in the reporting currency. */
export function Multicharts({ symbol }: { symbol: string }) {
  const [frequency, setFrequency] = useState("annual");
  const [selected, setSelected] = useState([
    "revenue",
    "income",
    "margin",
    "eps",
  ]);
  const resource = useResource(
    `multicharts:${symbol}:${frequency}`,
    async (signal) => {
      const result = await apiRequest<{ data: StatementPeriod[] }>(
        `/market/income-statement/${encodeURIComponent(symbol)}?quarterly=${frequency === "quarterly"}`,
        { signal },
      );
      if (!Array.isArray(result.data))
        throw new Error("报表格式无效，请重试。");
      return sortPeriods(result.data).reverse();
    },
  );
  const periods = resource.data ?? [];
  return (
    <View style={{ gap: 16 }}>
      <Section title="指标趋势" />
      <Filters
        values={[
          ["annual", "年度"],
          ["quarterly", "季度"],
        ]}
        value={frequency}
        onChange={setFrequency}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {chartMetrics.map((metric) => (
          <Button
            key={metric.id}
            selected={selected.includes(metric.id)}
            onPress={() =>
              setSelected((items) =>
                items.includes(metric.id)
                  ? items.filter((item) => item !== metric.id)
                  : [...items, metric.id],
              )
            }
          >
            {metric.label}
          </Button>
        ))}
      </View>
      <ResourceState
        skeleton={
          <CardsSkeleton
            count={2}
            lines={[
              { size: 16, width: "40%" },
              { size: 24, width: "30%" },
            ]}
            chartHeight={160}
          />
        }
        resource={resource}
        empty={!periods.length}
        message="数据源暂未提供该股票在此周期的数据。"
      />
      {!!periods.length && !selected.length && (
        <Copy size={14} muted>
          添加指标，开始对比财务趋势。
        </Copy>
      )}
      {!!periods.length &&
        selected.map((id) => {
          const metric = chartMetrics.find((item) => item.id === id)!;
          const points = periods.map((period) => {
            const revenue = metricValue(period, ["Total Revenue"]);
            const income = metricValue(period, ["Net Income"]);
            return {
              label: period.period,
              value:
                id === "margin"
                  ? revenue && income !== null
                    ? income / revenue
                    : null
                  : metricValue(period, metric.keys),
            };
          });
          return (
            <Glass key={id} style={{ padding: 16, gap: 8 }}>
              <Copy bold>{metric.label}</Copy>
              <MetricBars
                points={points}
                list={false}
                format={(value) =>
                  id === "margin"
                    ? finite(value)
                      ? `${number(value * 100)}%`
                      : "—"
                    : financialNumber(value)
                }
              />
            </Glass>
          );
        })}
      <Copy size={12} muted>
        来源：Yahoo Finance · 净利率 = 净利润 / 营业收入，仅展示可用财年或财季。
      </Copy>
    </View>
  );
}
export function MetricBars({
  points,
  format = number,
  list = true,
}: {
  points: { label: string; value: number | null }[];
  format?: (value: number | null) => string;
  list?: boolean;
}) {
  const theme = useTheme();
  const values = points.flatMap((point) =>
    finite(point.value) ? [point.value] : [],
  );
  if (!values.length)
    return <Empty title="暂无图表数据" message="所选项目没有可用数值。" />;
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const range = high - low || 1;
  const y = (value: number) => 16 + ((high - value) / range) * 150;
  const step = 288 / Math.max(points.length, 1);
  // Date labels are ~40 units wide; thin them so long histories stay legible.
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));
  return (
    <View
      accessible
      accessibilityLabel={points
        .map((point) => `${point.label}：${format(point.value)}`)
        .join("；")}
    >
      <Svg viewBox="0 0 320 208" width="100%" height={208} accessible={false}>
        <Line x1={8} x2={312} y1={y(0)} y2={y(0)} stroke={theme.border} />
        {points.map((point, index) => (
          <ViewlessBar
            key={point.label}
            value={point.value}
            label={index % labelEvery === 0 ? point.label.slice(0, 7) : ""}
            x={16 + step * index}
            width={step}
            baseline={y(0)}
            top={finite(point.value) ? y(point.value) : y(0)}
            positive={theme.chartUp}
            negative={theme.chartDown}
            foreground={theme.secondary}
          />
        ))}
      </Svg>
      {list &&
        points.map((point) => (
          <Copy key={point.label} size={12} muted>
            {point.label} · {format(point.value)}
          </Copy>
        ))}
    </View>
  );
}
function ViewlessBar({
  value,
  label,
  x,
  width,
  baseline,
  top,
  positive,
  negative,
  foreground,
}: {
  value: number | null;
  label: string;
  x: number;
  width: number;
  baseline: number;
  top: number;
  positive: string;
  negative: string;
  foreground: string;
}) {
  return (
    <>
      {finite(value) && value !== 0 && (
        <Rect
          x={x + width * 0.2}
          y={Math.min(top, baseline)}
          width={width * 0.6}
          height={Math.abs(top - baseline)}
          rx={3}
          fill={value < 0 ? negative : positive}
        />
      )}
      {!!label && (
        <SvgText
          x={x + width / 2}
          y={192}
          textAnchor="middle"
          fontSize={10}
          fill={foreground}
        >
          {label}
        </SvgText>
      )}
    </>
  );
}
export function Earnings({ symbol }: { symbol: string }) {
  const resource = useResource(symbol, (signal) =>
    apiRequest<EarningsData>(`/market/earnings/${encodeURIComponent(symbol)}`, {
      signal,
    }),
  );
  const rows = resource.data ? earningsRows(resource.data) : [];
  return (
    <View style={{ gap: 16 }}>
      <Section
        title="盈利与预期"
        note="每股收益 · 币种及会计口径以原始财报为准"
      />
      <ResourceState
        skeleton={
          <CardsSkeleton
            lines={[
              { size: 16, width: "25%" },
              { size: 16, width: "60%" },
              { size: 14, width: "50%" },
            ]}
          />
        }
        resource={resource}
        empty={!rows.length}
        message="暂无盈利记录。"
      />
      {[...rows].reverse().map((row) => {
        const outcome = epsOutcome(row.actual, row.estimate);
        return (
          <Glass key={row.period} style={{ padding: 20, gap: 12 }}>
            <Copy bold>{row.period.slice(0, 10)}</Copy>
            <Copy>
              实际 EPS {number(row.actual)} · 预期 {number(row.estimate)}
            </Copy>
            <Copy size={14}>
              {outcome
                ? `${outcome.kind === "beat" ? "高于预期" : outcome.kind === "miss" ? "低于预期" : "符合预期"} · 差额 ${number(outcome.delta)}`
                : "尚无完整实际值与预期对比"}
            </Copy>
            <Copy size={12} muted>
              数据源超预期幅度 {percent(row.surprise)}
            </Copy>
          </Glass>
        );
      })}
    </View>
  );
}
export function Analysts({
  symbol,
  currency,
}: {
  symbol: string;
  currency?: string;
}) {
  const resource = useResource(symbol, (signal) =>
    apiRequest<AnalystData>(`/market/analyst/${encodeURIComponent(symbol)}`, {
      signal,
    }),
  );
  const data = resource.data;
  const consensus = data?.recommendations_summary.find(
    (item) => item.period === "0m",
  );
  return (
    <View style={{ gap: 16 }}>
      <Section title="分析师观点" note={`目标价单位 ${currency || "未提供"}`} />
      <ResourceState
        skeleton={
          <CardsSkeleton
            count={1}
            lines={[
              { size: 14, width: "40%" },
              { size: 30, width: "40%" },
              { size: 16, width: "60%" },
            ]}
          />
        }
        resource={resource}
        empty={!data}
        message="暂无分析师数据。"
      />
      {data && (
        <>
          <Glass style={{ padding: 20, gap: 12 }}>
            <Copy size={14} muted>
              平均目标价
            </Copy>
            <Copy size={30} bold>
              {number(data.target_mean_price)}
            </Copy>
            <Copy>
              最低 {number(data.target_low_price)} · 最高{" "}
              {number(data.target_high_price)}
            </Copy>
            <Copy size={14} muted>
              分析师数量 {number(data.number_of_analyst_opinions, 0)}
            </Copy>
          </Glass>
          <Glass style={{ padding: 20, gap: 12 }}>
            <Section title="当前评级分布" />
            {[
              ["strong_buy", "强烈买入"],
              ["buy", "买入"],
              ["hold", "持有"],
              ["sell", "卖出"],
              ["strong_sell", "强烈卖出"],
            ].map(([key, name]) => (
              <Copy key={key}>
                {name} ·{" "}
                {number(
                  consensus?.[key as keyof typeof consensus] as
                    number | null | undefined,
                  0,
                )}
              </Copy>
            ))}
          </Glass>
          <Copy size={12} muted>
            分析师观点可能过时，不代表未来收益。目标价与实际报价的日期可能不同。
          </Copy>
        </>
      )}
    </View>
  );
}
