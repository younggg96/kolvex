import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { finite } from "../lib/stockResearch";
import {
  loadValuation,
  simulateValuation,
  validateValuationAssumptions,
  valuationScenarios,
  type Multiples,
  type StockValuation as Valuation,
  type ValuationEvent,
  type ValuationPoint,
  type ValuationReference,
  type ValuationSimulation,
} from "../lib/stockExtrasApi";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { usePreferences } from "../state/Preferences";
import { Field, Filters } from "./Content";
import { SecLink } from "./SecResearch";
import { CardsSkeleton } from "./Skeletons";
import { CompanyCalculator } from "./CompanyCalculator";
import {
  Button,
  Copy,
  Empty,
  Failure,
  Glass,
  LoadingStatus,
  Section,
  styles,
} from "./UI";

const NAMES = {
  conservative: "保守",
  base: "基准",
  optimistic: "乐观",
} as const;
type ChartView = "price" | "pe" | "premium";
const skeleton = (
  <>
    <CardsSkeleton
      count={1}
      lines={[
        { size: 16, width: "40%" },
        { size: 24, width: "30%" },
        { size: 16, width: "80%" },
      ]}
    />
    <CardsSkeleton
      count={1}
      lines={[{ size: 14, width: "50%" }]}
      chartHeight={220}
    />
  </>
);
function useFormat() {
  const region = usePreferences().locale === "en" ? "en-US" : "zh-CN";
  return {
    number: (value: unknown, digits = 2) =>
      finite(value)
        ? new Intl.NumberFormat(region, {
            maximumFractionDigits: digits,
          }).format(value)
        : "—",
    money: (value: unknown) =>
      finite(value)
        ? new Intl.NumberFormat(region, {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 2,
          }).format(value)
        : "—",
    percent: (value: unknown) =>
      finite(value)
        ? `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`
        : "—",
  };
}

/** Historical PE reference values from SEC filings, in USD. Not a forecast. */
/** The Web's valuation workspace: company calculator first, history on request. */
export function StockValuation({ symbol }: { symbol: string }) {
  const [mode, setMode] = useState("calculator");
  const [visited, setVisited] = useState(["calculator"]);
  return (
    <View style={{ gap: 16 }}>
      <Filters
        values={[
          ["calculator", "公司估值计算"],
          ["history", "历史估值走势"],
        ]}
        value={mode}
        onChange={(value) => {
          setMode(value);
          setVisited((previous) => Array.from(new Set([...previous, value])));
        }}
      />
      {visited.includes("calculator") && (
        <View style={mode === "calculator" ? undefined : { display: "none" }}>
          <CompanyCalculator key={symbol} symbol={symbol} />
        </View>
      )}
      {visited.includes("history") && (
        <View style={mode === "history" ? undefined : { display: "none" }}>
          <HistoricalValuation key={symbol} symbol={symbol} />
        </View>
      )}
    </View>
  );
}
function HistoricalValuation({ symbol }: { symbol: string }) {
  const f = useFormat();
  const [years, setYears] = useState("3");
  const [view, setView] = useState<string>("price");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<ValuationSimulation | null>(
    null,
  );
  const resource = useResource(
    `valuation:${symbol}`,
    (signal) => loadValuation(symbol, 5, signal),
    330_000,
  );
  const data =
    resource.data && "points" in resource.data ? resource.data : null;
  const cutoff = data
    ? `${Number(data.as_of.slice(0, 4)) - Number(years)}${data.as_of.slice(4)}`
    : "";
  const points = useMemo(
    () => data?.points.filter((p) => p.date >= cutoff) ?? [],
    [data, cutoff],
  );
  if (resource.loading && !data)
    return (
      <LoadingStatus label="正在整理有来源的估值历史，首次计算可能需要几分钟…">
        <Copy size={14} muted>
          正在整理有来源的估值历史，首次计算可能需要几分钟…
        </Copy>
        {skeleton}
      </LoadingStatus>
    );
  if (!data && resource.data)
    return (
      <Empty
        title="暂不支持"
        message="这家公司暂不在已核验的 PE 估值范围内。"
      />
    );
  if (!data)
    return (
      <Failure message="估值数据暂时无法读取。" retry={resource.refresh} />
    );
  const selectedIndex = Math.max(
    0,
    selectedDate
      ? points.findIndex((p) => p.date >= selectedDate)
      : points.length - 1,
  );
  const selected = points[selectedIndex];
  const event = selected && data.events[selected.event_id];
  const shown =
    simulation?.snapshot_id === data.snapshot_id ? simulation : null;
  const reference = shown?.reference ?? data.current.reference ?? null;
  return (
    <View style={{ gap: 16 }}>
      {!!resource.error && (
        <Copy size={12} muted>
          更新失败，正在显示上次成功读取的快照。
        </Copy>
      )}
      <Glass style={{ padding: 20, gap: 16 }}>
        <View style={styles.row}>
          <View style={{ flexShrink: 1, gap: 2 }}>
            <Copy bold>{shown ? "我的模拟" : "当前参考估值"}</Copy>
            <Copy size={12} muted>
              {`最近完整交易日收盘价 · ${data.current.price_date ?? "—"}`}
            </Copy>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Copy size={24} bold localize={false}>
              {f.money(data.current.price)}
            </Copy>
            <Copy size={12} muted>
              {`TTM 市盈率 ${f.number(data.current.pe)}×`}
            </Copy>
          </View>
        </View>
        <ReferenceRange reference={reference} price={data.current.price} />
        {reference ? (
          <View style={{ gap: 4 }}>
            <Copy size={14}>
              {`相对基准的价格空间 ${f.percent(reference.scenarios.base.comparison.price_space)}`}
            </Copy>
            <Copy size={14}>
              {`相对基准的溢价／折价 ${f.percent(reference.scenarios.base.comparison.premium_discount)}`}
            </Copy>
          </View>
        ) : (
          <Copy size={14} muted>
            自动估值需要完整、可核验的 EPS 和足够的历史参考样本。
          </Copy>
        )}
      </Glass>
      <Glass style={{ padding: 16, gap: 12 }}>
        <Filters
          values={[
            ["price", "股价与参考值"],
            ["pe", "PE 倍数"],
            ["premium", "溢价／折价"],
          ]}
          value={view}
          onChange={setView}
        />
        <Filters
          values={[
            ["1", "1年"],
            ["3", "3年"],
            ["5", "5年"],
          ]}
          value={years}
          onChange={(value) => {
            setYears(value);
            setSelectedDate(null);
          }}
        />
        <HistoryPlot
          points={points}
          view={view as ChartView}
          selected={selectedIndex}
          onSelect={(index) => setSelectedDate(points[index]?.date ?? null)}
        />
        {selected && (
          <View style={{ gap: 12 }}>
            <View style={[styles.row, { flexWrap: "wrap" }]}>
              <Copy size={14} bold>{`选中交易日 · ${selected.date}`}</Copy>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button
                disabled={selectedIndex <= 0}
                onPress={() => setSelectedDate(points[selectedIndex - 1].date)}
              >
                上一交易日
              </Button>
              <Button
                disabled={selectedIndex >= points.length - 1}
                onPress={() => setSelectedDate(points[selectedIndex + 1].date)}
              >
                下一交易日
              </Button>
            </View>
            <Facts
              items={[
                ["收盘价", f.money(selected.price)],
                ["基准参考值", f.money(selected.base)],
                ["TTM EPS", f.number(selected.eps)],
                ["溢价／折价", f.percent(selected.premium_discount)],
              ]}
            />
            {event && <Sources event={event} />}
          </View>
        )}
      </Glass>
      <SimulationPanel
        key={data.snapshot_id}
        data={data}
        onSimulation={setSimulation}
      />
      <Copy size={12} muted>
        基于 SEC 财报的历史 PE 参考估值，单位
        USD。这是模型情景范围，不是统计置信区间或分析师共识。股价按日变化，参考值随财报事件更新；缺失数据保留缺口，个人假设不会改写这条历史。系统倍数采用此前五年有效
        PE 样本的第 25、50、75 分位。
      </Copy>
      <Copy size={12} muted>
        {`参考样本量 ${f.number(data.current.calibration.sample_count, 0)} · ${data.current.calibration.first_sample ?? "—"} — ${data.current.calibration.last_sample ?? "—"}`}
      </Copy>
    </View>
  );
}
function Facts({ items }: { items: [string, string][] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 12 }}>
      {items.map(([label, value]) => (
        <View key={label} style={{ width: "50%", paddingRight: 8, gap: 2 }}>
          <Copy size={12} muted>
            {label}
          </Copy>
          <Copy size={15} bold localize={false}>
            {value}
          </Copy>
        </View>
      ))}
    </View>
  );
}
function ReferenceRange({
  reference,
  price,
}: {
  reference: ValuationReference | null;
  price: number | null;
}) {
  const t = useTheme();
  const f = useFormat();
  const values = reference
    ? valuationScenarios.map((key) => reference.scenarios[key].reference_value)
    : [];
  const all = [...values, ...(finite(price) ? [price] : [])];
  const min = Math.min(...all);
  const span = Math.max(Math.max(...all) - min, 1);
  const position = (value: number) => 5 + 90 * ((value - min) / span);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row" }}>
        {valuationScenarios.map((key) => (
          <View key={key} style={{ flex: 1, gap: 2 }}>
            <Copy size={12} muted>
              {NAMES[key]}
            </Copy>
            <Copy size={17} bold localize={false}>
              {f.money(reference?.scenarios[key].reference_value)}
            </Copy>
          </View>
        ))}
      </View>
      {reference && finite(price) && (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ height: 24, justifyContent: "center" }}
        >
          <View
            style={{ height: 4, borderRadius: 2, backgroundColor: t.tint }}
          />
          {values.map((value, index) => (
            <View
              key={index}
              style={{
                position: "absolute",
                left: `${position(value)}%`,
                width: 2,
                height: 18,
                backgroundColor: t.secondary,
              }}
            />
          ))}
          <View
            style={{
              position: "absolute",
              left: `${position(price)}%`,
              width: 12,
              height: 12,
              marginLeft: -6,
              borderRadius: 6,
              backgroundColor: t.text,
            }}
          />
        </View>
      )}
    </View>
  );
}
function Sources({ event }: { event: ValuationEvent }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Button selected={open} onPress={() => setOpen((value) => !value)}>
        {`财务输入与来源 · ${event.period_end ?? "—"}`}
      </Button>
      {open &&
        event.inputs.map((row, index) => (
          <View key={`${row.source_url}-${index}`} style={{ gap: 2 }}>
            <Copy size={12} muted localize={false}>
              {row.start} — {row.end} · EPS {row.value.toFixed(4)}
            </Copy>
            <SecLink
              href={row.source_url}
              label={`${row.form} · ${row.filed}`}
            />
          </View>
        ))}
    </View>
  );
}
const W = 320;
const H = 200;
function HistoryPlot({
  points,
  view,
  selected,
  onSelect,
}: {
  points: ValuationPoint[];
  view: ChartView;
  selected: number;
  onSelect: (index: number) => void;
}) {
  const t = useTheme();
  const text = useText();
  const [width, setWidth] = useState(0);
  const series = points.map((p) => {
    const eps = finite(p.eps) && p.eps > 0 ? p.eps : null;
    return view === "price"
      ? { main: p.price, base: p.base, low: p.conservative, high: p.optimistic }
      : view === "pe"
        ? {
            main: p.pe,
            base: p.base !== null && eps ? p.base / eps : null,
            low: p.conservative !== null && eps ? p.conservative / eps : null,
            high: p.optimistic !== null && eps ? p.optimistic / eps : null,
          }
        : {
            main: p.premium_discount === null ? null : p.premium_discount * 100,
            base: null,
            low: null,
            high: null,
          };
  });
  const all = series
    .flatMap((s) => [s.main, s.base, s.low, s.high])
    .filter(finite);
  if (points.length < 2 || !all.length)
    return (
      <Copy size={14} muted>
        这个区间没有可用的估值数据。
      </Copy>
    );
  const min = Math.min(...all, view === "premium" ? 0 : Infinity);
  const max = Math.max(...all, view === "premium" ? 0 : -Infinity);
  const span = max - min || 1;
  const x = (index: number) => 4 + (index / (points.length - 1)) * (W - 8);
  const y = (value: number) => H - 12 - ((value - min) / span) * (H - 24);
  // Missing inputs stay gaps: a null ends the current segment.
  const path = (key: "main" | "base", step: boolean) => {
    let d = "";
    let pen = false;
    let previous = 0;
    series.forEach((s, index) => {
      const value = s[key];
      if (!finite(value)) {
        pen = false;
        return;
      }
      d += pen
        ? step
          ? `L${x(index)},${y(previous)}L${x(index)},${y(value)}`
          : `L${x(index)},${y(value)}`
        : `M${x(index)},${y(value)}`;
      pen = true;
      previous = value;
    });
    return d;
  };
  const unit = view === "price" ? "USD" : view === "pe" ? "×" : "%";
  return (
    <View style={{ gap: 4 }}>
      <Copy size={12} muted>
        {view === "price"
          ? "市场价格 · USD"
          : view === "pe"
            ? "TTM 市盈率 · ×"
            : "溢价／折价 · %"}
      </Copy>
      {view !== "premium" && (
        <Copy size={12} muted>
          虚线：基准参考
        </Copy>
      )}
      <Pressable
        accessibilityRole="image"
        accessibilityLabel={text("每日估值历史，可用下方交易日按钮逐日读取。")}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onPress={(event) => {
          if (!width) return;
          const ratio = Math.min(
            1,
            Math.max(0, event.nativeEvent.locationX / width),
          );
          onSelect(Math.round(ratio * (points.length - 1)));
        }}
      >
        <Svg
          width="100%"
          height={220}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          accessible={false}
        >
          {[0, 0.5, 1].map((part) => (
            <Line
              key={part}
              x1={0}
              x2={W}
              y1={12 + part * (H - 24)}
              y2={12 + part * (H - 24)}
              stroke={t.border}
              strokeDasharray="3 5"
            />
          ))}
          {view === "premium" && (
            <Line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke={t.secondary} />
          )}
          {view !== "premium" && (
            <Path
              d={path("base", true)}
              stroke={t.accent}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              fill="none"
            />
          )}
          <Path
            d={path("main", false)}
            stroke={t.text}
            strokeWidth={1.8}
            fill="none"
            strokeLinejoin="round"
          />
          <Line
            x1={x(selected)}
            x2={x(selected)}
            y1={0}
            y2={H}
            stroke={t.secondary}
            strokeWidth={1}
          />
        </Svg>
      </Pressable>
      <View style={styles.row}>
        <Copy size={12} muted localize={false}>
          {points[0].date}
        </Copy>
        <Copy size={12} muted localize={false}>
          {`${min.toFixed(view === "price" ? 0 : 1)} – ${max.toFixed(view === "price" ? 0 : 1)} ${unit}`}
        </Copy>
        <Copy size={12} muted localize={false}>
          {points[points.length - 1].date}
        </Copy>
      </View>
    </View>
  );
}
function SimulationPanel({
  data,
  onSimulation,
}: {
  data: Valuation;
  onSimulation: (value: ValuationSimulation | null) => void;
}) {
  const t = useTheme();
  const f = useFormat();
  const defaults = data.current.calibration.multiples;
  const initial = () =>
    Object.fromEntries(
      valuationScenarios.map((key) => [
        key,
        defaults ? String(Number(defaults[key].toFixed(2))) : "",
      ]),
    );
  const [pe, setPe] = useState<Record<string, string>>(initial);
  const [growth, setGrowth] = useState<Record<string, string>>({
    conservative: "0",
    base: "0",
    optimistic: "0",
  });
  const [result, setResult] = useState<ValuationSimulation | null>(null);
  const [done, setDone] = useState({ key: "", failed: false });
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false);
  const base = initial();
  const edited = valuationScenarios.some(
    (key) => pe[key] !== base[key] || growth[key] !== "0",
  );
  const ready =
    data.current.status === "complete" &&
    data.current.share_basis_status === "verified";
  const multiples = Object.fromEntries(
    valuationScenarios.map((key) => [
      key,
      pe[key] === "" ? NaN : Number(pe[key]),
    ]),
  ) as Multiples;
  const rates = Object.fromEntries(
    valuationScenarios.map((key) => [
      key,
      growth[key] === "" ? NaN : Number(growth[key]) / 100,
    ]),
  ) as Multiples;
  const valid = validateValuationAssumptions(multiples, rates);
  // One request per distinct set of assumptions; the status is derived from its key.
  const requestKey = JSON.stringify([multiples, rates, retry]);
  const state = !valid
    ? "invalid"
    : done.key !== requestKey
      ? "pending"
      : done.failed
        ? "failed"
        : "success";
  useEffect(() => {
    if (!ready || !valid) return;
    const [nextMultiples, nextRates] = JSON.parse(requestKey) as [
      Multiples,
      Multiples,
    ];
    const controller = new AbortController();
    const timer = setTimeout(() => {
      simulateValuation(
        data,
        !edited && defaults ? defaults : nextMultiples,
        nextRates,
        controller.signal,
      )
        .then((value) => {
          if (controller.signal.aborted) return;
          setResult(value);
          onSimulation(edited ? value : null);
          setDone({ key: requestKey, failed: false });
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setDone({ key: requestKey, failed: true });
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [data, defaults, requestKey, edited, onSimulation, ready, valid]);
  if (!ready) return null;
  return (
    <Glass style={{ padding: 20, gap: 12 }}>
      <Section
        title="假设与未来情景"
        note="未来 3、6、9 个自然月的情景目标价，不是公司财季日期。"
      />
      {state === "pending" && (
        <Copy size={14} muted>
          正在计算…
        </Copy>
      )}
      {state === "invalid" && (
        <Failure message="请检查三种情景的 PE 顺序和增长率；下方保留上次有效结果。" />
      )}
      {state === "failed" && (
        <Failure
          message="情景计算失败，请重试。"
          retry={() => setRetry((value) => value + 1)}
        />
      )}
      {result?.projections.map((row) => (
        <View
          key={row.target_date}
          style={{
            gap: 8,
            paddingTop: 12,
            borderTopWidth: 1,
            borderColor: t.border,
          }}
        >
          <Copy size={12} muted localize={false}>
            {row.target_date}
          </Copy>
          <View style={{ flexDirection: "row" }}>
            {valuationScenarios.map((key) => (
              <View key={key} style={{ flex: 1, gap: 2 }}>
                <Copy size={12} muted>
                  {NAMES[key]}
                </Copy>
                <Copy size={15} bold localize={false}>
                  {f.money(row.scenarios[key].target_price)}
                </Copy>
                <Copy size={12} muted localize={false}>
                  {f.percent(row.scenarios[key].price_space)}
                </Copy>
              </View>
            ))}
          </View>
        </View>
      ))}
      <Button selected={open} onPress={() => setOpen((value) => !value)}>
        调整假设
      </Button>
      {open && (
        <>
          {valuationScenarios.map((key) => (
            <View key={key} style={{ gap: 8 }}>
              <Copy size={14} bold>
                {NAMES[key]}
              </Copy>
              <Field
                label="目标 TTM PE"
                value={pe[key]}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onChangeText={(value) =>
                  setPe((old) => ({ ...old, [key]: value }))
                }
              />
              <Field
                label="EPS 年增长率（%）"
                value={growth[key]}
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                onChangeText={(value) =>
                  setGrowth((old) => ({ ...old, [key]: value }))
                }
              />
            </View>
          ))}
          <Copy size={12} muted>
            默认增长率为 0%，表示盈利保持不变，不是盈利预测。PE
            须为正数且按保守、基准、乐观递增；增长率须大于 −100%。
          </Copy>
          <Button
            disabled={!edited}
            onPress={() => {
              setPe(initial());
              setGrowth({ conservative: "0", base: "0", optimistic: "0" });
              onSimulation(null);
            }}
          >
            恢复系统假设
          </Button>
        </>
      )}
    </Glass>
  );
}
