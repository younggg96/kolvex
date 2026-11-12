// The Web's stock-page price card (StockWorkspace "价格走势" + PriceGraph) at phone size:
// the range's change, an "Advanced" link to the technical chart, the line
// with its price scale, and the range chips 1日 … 5年.
import { useState } from "react";
import { Pressable, View } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import Svg, {
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { apiRequest } from "../lib/http";
import type { Bar } from "../lib/models";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { usePreferences } from "../state/Preferences";
import { ChartSkeleton } from "./Skeletons";
import { Copy, Failure, Glass, phone } from "./UI";

const RANGES = [
  { key: "1D", zh: "1日", en: "1D", period: "1d", interval: "5m" },
  { key: "1W", zh: "1周", en: "1W", period: "5d", interval: "15m" },
  { key: "1M", zh: "1月", en: "1M", period: "1mo", interval: "1h" },
  { key: "3M", zh: "3月", en: "3M", period: "3mo", interval: "1d" },
  { key: "6M", zh: "6月", en: "6M", period: "6mo", interval: "1d" },
  { key: "YTD", zh: "今年", en: "YTD", period: "ytd", interval: "1d" },
  { key: "1Y", zh: "1年", en: "1Y", period: "1y", interval: "1d" },
  { key: "5Y", zh: "5年", en: "5Y", period: "5y", interval: "1wk" },
] as const;

const W = 320;
const H = 180;
const SCALE = 44;

function Graph({
  bars,
  up,
}: {
  bars: { date: string; close: number }[];
  up: boolean;
}) {
  const t = useTheme();
  const values = bars.map((b) => b.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const plot = W - SCALE;
  const y = (v: number) => 12 + (1 - (v - min) / span) * (H - 24);
  const x = (i: number) => (i / (values.length - 1)) * plot;
  const line = values
    .map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(v).toFixed(2)}`)
    .join(" ");
  const color = up ? t.chartUp : t.chartDown;
  const ticks = [max, min + span / 2, min];
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", {
      maximumFractionDigits: v >= 1000 ? 0 : 2,
      minimumFractionDigits: v >= 1000 ? 0 : 2,
    }).format(v);
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
      <Defs>
        <LinearGradient id="area" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {ticks.map((v) => (
        <Line
          key={v}
          x1={0}
          x2={plot}
          y1={y(v)}
          y2={y(v)}
          stroke={t.border}
          strokeDasharray="2 4"
        />
      ))}
      <Path d={`${line} L${plot},${H} L0,${H} Z`} fill="url(#area)" />
      <Path
        d={line}
        stroke={color}
        strokeWidth={1.6}
        fill="none"
        strokeLinejoin="round"
      />
      {ticks.map((v) => (
        <SvgText
          key={`t${v}`}
          x={W - 2}
          y={y(v) + 3.5}
          fontSize={9.5}
          fill={t.secondary}
          textAnchor="end"
        >
          {fmt(v)}
        </SvgText>
      ))}
    </Svg>
  );
}

export function StockPriceCard({
  symbol,
  currency,
  revision,
}: {
  symbol: string;
  currency?: string;
  revision: number;
}) {
  const t = useTheme();
  const { locale } = usePreferences();
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("3M");
  const [info, setInfo] = useState(false);
  const spec = RANGES.find((item) => item.key === range)!;
  const bars = useResource(
    `price-card:${symbol}:${range}:${revision}`,
    (signal) =>
      apiRequest<{ data: Bar[] }>(
        `/market/history/${encodeURIComponent(symbol)}?period=${spec.period}&interval=${spec.interval}`,
        { signal, timeout: 25_000 },
      ).then((data) =>
        data.data.filter(
          (b): b is { date: string; close: number } =>
            b.close != null && Number.isFinite(b.close),
        ),
      ),
  );
  const points = bars.data ?? [];
  const first = points[0]?.close;
  const last = points.at(-1)?.close;
  const change = first && last != null ? ((last - first) / first) * 100 : null;
  const up = (change ?? 0) >= 0;
  return (
    <Glass style={{ padding: 16, gap: 10 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap",
        }}
      >
        {change != null && (
          <Copy
            size={16}
            bold
            localize={false}
            color={up ? t.accent : t.negative}
          >
            {`${up ? "+" : "−"}${Math.abs(change).toFixed(2)}%`}
          </Copy>
        )}
        <Copy size={12} muted>
          所选区间
        </Copy>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="图表说明"
          hitSlop={10}
          onPress={() => setInfo((v) => !v)}
        >
          <SymbolView
            name={{ ios: "info.circle", android: "info", web: "info" }}
            size={13}
            tintColor={t.secondary}
          />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          onPress={() =>
            router.push(`/technical/${encodeURIComponent(symbol)}`)
          }
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: phone(12),
            minHeight: phone(32),
            borderRadius: 999,
            backgroundColor: t.wash,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <SymbolView
            name={{
              ios: "chart.xyaxis.line",
              android: "candlestick_chart",
              web: "candlestick_chart",
            }}
            size={12}
            tintColor={t.text}
          />
          <Copy size={13} bold>
            高级
          </Copy>
        </Pressable>
      </View>
      {info && (
        <Copy size={12} muted>
          涨跌按所选区间首尾价格计算。高级图表提供 K 线、指标、AI
          画线与画线图层。
        </Copy>
      )}
      {bars.loading && !bars.data ? (
        <ChartSkeleton height={H} />
      ) : bars.error && !bars.data ? (
        <Failure message="走势暂不可用。" retry={bars.refresh} />
      ) : points.length < 2 ? (
        <View
          style={{ height: H, alignItems: "center", justifyContent: "center" }}
        >
          <Copy size={12} muted>
            这个区间暂无走势数据。
          </Copy>
        </View>
      ) : (
        <Graph bars={points} up={up} />
      )}
      {/* Every range fits on one line, evenly spaced, like a segmented control. */}
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: "row",
          padding: 3,
          borderRadius: 999,
          backgroundColor: t.wash,
        }}
      >
        {RANGES.map((item) => {
          const selected = item.key === range;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setRange(item.key)}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: phone(32),
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 999,
                backgroundColor: selected
                  ? "rgba(255,255,255,0.97)"
                  : "transparent",
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Copy
                size={12}
                bold={selected}
                lines={1}
                localize={false}
                color={selected ? "#111111" : t.secondary}
              >
                {locale === "en" ? item.en : item.zh}
              </Copy>
            </Pressable>
          );
        })}
      </View>
    </Glass>
  );
}
