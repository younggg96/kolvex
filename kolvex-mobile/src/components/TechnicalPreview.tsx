// The Web's stock-page Technicals tab at phone size (ChartView compact + PriceGraph):
// price · change · 所选区间 with after-hours below, a close line carrying the saved AI
// plan, levels and zones with their axis tags, creator calls, a peak tag, the range bar,
// a collapsed 画线图层 line and the 高级 entry to the full-screen chart. The saved
// AI analysis follows underneath.
import { useMemo, useState } from "react";
import { Alert, Pressable, View, useWindowDimensions } from "react-native";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { apiRequest } from "../lib/http";
import { useText } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import { useResource } from "../lib/useResource";
import { validBars } from "../lib/technicalData";
import { useStoredState } from "../lib/useStoredState";
import { analysisDrawings, planDrawings } from "../lib/aiDrawings";
import {
  latestQuote,
  positive,
  sessionLabels,
  useSavedChartAnalysis,
  type ChartQuote,
} from "../lib/chartQuote";
import {
  advancedRanges,
  isIntraday,
  rangeLabels,
  type AdvancedRange,
} from "../lib/chartTimeframes";
import {
  drawingGroupLabels,
  drawingGroups,
  type DrawingGroup,
  type PriceBar,
} from "../lib/technicalTypes";
import { useAuth } from "../state/Auth";
import { AdvancedChart, formatPrice } from "./AdvancedChart";
import type { CallEvent } from "./CandleGraph";
import { ChartAiPanel } from "./TechnicalAI";
import { Filters } from "./Content";
import { ChartSkeleton } from "./Skeletons";
import { Chip, Copy, Failure, Glass } from "./UI";

/** Exactly the selected window, as the Web's compact graph loads it. */
const PREVIEW: Record<AdvancedRange, { period: string; interval: string }> = {
  "1D": { period: "1d", interval: "5m" },
  "1W": { period: "5d", interval: "15m" },
  "1M": { period: "1mo", interval: "1h" },
  "3M": { period: "3mo", interval: "1d" },
  "6M": { period: "6mo", interval: "1d" },
  YTD: { period: "ytd", interval: "1d" },
  "1Y": { period: "1y", interval: "1d" },
  "5Y": { period: "5y", interval: "1wk" },
  ALL: { period: "max", interval: "1mo" },
};
const HEIGHT = 300;
const NO_GROUPS: ReadonlySet<DrawingGroup> = new Set();
const signed = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

export function TechnicalPreview({ symbol }: { symbol: string }) {
  const t = useTheme();
  const text = useText();
  const user = useAuth().session?.user.id;
  const { width } = useWindowDimensions();
  const [range, setRange] = useState<AdvancedRange>("3M");
  const [active, setActive] = useState<number | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [drawingsHidden, setDrawingsHidden] = useState(false);
  const spec = PREVIEW[range];
  const intraday = isIntraday(spec.interval);
  const history = useResource(`preview:${symbol}:${range}`, async (signal) =>
    validBars(
      (
        await apiRequest<{ data: PriceBar[] }>(
          `/market/history/${encodeURIComponent(symbol)}?period=${spec.period}&interval=${spec.interval}`,
          { signal, timeout: 25_000 },
        )
      ).data,
    ),
  );
  const bars = useMemo(() => history.data ?? [], [history.data]);
  const quote = useResource(`chart-quote:${symbol}`, (signal) =>
    apiRequest<ChartQuote>(`/market/quote/${encodeURIComponent(symbol)}`, {
      signal,
    }),
  );
  const opinions = useResource(`chart-calls:${symbol}`, (signal) =>
    apiRequest<{ opinions?: CallEvent[] }>(
      `/youtube-opinions/stocks/${encodeURIComponent(symbol)}`,
      { signal, timeout: 30_000 },
    ).then((data) => data.opinions ?? []),
  );
  const saved = useSavedChartAnalysis(symbol, user);
  const [layerPrefs, setLayerPrefs] = useStoredState<
    Partial<Record<DrawingGroup, boolean>>
  >(
    "kolvex:chart-layers",
    {},
    (v): v is Partial<Record<DrawingGroup, boolean>> =>
      !!v && typeof v === "object",
  );
  // Phones start with trend lines and patterns off, as on the Web.
  const layerOn = (g: DrawingGroup) =>
    layerPrefs[g] ?? !(g === "trend" || g === "pattern");
  const aiDrawings = useMemo(
    () => [
      ...(saved.analysis ? planDrawings(saved.analysis) : []),
      ...(saved.drawings ? analysisDrawings(saved.drawings) : []),
    ],
    [saved.analysis, saved.drawings],
  );
  const presentGroups = drawingGroups.filter((g) =>
    aiDrawings.some((d) => d.group === g),
  );
  const shownGroups = presentGroups.filter(layerOn);
  const hiddenGroups = new Set(drawingGroups.filter((g) => !layerOn(g)));

  const latest = latestQuote(quote.data, false);
  const extended = latestQuote(quote.data);
  const showExtended = !!extended && extended.session !== "regular";
  const activeBar = active === null ? null : (bars[active] ?? null);
  const first = bars[0];
  const baseline =
    range === "1D" && positive(quote.data?.previous_close)
      ? quote.data!.previous_close!
      : first?.close;
  const price = activeBar
    ? activeBar.close
    : (latest?.price ?? bars.at(-1)?.close);
  const change =
    price !== undefined && baseline
      ? ((price - baseline) / baseline) * 100
      : null;
  const open = () => router.push(`/technical/${encodeURIComponent(symbol)}`);

  return (
    <>
      <Glass style={{ padding: 16, gap: 8 }}>
        {/* Price · change · window label, with the quote details one tap away. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              columnGap: 8,
            }}
          >
            {price !== undefined && (
              <Copy size={18} bold localize={false}>
                {formatPrice(price)}
              </Copy>
            )}
            {change !== null && (
              <Copy
                size={15}
                bold
                localize={false}
                color={change >= 0 ? t.chartUp : t.chartDown}
              >
                {signed(change)}
              </Copy>
            )}
            <Copy size={12} muted>
              {activeBar
                ? activeBar.date.slice(0, intraday ? 16 : 10).replace("T", " ")
                : "所选区间"}
            </Copy>
            {latest && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={text("行情可能延迟")}
                hitSlop={12}
                onPress={() =>
                  Alert.alert(
                    text("行情可能延迟"),
                    `${quote.data?.source || "Yahoo Finance"}${latest.time ? ` · ${new Date(latest.time * 1000).toLocaleString()}` : ""}`,
                  )
                }
              >
                <SymbolView
                  name="info.circle"
                  size={14}
                  tintColor={t.secondary}
                />
              </Pressable>
            )}
          </View>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={text("高级图表")}
            hitSlop={10}
            onPress={open}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              minHeight: 32,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <SymbolView
              name="arrow.up.left.and.arrow.down.right"
              size={13}
              tintColor={t.secondary}
            />
            <Copy size={13} bold muted>
              高级
            </Copy>
          </Pressable>
        </View>
        {showExtended && extended && (
          <Copy size={12} muted localize={false}>
            {`${text(sessionLabels[extended.session])} ${formatPrice(extended.price)}${extended.changePercent !== null ? ` (${signed(extended.changePercent)})` : ""}`}
          </Copy>
        )}

        {history.loading && !history.data ? (
          <ChartSkeleton height={HEIGHT} />
        ) : history.error && !history.data ? (
          <Failure message="走势暂不可用。" retry={history.refresh} />
        ) : bars.length < 2 ? (
          <View
            style={{
              height: HEIGHT,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Copy size={12} muted>
              这个区间暂无走势数据。
            </Copy>
          </View>
        ) : (
          <AdvancedChart
            variant="line"
            readOnly
            bars={bars}
            view={{ start: 0, end: bars.length }}
            height={HEIGHT}
            intraday={intraday}
            autoScale
            indicators={[]}
            drawings={drawingsHidden ? [] : aiDrawings}
            hiddenGroups={drawingsHidden ? NO_GROUPS : hiddenGroups}
            selectedId={null}
            onSelectDrawing={() => {}}
            onDrawingsChange={() => {}}
            tool="cursor"
            color=""
            magnet={false}
            onCommit={() => {}}
            events={opinions.data ?? []}
            showCalls
            containing={spec.interval === "1wk" || spec.interval === "1mo"}
            active={active}
            onActive={setActive}
            forecast={null}
            onDoubleTap={open}
          />
        )}

        <Filters
          size="sm"
          maxWidth={width - 64}
          values={advancedRanges.map((r) => [r, rangeLabels[r]] as const)}
          value={range}
          onChange={(v) => {
            setRange(v as AdvancedRange);
            setActive(null);
          }}
        />

        {/* AI layers as one summary line; tapping opens the toggles. */}
        {presentGroups.length > 0 && (
          <View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: layersOpen }}
              onPress={() => setLayersOpen(!layersOpen)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                minHeight: 44,
              }}
            >
              <SymbolView
                name="square.3.layers.3d"
                size={16}
                tintColor={t.secondary}
              />
              <Copy size={14} bold>
                画线图层
              </Copy>
              <View style={{ flex: 1 }}>
                <Copy
                  size={13}
                  lines={1}
                  muted={!!shownGroups.length && !drawingsHidden}
                  color={
                    shownGroups.length && !drawingsHidden
                      ? undefined
                      : t.chartDown
                  }
                >
                  {shownGroups.length && !drawingsHidden
                    ? shownGroups.map((g) => drawingGroupLabels[g]).join("、")
                    : "已全部隐藏"}
                </Copy>
              </View>
              <SymbolView
                name={layersOpen ? "chevron.up" : "chevron.down"}
                size={12}
                tintColor={t.secondary}
              />
            </Pressable>
            {layersOpen && (
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  gap: 8,
                  paddingBottom: 4,
                }}
              >
                {presentGroups.map((g) => (
                  <Chip
                    key={g}
                    size="sm"
                    selected={layerOn(g) && !drawingsHidden}
                    onPress={() =>
                      setLayerPrefs({ ...layerPrefs, [g]: !layerOn(g) })
                    }
                  >
                    {drawingGroupLabels[g]}
                  </Chip>
                ))}
                <Chip
                  size="sm"
                  onPress={() => setDrawingsHidden(!drawingsHidden)}
                >
                  {drawingsHidden ? "显示画线" : "隐藏画线"}
                </Chip>
              </View>
            )}
          </View>
        )}
      </Glass>

      {!!user && (
        <Glass style={{ padding: 16, gap: 12 }}>
          <ChartAiPanel
            symbol={symbol}
            query={spec}
            interval={spec.interval}
            viewStart={first?.date}
            viewEnd={bars.at(-1)?.date}
            analysis={saved.analysis}
            onResult={(operation, result) =>
              operation === "drawings"
                ? saved.setDrawings(result)
                : saved.setAnalysis(result)
            }
            forecastVisible={false}
          />
        </Glass>
      )}
    </>
  );
}
