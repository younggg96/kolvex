// The Web's Market overview pieces (components/decision/Market.tsx) at phone size:
// the horizontally scrolling index cards with a sparkline, and the creator-update rows.
import { Pressable, ScrollView, View } from "react-native";
import { router } from "expo-router";
import Svg, { Polyline } from "react-native-svg";
import { quote } from "../lib/api";
import { apiRequest } from "../lib/http";
import type { MarketInstrument } from "../lib/marketBenchmarks";
import { MARKET_RANGES } from "../lib/marketObservations";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { usePreferences } from "../state/Preferences";
import { Copy, Glass, Skeleton, phone } from "./UI";

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

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <View style={{ height: phone(40) }} />;
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
      height={phone(40)}
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
  // Yields change in percentage points; prices and levels in percent.
  const points = instrument.unit === "percent";
  const change =
    range === "1D" && !fred
      ? (q.data?.change_percent ?? null)
      : first != null && last != null && (points || first)
        ? points
          ? last - first
          : ((last - first) / first) * 100
        : null;
  const value = q.data?.current_price ?? last ?? null;
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
      <Glass style={{ width: phone(180), padding: 12, gap: 2 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            gap: 6,
          }}
        >
          <View style={{ flex: 1 }}>
            <Copy size={14} bold lines={1} localize={false}>
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
          <Skeleton width="70%" height={20} style={{ marginTop: 6 }} />
        ) : (
          <View style={{ marginTop: 6 }}>
            <Copy size={20} bold localize={false}>
              {value == null
                ? "—"
                : `${new Intl.NumberFormat("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(value)}${points ? "%" : ""}`}
            </Copy>
          </View>
        )}
        <Copy size={12} bold color={color} localize={false}>
          {change == null
            ? "—"
            : `${change > 0 ? "+" : ""}${change.toFixed(2)}${points ? " pp" : "%"}`}
        </Copy>
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
