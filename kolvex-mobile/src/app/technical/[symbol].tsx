// The Web's fullscreen advanced chart (PriceChart's dialog around ChartView mode="advanced")
// laid out as it is on a phone: header, OHLC line, drawing toolbar, price header, plot,
// range bar with the interval menu, chart toggles, drawing layers and the oscillator.
import {
  ActionSheetIOS,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { router, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChartCardSkeleton } from "../../components/Skeletons";
import { useChartGestures } from "../../lib/useChartGestures";
import { apiRequest } from "../../lib/http";
import { useResource } from "../../lib/useResource";
import { validBars } from "../../lib/technicalData";
import { isSymbol } from "../../lib/models";
import { useText } from "../../lib/i18n";
import { useTheme } from "../../lib/theme";
import {
  drawingColors,
  drawingGroupLabels,
  drawingGroups,
  type AiTechnicalAnalysis,
  type ChartVersion,
  type Drawing,
  type DrawingGroup,
  type DrawingTool,
  type PriceBar,
} from "../../lib/technicalTypes";
import {
  indicatorMeta,
  indicatorOrder,
  type IndicatorKey,
} from "../../lib/technicalIndicators";
import {
  advancedHistoryQuery,
  advancedRanges,
  defaultInterval,
  intervalLabels,
  isIntraday,
  rangeIntervals,
  rangeLabels,
  rangeStart,
  type AdvancedRange,
  type ChartInterval,
} from "../../lib/chartTimeframes";
import { analysisDrawings, planDrawings } from "../../lib/aiDrawings";
import { useSyncedDrawings, syncLabels } from "../../lib/useSyncedDrawings";
import { klineForecast, type KlineForecast } from "../../lib/stockExtrasApi";
import { Button, Chip, Copy, Page } from "../../components/UI";
import { Filters } from "../../components/Content";
import type { CallEvent } from "../../components/CandleGraph";
import {
  AdvancedChart,
  OscillatorPane,
  formatPrice,
  oscillatorLabels,
  useChartColors,
  type Oscillator,
} from "../../components/AdvancedChart";
import { useAuth } from "../../state/Auth";
import { ChartAiPanel } from "../../components/TechnicalAI";

export default function Technical() {
  const p = useLocalSearchParams<{ symbol: string }>();
  const symbol = (p.symbol || "").toUpperCase();
  return isSymbol(symbol) ? (
    <Workspace key={symbol} symbol={symbol} />
  ) : (
    <Page title="技术图表">
      <Copy>股票代码无效。</Copy>
    </Page>
  );
}

const TOOLS: {
  value: DrawingTool;
  icon: SymbolViewProps["name"];
  label: string;
}[] = [
  { value: "cursor", icon: "cursorarrow", label: "光标（选择、拖动画线）" },
  { value: "trend", icon: "line.diagonal", label: "趋势线" },
  { value: "ray", icon: "arrow.up.right", label: "射线" },
  { value: "extended", icon: "arrow.left.and.right", label: "双向延长线" },
  { value: "vline", icon: "arrow.up.and.down", label: "垂直时间线" },
  {
    value: "fibext",
    icon: "chart.line.uptrend.xyaxis",
    label: "斐波那契扩展（两点投射）",
  },
  { value: "hline", icon: "minus", label: "水平线" },
  { value: "rect", icon: "rectangle", label: "矩形区域" },
  { value: "fib", icon: "chart.bar.doc.horizontal", label: "斐波那契回撤" },
  { value: "measure", icon: "ruler", label: "测量涨跌幅" },
];
const DEFAULT_INDICATORS: IndicatorKey[] = [
  "volume",
  "vwap",
  "ema20",
  "ema50",
  "ema200",
];
const MIN_BARS = 8;
/** The oscillator's plot height; its tab row adds 28pt. */
const OSC_HEIGHT = 64;
const fixedPrice = (v: number) =>
  v.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

type StockQuote = {
  current_price: number | null;
  change_percent: number | null;
  previous_close?: number | null;
  market_time?: number | null;
  pre_market_price?: number | null;
  pre_market_time?: number | null;
  post_market_price?: number | null;
  post_market_time?: number | null;
  source?: string | null;
};

const positive = (v: number | null | undefined): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0;
/** The Web's latestChartQuote: an extended-hours price only when it is provably newer. */
function latestQuote(quote: StockQuote | undefined, includeExtended = true) {
  if (!quote || !positive(quote.current_price)) return null;
  let price = quote.current_price;
  let time = positive(quote.market_time) ? quote.market_time : undefined;
  let session: "regular" | "pre" | "post" = "regular";
  if (time && includeExtended)
    for (const c of [
      {
        price: quote.pre_market_price,
        time: quote.pre_market_time,
        session: "pre" as const,
      },
      {
        price: quote.post_market_price,
        time: quote.post_market_time,
        session: "post" as const,
      },
    ])
      if (positive(c.price) && positive(c.time) && c.time > time) {
        price = c.price;
        time = c.time;
        session = c.session;
      }
  const baseline =
    session === "regular" ? quote.previous_close : quote.current_price;
  const changePercent =
    session === "regular" && Number.isFinite(quote.change_percent)
      ? quote.change_percent
      : positive(baseline)
        ? ((price - baseline) / baseline) * 100
        : null;
  return { price, time, session, changePercent };
}
const sessionLabels = {
  regular: "常规交易 · 较昨收",
  pre: "盘前 · 较收盘",
  post: "盘后 · 较收盘",
};
const signedPercent = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
const formatVolume = (v: number) =>
  v >= 1e9
    ? `${(v / 1e9).toFixed(2)}B`
    : v >= 1e6
      ? `${(v / 1e6).toFixed(2)}M`
      : v >= 1e3
        ? `${(v / 1e3).toFixed(1)}K`
        : String(v);

/** Small preference that survives restarts, as the Web keeps it in localStorage. */
function useStoredState<T>(
  key: string,
  initial: T,
  valid: (v: unknown) => v is T,
) {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    void AsyncStorage.getItem(key)
      .then((raw) => {
        if (raw === null) return;
        const parsed = JSON.parse(raw);
        if (valid(parsed)) setValue(parsed);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = useCallback(
    (next: T) => {
      setValue(next);
      void AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
    },
    [key],
  );
  return [value, set] as const;
}

function IconButton({
  icon,
  label,
  onPress,
  active = false,
  disabled = false,
  children,
}: {
  icon?: SymbolViewProps["name"];
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  const text = useText();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text(label)}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active
          ? t.washStrong
          : pressed
            ? t.wash
            : "transparent",
        opacity: disabled ? 0.4 : 1,
      })}
    >
      {children ?? (
        <SymbolView
          name={icon!}
          size={16}
          weight="medium"
          tintColor={active ? t.text : t.secondary}
        />
      )}
    </Pressable>
  );
}

function Sheet({
  visible,
  title,
  onClose,
  children,
}: React.PropsWithChildren<{
  visible: boolean;
  title: string;
  onClose: () => void;
}>) {
  const t = useTheme();
  const text = useText();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: t.background }}>
        <View style={{ alignItems: "center", paddingTop: 8 }}>
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: t.border,
            }}
          />
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: 6,
          }}
        >
          <Copy size={16} bold>
            {title}
          </Copy>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text("关闭")}
            onPress={onClose}
            style={{
              width: 44,
              height: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <SymbolView name="xmark" size={15} tintColor={t.secondary} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingTop: 4,
            gap: 16,
            paddingBottom: 48,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </View>
    </Modal>
  );
}

function ToggleRow({
  icon,
  label,
  detail,
  value,
  onChange,
}: {
  icon: SymbolViewProps["name"];
  label: string;
  detail?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const t = useTheme();
  const text = useText();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 52,
      }}
    >
      <SymbolView name={icon} size={17} tintColor={t.secondary} />
      <View style={{ flex: 1 }}>
        <Copy size={15}>{label}</Copy>
        {detail && (
          <Copy size={12} muted>
            {detail}
          </Copy>
        )}
      </View>
      <Switch
        accessibilityLabel={text(label)}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: t.brand }}
      />
    </View>
  );
}

function CallsLegend() {
  const t = useTheme();
  return (
    <Copy size={12} muted>
      <Copy size={12} color={t.chartUp} localize={false}>
        ▲
      </Copy>
      看涨{" "}
      <Copy size={12} color={t.chartDown} localize={false}>
        ▼
      </Copy>
      看跌 为博主观点
    </Copy>
  );
}

function Workspace({ symbol }: { symbol: string }) {
  const t = useTheme();
  const text = useText();
  const insets = useSafeAreaInsets();
  const screen = useWindowDimensions();
  const { resolve } = useChartColors();
  const session = useAuth().session;
  const user = session?.user.id;

  // --- timeframe and history ---------------------------------------------------------
  const [range, setRange] = useState<AdvancedRange>("3M");
  const [interval, setChartInterval] = useState<ChartInterval>(
    defaultInterval["3M"],
  );
  const query = advancedHistoryQuery(range, interval);
  const intraday = isIntraday(interval);
  const history = useResource(`advanced:${symbol}:${query}`, async (signal) => {
    const data = await apiRequest<{ data: PriceBar[] }>(
      `/market/history/${encodeURIComponent(symbol)}?${query}`,
      { signal },
    );
    return validBars(data.data);
  });
  const bars = useMemo(() => history.data ?? [], [history.data]);
  const count = bars.length;
  const refreshHistory = history.refresh;
  useEffect(() => {
    const timer = setInterval(refreshHistory, 60_000);
    return () => clearInterval(timer);
  }, [refreshHistory]);
  const quote = useResource(`chart-quote:${symbol}`, (signal) =>
    apiRequest<StockQuote>(`/market/quote/${encodeURIComponent(symbol)}`, {
      signal,
    }),
  );
  const refreshQuote = quote.refresh;
  useEffect(() => {
    const timer = setInterval(refreshQuote, 15_000);
    return () => clearInterval(timer);
  }, [refreshQuote]);
  const opinions = useResource(`chart-calls:${symbol}`, (signal) =>
    apiRequest<{ opinions?: CallEvent[] }>(
      `/youtube-opinions/stocks/${encodeURIComponent(symbol)}`,
      { signal, timeout: 30_000 },
    ).then((data) => data.opinions ?? []),
  );

  // --- view window (count / offset from the newest bar), like the Web's GraphView --------
  const [win, setWin] = useState<{ count: number; offset: number } | null>(
    null,
  );
  const defaultCount = useMemo(() => {
    if (!count) return 0;
    const from = rangeStart(range, Date.parse(bars[count - 1].date));
    if (from === null) return count;
    const first = bars.findIndex((b) => Date.parse(b.date) >= from);
    return Math.max(
      Math.min(MIN_BARS, count),
      first < 0 ? count : count - first,
    );
  }, [bars, count, range]);
  const windowCount = Math.max(1, Math.min(count, win?.count ?? defaultCount));
  const offset = Math.max(0, Math.min(win?.offset ?? 0, count - windowCount));
  const [autoScale, setAutoScale] = useState(true);
  const [panMode, setPanMode] = useState(false);
  const resetView = () => {
    setWin(null);
    setAutoScale(true);
  };
  const gestureWindow = useMemo(
    () => ({
      length: count,
      count: windowCount,
      offset,
      min: MIN_BARS,
      max: count,
    }),
    [count, windowCount, offset],
  );
  const onGesture = useCallback(
    (next: { count: number; offset: number }) =>
      setWin({ count: next.count, offset: next.offset }),
    [],
  );
  const gestures = useChartGestures(gestureWindow, onGesture);

  // --- preferences -------------------------------------------------------------------
  const [indicators, setIndicators] = useStoredState<IndicatorKey[]>(
    "kolvex:chart-indicators:advanced",
    DEFAULT_INDICATORS,
    (v): v is IndicatorKey[] =>
      Array.isArray(v) && v.every((k) => k in indicatorMeta),
  );
  const [oscillator, setOscillator] = useStoredState<Oscillator | null>(
    "kolvex:chart-oscillator",
    "kdj",
    (v): v is Oscillator | null =>
      v === null || v === "kdj" || v === "macd" || v === "rsi",
  );
  const [layerPrefs, setLayerPrefs] = useStoredState<
    Partial<Record<DrawingGroup, boolean>>
  >(
    "kolvex:chart-layers",
    {},
    (v): v is Partial<Record<DrawingGroup, boolean>> =>
      !!v && typeof v === "object",
  );
  const narrow = screen.width - 32 - 56 < 480;
  const layerOn = (g: DrawingGroup) =>
    layerPrefs[g] ?? !(narrow && (g === "trend" || g === "pattern"));
  const hiddenGroups = new Set(drawingGroups.filter((g) => !layerOn(g)));

  // --- drawings ----------------------------------------------------------------------
  const synced = useSyncedDrawings(symbol, user);
  const [tool, setTool] = useState<DrawingTool>("cursor");
  const [color, setColor] = useState(drawingColors[0]);
  const [magnet, setMagnet] = useState(true);
  const [showCalls, setShowCalls] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);

  // --- saved AI analysis and drawings (the current version, as the Web loads it) ------
  const [analysis, setAnalysis] = useState<AiTechnicalAnalysis | null>(null);
  const [aiDrawingsResult, setAiDrawingsResult] =
    useState<AiTechnicalAnalysis | null>(null);
  const [drawingsHidden, setDrawingsHidden] = useState(false);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    for (const kind of ["technical", "drawings"] as const)
      apiRequest<{ current: ChartVersion | null }>(
        `/market/analysis-history/${symbol}?kind=${kind}&limit=1&offset=0`,
        { signal: controller.signal, authenticated: true, expectedUser: user },
      )
        .then((data) => {
          const current = data.current;
          if (!current) return;
          const payload = { ...current.payload, version_id: current.id };
          if (kind === "technical") setAnalysis(payload);
          else setAiDrawingsResult(payload);
        })
        .catch(() => {});
    return () => controller.abort();
  }, [symbol, user]);
  const aiDrawings = useMemo(
    () => [
      ...(analysis ? planDrawings(analysis) : []),
      ...(aiDrawingsResult ? analysisDrawings(aiDrawingsResult) : []),
    ],
    [analysis, aiDrawingsResult],
  );
  const manual = synced.drawings.filter((d) => d.source !== "ai");
  const allDrawings = drawingsHidden ? manual : [...manual, ...aiDrawings];
  const setDrawings = (next: Drawing[], recordFrom?: Drawing[] | null) =>
    synced.setDrawings(
      next.filter((d) => d.source !== "ai"),
      recordFrom === null ? null : recordFrom?.filter((d) => d.source !== "ai"),
    );
  const selected = allDrawings.find((d) => d.id === selectedId) ?? null;

  // --- forecast ----------------------------------------------------------------------
  const [showForecast, setShowForecast] = useState(false);
  const forecastable = interval === "1d" || interval === "1wk";
  const forecastOn = forecastable && showForecast;
  const savedForecast =
    analysis?.forecast?.interval === interval ? analysis.forecast : null;
  const fetchForecast = forecastOn && !savedForecast && !!user;
  const forecastResource = useResource<KlineForecast | null>(
    `forecast:${symbol}:${interval}:${fetchForecast}`,
    (signal) =>
      fetchForecast
        ? klineForecast(symbol, interval, user!, signal)
        : Promise.resolve(null),
  );
  const forecast = forecastOn
    ? (savedForecast ?? forecastResource.data ?? null)
    : null;
  const forecastError = fetchForecast && !!forecastResource.error;

  // --- derived window values ---------------------------------------------------------
  const end = count - offset;
  const start = Math.max(0, end - windowCount);
  const extra = forecast && offset === 0 ? forecast.points.length + 2 : 0;
  const view = { start, end: end + extra };
  const lastVisible = Math.max(0, end - 1);
  const activeBar = active === null ? null : (bars[active] ?? null);
  const shownBar = activeBar ?? bars[lastVisible] ?? null;
  const firstShown = bars[start];
  const latest = latestQuote(quote.data, false);
  const extended = latestQuote(quote.data);
  const showQuote = !activeBar && !!latest && offset === 0;
  const baseline =
    range === "1D" && positive(quote.data?.previous_close)
      ? quote.data!.previous_close!
      : firstShown?.close;
  const displayedPrice = showQuote ? latest!.price : shownBar?.close;
  const vsPrevious = range === "1D" && baseline === quote.data?.previous_close;
  const displayedChange =
    displayedPrice !== undefined && baseline
      ? showQuote && vsPrevious && latest!.changePercent !== null
        ? latest!.changePercent
        : ((displayedPrice - baseline) / baseline) * 100
      : null;
  const showExtended = !!extended && extended.session !== "regular";
  const callsByBar = useMemo(() => {
    const map = new Map<
      number,
      { bullish: number; bearish: number; other: number }
    >();
    const events = opinions.data ?? [];
    if (!count) return map;
    const containing = interval === "1wk" || interval === "1mo";
    const starts = bars.map((b) => b.date.slice(0, 10));
    for (const o of events) {
      const date = o.opinion_date?.slice(0, 10);
      if (!date || date < starts[0]) continue;
      let index = containing
        ? starts.findLastIndex((s) => s <= date)
        : starts.findIndex((s) => s >= date);
      if (index === -1) {
        if (
          containing ||
          (Date.parse(date) - Date.parse(starts[starts.length - 1])) /
            86_400_000 >
            4
        )
          continue;
        index = starts.length - 1;
      }
      const entry = map.get(index) ?? { bullish: 0, bearish: 0, other: 0 };
      entry[
        o.sentiment === "bullish"
          ? "bullish"
          : o.sentiment === "bearish"
            ? "bearish"
            : "other"
      ] += 1;
      map.set(index, entry);
    }
    return map;
  }, [opinions.data, bars, count, interval]);
  const activeCalls =
    active !== null && showCalls ? callsByBar.get(active) : undefined;
  const presentGroups = drawingGroups.filter((g) =>
    aiDrawings.some((d) => d.group === g),
  );
  const [sheet, setSheet] = useState<
    "ai" | "settings" | "tools" | "colors" | null
  >(null);
  const [areaHeight, setAreaHeight] = useState(0);
  const plotHeight = Math.max(
    200,
    areaHeight - (oscillator ? OSC_HEIGHT + 28 : 0),
  );
  const barLabel = (bar: PriceBar) =>
    `${bar.date.slice(0, 10).replaceAll("-", "/")}${intraday ? ` ${bar.date.slice(11, 16)}` : ""}`;

  const changeRange = (next: AdvancedRange) => {
    setRange(next);
    if (!rangeIntervals[next].includes(interval))
      setChartInterval(defaultInterval[next]);
    setWin(null);
    setActive(null);
  };
  const pickInterval = () => {
    const options = rangeIntervals[range];
    const choose = (next: ChartInterval) => {
      setChartInterval(next);
      setWin(null);
      setActive(null);
    };
    if (Platform.OS === "ios")
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            ...options.map((o) => text(intervalLabels[o])),
            text("取消"),
          ],
          cancelButtonIndex: options.length,
        },
        (i) => {
          if (i < options.length) choose(options[i]);
        },
      );
    else choose(options[(options.indexOf(interval) + 1) % options.length]);
  };
  const toggleIndicator = (k: IndicatorKey) =>
    setIndicators(
      indicators.includes(k)
        ? indicators.filter((x) => x !== k)
        : [...indicators, k],
    );
  const pickColor = (value: string) => {
    setColor(value);
    if (selected && selected.source !== "ai")
      setDrawings(
        allDrawings.map((d) =>
          d.id === selected.id ? { ...d, color: value } : d,
        ),
      );
  };
  const removeSelected = () => {
    if (!selectedId) return;
    setDrawings(allDrawings.filter((d) => d.id !== selectedId));
    setSelectedId(null);
  };
  const toolMeta = TOOLS.find((x) => x.value === tool) ?? TOOLS[0];
  const syncIcon: SymbolViewProps["name"] =
    synced.status === "offline"
      ? "icloud.slash"
      : "arrow.triangle.2.circlepath.icloud";
  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/");

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.background,
        paddingTop: insets.top + 2,
        paddingBottom: Math.max(insets.bottom - 8, 8),
        paddingHorizontal: 16,
      }}
    >
      {/* Header: symbol and price on the left, AI actions and close on the right. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          height: 44,
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <Copy size={18} bold localize={false}>
            {symbol}
          </Copy>
          {displayedPrice !== undefined && (
            <Copy size={16} bold localize={false}>
              {formatPrice(displayedPrice)}
            </Copy>
          )}
          {displayedChange !== null && (
            <Copy
              size={13}
              bold
              localize={false}
              color={
                displayedChange > 0
                  ? t.chartUp
                  : displayedChange < 0
                    ? t.chartDown
                    : t.secondary
              }
            >
              {signedPercent(displayedChange)}
            </Copy>
          )}
        </View>
        {!!session && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={text("AI 图表操作")}
            onPress={() => setSheet("ai")}
            hitSlop={6}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              height: 32,
              paddingHorizontal: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: t.rim,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <SymbolView name="sparkles" size={12} tintColor={t.text} />
            <Copy size={12} bold>
              AI
            </Copy>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text("关闭")}
          onPress={close}
          hitSlop={6}
          style={({ pressed }) => ({
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.wash,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <SymbolView name="xmark" size={13} weight="bold" tintColor={t.text} />
        </Pressable>
      </View>

      {/* One quiet line: the inspected bar, or the window label with after-hours. */}
      <View
        style={{
          height: 20,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        {shownBar && (activeBar || !showExtended) ? (
          <Copy size={11} muted localize={false} lines={1}>
            {`${barLabel(shownBar)}  ${text("开")} ${fixedPrice(shownBar.open)}  ${text("高")} ${fixedPrice(shownBar.high)}  ${text("低")} ${fixedPrice(shownBar.low)}  ${text("收")} ${fixedPrice(shownBar.close)}${shownBar.volume ? `  ${text("量")} ${formatVolume(shownBar.volume)}` : ""}${activeCalls ? `  ▲${activeCalls.bullish} ▼${activeCalls.bearish}` : ""}`}
          </Copy>
        ) : showExtended && extended ? (
          <Copy size={11} muted localize={false} lines={1}>
            {`${text("所选区间")} · ${text(sessionLabels[extended.session])} ${formatPrice(extended.price)}${extended.changePercent !== null ? ` (${signedPercent(extended.changePercent)})` : ""}`}
          </Copy>
        ) : null}
      </View>

      {/* Drawing toolbar: tools left, edits and chart settings right. */}
      <View
        style={{
          height: 40,
          flexDirection: "row",
          alignItems: "center",
          borderBottomWidth: 1,
          borderBottomColor: t.border,
        }}
      >
        <IconButton
          icon={toolMeta.icon}
          label="画图工具"
          active={tool !== "cursor"}
          onPress={() => setSheet("tools")}
        />
        <IconButton label="画线颜色" onPress={() => setSheet("colors")}>
          <View
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: resolve(selected?.color ?? color),
            }}
          />
        </IconButton>
        <View style={{ flex: 1, paddingHorizontal: 4 }}>
          {tool !== "cursor" && (
            <Copy size={11} muted lines={1}>
              {tool === "hline" || tool === "vline"
                ? "点击图表放置水平线或时间线"
                : "拖动或依次点击两个点完成绘制"}
            </Copy>
          )}
        </View>
        {(synced.status === "syncing" || synced.status === "offline") && (
          <SymbolView
            name={syncIcon}
            size={14}
            tintColor={synced.status === "offline" ? t.chartDown : t.secondary}
          />
        )}
        <IconButton
          icon="arrow.uturn.backward"
          label="撤销"
          disabled={!synced.canUndo}
          onPress={synced.undo}
        />
        <IconButton
          icon="xmark"
          label="删除选中画线"
          disabled={!selectedId || selected?.source === "ai"}
          onPress={removeSelected}
        />
        <IconButton
          icon="trash"
          label="清除全部画线"
          disabled={!manual.length}
          onPress={() => {
            setDrawings([]);
            setSelectedId(null);
          }}
        />
        <IconButton
          icon="slider.horizontal.3"
          label="图表设置"
          onPress={() => setSheet("settings")}
        />
      </View>

      {/* The plot and the oscillator share whatever height is left. */}
      <View
        style={{ flex: 1, marginTop: 4 }}
        onLayout={(e) => setAreaHeight(e.nativeEvent.layout.height)}
      >
        {!count ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            {history.error ? (
              <>
                <Copy muted>价格数据暂不可用。</Copy>
                <Button size="sm" onPress={history.refresh}>
                  重试
                </Button>
              </>
            ) : history.loading ? (
              <ChartCardSkeleton />
            ) : (
              <Copy muted>数据源未提供此周期 K 线</Copy>
            )}
          </View>
        ) : (
          areaHeight > 0 && (
            <>
              <View
                {...(tool === "cursor" ? gestures.panHandlers : {})}
                onLayout={gestures.onLayout}
              >
                <AdvancedChart
                  bars={bars}
                  view={view}
                  height={plotHeight}
                  intraday={intraday}
                  autoScale={autoScale}
                  indicators={indicators}
                  drawings={allDrawings}
                  hiddenGroups={hiddenGroups}
                  selectedId={selectedId}
                  onSelectDrawing={panMode ? () => {} : setSelectedId}
                  onDrawingsChange={setDrawings}
                  tool={tool}
                  color={color}
                  magnet={magnet}
                  onCommit={(d) => {
                    setDrawings([...allDrawings, d]);
                    setSelectedId(d.id);
                    setTool("cursor");
                  }}
                  events={opinions.data ?? []}
                  showCalls={showCalls}
                  containing={interval === "1wk" || interval === "1mo"}
                  active={active}
                  onActive={setActive}
                  forecast={forecast}
                  onDoubleTap={resetView}
                  forecastNote={
                    forecastOn && (forecast || forecastError) ? (
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 3,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: t.border,
                          backgroundColor: t.dark
                            ? "rgba(0,0,0,0.85)"
                            : "rgba(255,255,255,0.85)",
                        }}
                      >
                        <Copy size={11} muted localize={false}>
                          {forecast
                            ? `Kronos · ${forecast.horizon} 根 · 中位数 ${(forecast.summary.median_return * 100).toFixed(1)}% · 上涨概率 ${Math.round(forecast.summary.prob_up * 100)}%`
                            : text("预测暂时不可用，请稍后重试。")}
                        </Copy>
                      </View>
                    ) : undefined
                  }
                />
              </View>
              {oscillator && (
                <OscillatorPane
                  bars={bars}
                  kind={oscillator}
                  onChange={setOscillator}
                  view={{ start, end }}
                  active={active}
                  onActive={setActive}
                  height={OSC_HEIGHT}
                />
              )}
            </>
          )
        )}
      </View>

      {/* Range bar with the interval menu. */}
      <View
        style={{
          height: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        <View style={{ flex: 1 }}>
          <Filters
            size="sm"
            maxWidth={screen.width - 32 - 86}
            values={advancedRanges.map((r) => [r, rangeLabels[r]] as const)}
            value={range}
            onChange={(v) => changeRange(v as AdvancedRange)}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text("K线周期")}
          onPress={pickInterval}
          hitSlop={6}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            height: 32,
            paddingHorizontal: 10,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: t.rim,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Copy size={12} bold>
            {intervalLabels[interval]}
          </Copy>
          <SymbolView name="chevron.down" size={9} tintColor={t.text} />
        </Pressable>
      </View>

      <Sheet
        visible={sheet === "ai"}
        title="AI 图表操作"
        onClose={() => setSheet(null)}
      >
        {!!session && (
          <ChartAiPanel
            symbol={symbol}
            query={Object.fromEntries(new URLSearchParams(query))}
            interval={interval}
            viewStart={bars[start]?.date}
            viewEnd={bars[lastVisible]?.date}
            analysis={analysis}
            onResult={(operation, result) => {
              if (operation === "drawings") {
                setAiDrawingsResult(result);
                setDrawingsHidden(false);
              } else setAnalysis(result);
            }}
            forecastVisible={forecastOn}
            onToggleForecast={
              savedForecast && forecastable
                ? () => setShowForecast(!showForecast)
                : undefined
            }
          />
        )}
      </Sheet>
      <Sheet
        visible={sheet === "settings"}
        title="图表设置"
        onClose={() => setSheet(null)}
      >
        <View>
          <ToggleRow
            icon={autoScale ? "lock" : "lock.open"}
            label="自动缩放"
            value={autoScale}
            onChange={setAutoScale}
          />
          {forecastable && (
            <ToggleRow
              icon="sparkles"
              label="预测"
              detail="实验性 Kronos 模型对未来 20 根K线的预测"
              value={showForecast}
              onChange={setShowForecast}
            />
          )}
          <ToggleRow
            icon="scope"
            label="磁吸到K线开高低收"
            value={magnet}
            onChange={setMagnet}
          />
          <ToggleRow
            icon="eye"
            label="在K线上显示博主看涨/看跌"
            value={showCalls}
            onChange={setShowCalls}
          />
          <ToggleRow
            icon="arrow.left.and.right"
            label="拖动平移"
            value={panMode}
            onChange={setPanMode}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!win && autoScale}
            onPress={() => {
              resetView();
              setSheet(null);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              minHeight: 48,
              opacity: !win && autoScale ? 0.4 : 1,
            }}
          >
            <SymbolView
              name="arrow.counterclockwise"
              size={17}
              tintColor={t.secondary}
            />
            <Copy size={15}>重置缩放</Copy>
          </Pressable>
          {showCalls && callsByBar.size > 0 && <CallsLegend />}
        </View>
        {(presentGroups.length > 0 ||
          (drawingsHidden && !!aiDrawingsResult)) && (
          <View style={{ gap: 10 }}>
            <Copy size={12} bold muted>
              画线图层
            </Copy>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
            </View>
            {!!aiDrawingsResult && (
              <ToggleRow
                icon="eye.slash"
                label="隐藏画线"
                value={drawingsHidden}
                onChange={setDrawingsHidden}
              />
            )}
          </View>
        )}
        {!!session && (
          <Copy size={12} muted>
            {syncLabels[synced.status]}
          </Copy>
        )}
        <Copy size={12} bold muted>
          技术指标
        </Copy>
        <View>
          {indicatorOrder.map((k) => {
            const on = indicators.includes(k);
            return (
              <Pressable
                key={k}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggleIndicator(k)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  minHeight: 48,
                }}
              >
                <SymbolView
                  name={on ? "checkmark.square.fill" : "square"}
                  size={20}
                  tintColor={on ? t.accent : t.secondary}
                />
                <View
                  style={{
                    width: 14,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: resolve(indicatorMeta[k].color),
                  }}
                />
                <Copy size={15} localize={k === "volume"}>
                  {k === "volume" ? "成交量" : indicatorMeta[k].label}
                </Copy>
              </Pressable>
            );
          })}
        </View>
        <Copy size={12} bold muted>
          副图指标
        </Copy>
        <View>
          {(["kdj", "macd", "rsi"] as const).map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityState={{ selected: oscillator === k }}
              onPress={() => setOscillator(oscillator === k ? null : k)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                minHeight: 48,
              }}
            >
              <Copy size={15} localize={false}>
                {oscillatorLabels[k]}
              </Copy>
              {oscillator === k && (
                <SymbolView name="checkmark" size={15} tintColor={t.accent} />
              )}
            </Pressable>
          ))}
        </View>
        <Copy size={12} muted>
          指标使用与 Web 相同的计算。缺少完整预热区间时以 — 显示；VWAP
          在日线及更长周期以首根为锚。
        </Copy>
      </Sheet>
      <Sheet
        visible={sheet === "tools"}
        title="画图工具"
        onClose={() => setSheet(null)}
      >
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {TOOLS.map((item) => (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityState={{ selected: tool === item.value }}
              onPress={() => {
                setTool(item.value);
                if (item.value !== "cursor") setSelectedId(null);
                setSheet(null);
              }}
              style={{
                width: "50%",
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                minHeight: 48,
                paddingHorizontal: 10,
                borderRadius: 24,
                backgroundColor:
                  tool === item.value ? t.washStrong : "transparent",
              }}
            >
              <SymbolView name={item.icon} size={16} tintColor={t.text} />
              <View style={{ flex: 1 }}>
                <Copy size={13} bold={tool === item.value}>
                  {item.label}
                </Copy>
              </View>
            </Pressable>
          ))}
        </View>
      </Sheet>
      <Sheet
        visible={sheet === "colors"}
        title="画线颜色"
        onClose={() => setSheet(null)}
      >
        <View style={{ flexDirection: "row", gap: 8 }}>
          {drawingColors.map((value, i) => {
            const current = (selected?.color ?? color) === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ checked: current }}
                accessibilityLabel={`${text("画线颜色")} ${i + 1}`}
                onPress={() => {
                  pickColor(value);
                  setSheet(null);
                }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: current ? 2 : 0,
                  borderColor: t.text,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    backgroundColor: resolve(value),
                  }}
                />
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}
