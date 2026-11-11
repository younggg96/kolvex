// The Web's Market overview pieces (components/decision/Market.tsx) at phone size:
// the horizontally scrolling index cards with a sparkline, and the creator-update rows.
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import Svg, { Polyline } from "react-native-svg";
import { quote } from "../lib/api";
import { apiRequest } from "../lib/http";
import type { MarketInstrument } from "../lib/marketBenchmarks";
import {
  COMPARISON_PERIODS,
  comparisonSnapshot,
  completedComparisonDate,
} from "../lib/marketComparison";
import {
  MARKET_RANGES,
  type MarketObservation,
} from "../lib/marketObservations";
import { useTheme } from "../lib/theme";
import GlassTabs, { glassTabsAvailable } from "./native/GlassTabs";
import { useResource } from "../lib/useResource";
import { usePreferences } from "../state/Preferences";
import { Copy, Glass, Skeleton, phone, useLiquidGlass } from "./UI";

export type RangeKey = (typeof MARKET_RANGES)[number]["key"];
type Bar = { date: string; close: number | null };

const loadSeries = async (
  instrument: MarketInstrument,
  range: RangeKey,
  signal: AbortSignal,
) => {
  const symbol = instrument.symbol;
  const spec = MARKET_RANGES.find((item) => item.key === range)!;
  let points: { date: string; close: number }[];
  if (instrument.source === "fred") {
    // FRED publishes daily observations only; intraday ranges show the latest days.
    const data = await apiRequest<{
      history: { date: string; value: number }[];
    }>(`/market/observations/${encodeURIComponent(symbol)}`, {
      signal,
      timeout: 20_000,
    });
    const all = data.history.map((p) => ({ date: p.date, close: p.value }));
    const days =
      range === "1D"
        ? 2
        : range === "1W"
          ? 6
          : range === "1M"
            ? 23
            : range === "3M"
              ? 66
              : 0;
    points = days ? all.slice(-days) : all;
    if (days) return points;
  } else {
    const data = await apiRequest<{ data: Bar[] }>(
      `/market/history/${encodeURIComponent(symbol)}?period=${spec.period}&interval=${spec.interval}`,
      { signal, timeout: 20_000 },
    );
    points = data.data.filter(
      (bar): bar is { date: string; close: number } =>
        bar.close !== null && Number.isFinite(bar.close),
    );
  }
  if (range === "1Y" || range === "QTD" || range === "YTD") {
    // These fetch extra history so the period's opening close is known.
    const last = points.at(-1)?.date.slice(0, 10) ?? "";
    const year = Number(last.slice(0, 4));
    const month = Number(last.slice(5, 7));
    const start =
      range === "1Y"
        ? `${year - 1}${last.slice(4)}`
        : range === "YTD"
          ? `${year - 1}-12-31`
          : `${year}-${String(Math.floor((month - 1) / 3) * 3).padStart(2, "0")}-31`;
    const from = points.findLastIndex((p) => p.date.slice(0, 10) <= start);
    return points.slice(Math.max(0, from));
  }
  return points;
};

export function Sparkline({
  values,
  color,
  height = phone(40),
}: {
  values: number[];
  color: string;
  height?: number;
}) {
  if (values.length < 2) return <View style={{ height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map(
      (v, i) =>
        `${((i / (values.length - 1)) * 100).toFixed(2)},${(36 - ((v - min) / span) * 32).toFixed(2)}`,
    )
    .join(" ");
  return (
    <Svg
      width="100%"
      height={height}
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
    >
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </Svg>
  );
}

/** One index card: name and date, symbol, level, change over the range, sparkline. */
export function InstrumentCard({
  instrument,
  range,
  revision,
}: {
  instrument: MarketInstrument;
  range: RangeKey;
  revision: number;
}) {
  const t = useTheme();
  const { locale } = usePreferences();
  const fred = instrument.source === "fred";
  const q = useResource(`card-quote:${instrument.symbol}:${revision}`, (s) =>
    fred ? Promise.resolve(null) : quote(instrument.symbol, s),
  );
  const series = useResource(
    `card-series:${instrument.symbol}:${range}:${revision}`,
    (s) => loadSeries(instrument, range, s),
    25_000,
  );
  const values = (series.data ?? []).map((p) => p.close);
  const first = values[0];
  const last = values.at(-1);
  // Yields change in basis points; prices and levels show the move and its percent.
  const points = instrument.unit === "percent";
  const versusPriorClose = range === "1D" && !fred;
  const value = q.data?.current_price ?? last ?? null;
  const delta = versusPriorClose
    ? (q.data?.change ?? null)
    : value != null && first != null
      ? value - first
      : null;
  const percent = versusPriorClose
    ? (q.data?.change_percent ?? null)
    : delta != null && first
      ? (delta / Math.abs(first)) * 100
      : null;
  const change = points ? delta : percent;
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  const sign = (n: number) => (n >= 0 ? "+" : "−");
  const changeText =
    delta == null
      ? null
      : points
        ? `${sign(delta)}${fmt(Math.abs(delta) * 100)} bp`
        : percent == null
          ? null
          : `${sign(delta)}${fmt(Math.abs(delta))} (${sign(delta)}${Math.abs(percent).toFixed(2)}%)`;
  const spec = MARKET_RANGES.find((item) => item.key === range)!;
  const rangeLabel = versusPriorClose
    ? null
    : locale === "en"
      ? spec.en
      : spec.zh;
  const date = series.data?.at(-1)?.date.slice(0, 10) ?? "";
  const positive = (change ?? 0) >= 0;
  const color = change == null ? t.secondary : positive ? t.accent : t.negative;
  const name = locale === "en" ? instrument.en : instrument.zh;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={() =>
        router.push(`/stock/${encodeURIComponent(instrument.symbol)}`)
      }
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Glass style={{ width: phone(180), padding: 12, gap: 1 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 6,
          }}
        >
          <View style={{ flex: 1 }}>
            <Copy size={14} lines={1} localize={false}>
              {name}
            </Copy>
          </View>
          <Copy size={12} muted localize={false}>
            {date ? `${date.slice(5, 7)}/${date.slice(8, 10)}` : "—"}
          </Copy>
        </View>
        <Copy size={12} muted lines={1} localize={false}>
          {instrument.symbol}
        </Copy>
        {value == null && q.loading ? (
          <Skeleton width="70%" height={18} style={{ marginTop: 6 }} />
        ) : (
          <View style={{ marginTop: 6 }}>
            <Copy size={20} bold localize={false}>
              {value == null ? "—" : `${fmt(value)}${points ? "%" : ""}`}
            </Copy>
          </View>
        )}
        {changeText == null ? (
          <Copy size={12} muted>
            {q.loading || series.loading ? " " : "暂无涨跌数据"}
          </Copy>
        ) : (
          <Copy size={12} color={color} lines={1} localize={false}>
            {changeText}
          </Copy>
        )}
        {rangeLabel && (
          <Copy size={12} muted lines={1}>
            {rangeLabel}
          </Copy>
        )}
        <View style={{ marginTop: 8 }}>
          {series.loading && !series.data ? (
            <Skeleton height={phone(40)} />
          ) : (
            <Sparkline values={values} color={color} />
          )}
        </View>
      </Glass>
    </Pressable>
  );
}

export function InstrumentRow({
  instruments,
  range,
  revision,
}: {
  instruments: readonly MarketInstrument[];
  range: RangeKey;
  revision: number;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -phone(16) }}
      contentContainerStyle={{ gap: phone(12), paddingHorizontal: phone(16) }}
    >
      {instruments.map((item) => (
        <InstrumentCard
          key={item.symbol}
          instrument={item}
          range={range}
          revision={revision}
        />
      ))}
    </ScrollView>
  );
}

type ComparisonRowData = {
  instrument: MarketInstrument;
  snapshot: ReturnType<typeof comparisonSnapshot>;
  failed: boolean;
};

async function loadComparison(
  instrument: MarketInstrument,
  signal: AbortSignal,
): Promise<ComparisonRowData> {
  try {
    const history: MarketObservation[] =
      instrument.source === "fred"
        ? (
            await apiRequest<{ history: MarketObservation[] }>(
              `/market/observations/${encodeURIComponent(instrument.symbol)}`,
              { signal, timeout: 20_000 },
            )
          ).history
        : (
            await apiRequest<{ data: Bar[] }>(
              `/market/history/${encodeURIComponent(instrument.symbol)}?period=2y&interval=1d`,
              { signal, timeout: 20_000 },
            )
          ).data
            .filter((b) => b.close !== null && Number.isFinite(b.close))
            .map((b) => ({ date: b.date.slice(0, 10), value: b.close! }));
    const through = completedComparisonDate(instrument);
    return {
      instrument,
      snapshot: comparisonSnapshot(
        history.filter((p) => p.date.slice(0, 10) <= through),
        instrument,
      ),
      failed: false,
    };
  } catch (error) {
    if (signal.aborted) throw error;
    return {
      instrument,
      snapshot: comparisonSnapshot([], instrument),
      failed: true,
    };
  }
}

const NAME_COL = 112;
const VALUE_COL = 96;
const PERIOD_COL = 76;

/** The Web's list view (MarketComparison): latest close and every period's change. */
export function ComparisonTable({
  instruments,
  revision,
}: {
  instruments: readonly MarketInstrument[];
  revision: number;
}) {
  const t = useTheme();
  const { locale } = usePreferences();
  const rows = useResource(
    `comparison:${instruments.map((i) => i.symbol).join(",")}:${revision}`,
    (signal) =>
      Promise.all(instruments.map((item) => loadComparison(item, signal))),
    60_000,
  );
  const cell = { paddingHorizontal: 10, justifyContent: "center" } as const;
  const head = (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.wash,
        minHeight: 40,
      }}
    >
      <View style={[cell, { width: VALUE_COL, alignItems: "flex-end" }]}>
        <Copy size={12} muted>
          最新收盘
        </Copy>
      </View>
      {COMPARISON_PERIODS.map((period) => (
        <View
          key={period.key}
          style={[cell, { width: PERIOD_COL, alignItems: "flex-end" }]}
        >
          <Copy size={12} muted localize={false}>
            {locale === "en" ? period.en : period.zh}
          </Copy>
        </View>
      ))}
    </View>
  );
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  return (
    <Glass style={{ padding: 0, overflow: "hidden" }}>
      <View style={{ flexDirection: "row" }}>
        <View
          style={{
            width: NAME_COL,
            borderRightWidth: 1,
            borderColor: t.border,
          }}
        >
          <View style={[cell, { minHeight: 40, backgroundColor: t.wash }]}>
            <Copy size={12} muted>
              标的 / 日期
            </Copy>
          </View>
          {instruments.map((instrument, index) => {
            const row = rows.data?.[index];
            return (
              <Pressable
                key={instrument.symbol}
                accessibilityRole="button"
                onPress={() =>
                  router.push(`/stock/${encodeURIComponent(instrument.symbol)}`)
                }
                style={({ pressed }) => [
                  cell,
                  {
                    height: 52,
                    borderTopWidth: 1,
                    borderColor: t.border,
                    opacity: pressed ? 0.6 : 1,
                  },
                ]}
              >
                <Copy size={13} bold lines={1} localize={false}>
                  {locale === "en" ? instrument.en : instrument.zh}
                </Copy>
                <Copy size={11} muted lines={1} localize={false}>
                  {`${instrument.symbol} · ${row?.snapshot.date ? row.snapshot.date.slice(5) : "—"}`}
                </Copy>
              </Pressable>
            );
          })}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            {head}
            {instruments.map((instrument, index) => {
              const row = rows.data?.[index];
              const unit = instrument.unit === "percent" ? "percent" : "";
              return (
                <View
                  key={instrument.symbol}
                  style={{
                    flexDirection: "row",
                    height: 52,
                    borderTopWidth: 1,
                    borderColor: t.border,
                  }}
                >
                  <View
                    style={[cell, { width: VALUE_COL, alignItems: "flex-end" }]}
                  >
                    {rows.loading && !rows.data ? (
                      <Skeleton width={56} height={14} />
                    ) : (
                      <Copy size={14} bold localize={false}>
                        {row?.snapshot.value == null
                          ? "—"
                          : `${fmt(row.snapshot.value)}${unit ? "%" : ""}`}
                      </Copy>
                    )}
                  </View>
                  {COMPARISON_PERIODS.map((period) => {
                    const value = row?.snapshot.changes[period.key] ?? null;
                    const rounded =
                      value === null
                        ? null
                        : Math.round(Math.abs(value) * 100) / 100;
                    const direction = rounded ? (value! > 0 ? 1 : -1) : 0;
                    const suffix =
                      row?.snapshot.unit === "percent"
                        ? "%"
                        : row?.snapshot.unit === "pp"
                          ? " pp"
                          : locale === "en"
                            ? " pts"
                            : " 点";
                    return (
                      <View
                        key={period.key}
                        style={[
                          cell,
                          { width: PERIOD_COL, alignItems: "flex-end" },
                        ]}
                      >
                        {rows.loading && !rows.data ? (
                          <Skeleton width={44} height={12} />
                        ) : (
                          <Copy
                            size={13}
                            localize={false}
                            color={
                              direction > 0
                                ? t.accent
                                : direction < 0
                                  ? t.negative
                                  : t.secondary
                            }
                          >
                            {rounded === null
                              ? "—"
                              : `${direction > 0 ? "+" : direction < 0 ? "−" : ""}${rounded.toFixed(2)}${suffix}`}
                          </Copy>
                        )}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Glass>
  );
}

/** The Web's Cards / List display switch: two icon-only segments. */
export function ViewToggle({
  value,
  onChange,
}: {
  value: "card" | "list";
  onChange: (value: "card" | "list") => void;
}) {
  const t = useTheme();
  const glass = useLiquidGlass();
  // iOS draws the switch as the same native Liquid Glass track as the range tabs.
  if (glass && glassTabsAvailable)
    return (
      <GlassTabs
        size="sm"
        values={[
          ["card", "卡片"],
          ["list", "列表"],
        ]}
        icons={{ card: "square.grid.2x2", list: "list.bullet" }}
        value={value}
        onChange={(key) => onChange(key as "card" | "list")}
      />
    );
  return (
    <View
      style={{
        flexDirection: "row",
        gap: 2,
        padding: 3,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: t.rim,
      }}
    >
      {(
        [
          ["card", "square.grid.2x2", "grid_view", "卡片"],
          ["list", "list.bullet", "list", "列表"],
        ] as const
      ).map(([key, ios, android, label]) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ selected: value === key }}
          hitSlop={{ top: 8, bottom: 8 }}
          onPress={() => onChange(key)}
          style={{
            width: phone(32),
            height: phone(32),
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor:
              value === key ? "rgba(255,255,255,0.97)" : "transparent",
          }}
        >
          <SymbolView
            name={{ ios, android, web: android } as never}
            size={13}
            tintColor={value === key ? "#111111" : t.text}
          />
        </Pressable>
      ))}
    </View>
  );
}

/** The Web's StockTrend: a stock's line over the market range, coloured by its move. */
export function MiniTrend({
  symbol,
  range,
  revision,
  height = phone(28),
  positive,
}: {
  symbol: string;
  range: RangeKey;
  revision: number;
  height?: number;
  /** The row's own move, which wins over the line's first and last points. */
  positive?: boolean;
}) {
  const t = useTheme();
  const series = useResource(
    `mini-trend:${symbol}:${range}:${revision}`,
    (s) => loadSeries({ symbol, en: symbol, zh: symbol }, range, s),
    25_000,
  );
  const values = (series.data ?? []).map((p) => p.close);
  if (series.loading && !series.data) return <Skeleton height={height} />;
  const up = positive ?? (values.at(-1) ?? 0) >= (values[0] ?? 0);
  return (
    <Sparkline
      values={values}
      height={height}
      color={values.length < 2 ? t.secondary : up ? t.accent : t.negative}
    />
  );
}
