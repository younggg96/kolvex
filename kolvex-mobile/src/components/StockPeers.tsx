import { useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Svg, { Line, Polyline } from "react-native-svg";
import { financialFormat } from "../lib/financialFormat";
import {
  MAX_PEERS,
  mixesCurrencies,
  parsePeers,
  rebasedReturns,
} from "../lib/freeResearch";
import { apiRequest } from "../lib/http";
import { useText } from "../lib/i18n";
import { isSymbol } from "../lib/models";
import { finite } from "../lib/stockResearch";
import { useTheme } from "../lib/theme";
import { usePreferences } from "../state/Preferences";
import { DataTable } from "./DataTable";
import { Field, Filters } from "./Content";
import { Button, Copy, Failure, Glass, Section, LoadingStatus } from "./UI";
const BENCHMARK = "^GSPC";
const RANGES = {
  "6M": { period: "6mo", interval: "1d" },
  "1Y": { period: "1y", interval: "1d" },
  "5Y": { period: "5y", interval: "1wk" },
} as const;
type Range = keyof typeof RANGES;
// Same validated series colors as the Web's peer chart.
const SERIES = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"],
};
type Overview = {
  company: { name?: string };
  quote: {
    current_price?: number | null;
    market_cap?: number | null;
    currency?: string | null;
  };
  financials: Record<string, number | string | null | undefined> & {
    financial_currency?: string | null;
  };
};
type Loaded = { status: "loading" | "ready" | "error"; overview?: Overview };
const overviewOf = (symbol: string, signal: AbortSignal) =>
  apiRequest<Overview>(`/market/overview/${encodeURIComponent(symbol)}`, {
    signal,
  });
const historyOf = async (symbol: string, range: Range, signal: AbortSignal) => {
  const { period, interval } = RANGES[range];
  const result = await apiRequest<{
    data: { date: string; close: number | null }[];
  }>(
    `/market/history/${encodeURIComponent(symbol)}?period=${period}&interval=${interval}`,
    { signal },
  );
  return result.data.flatMap((bar) =>
    finite(bar.close) ? [{ date: bar.date, value: bar.close }] : [],
  );
};
function assignSlots(previous: Record<string, number>, symbols: string[]) {
  const next: Record<string, number> = {};
  for (const item of symbols)
    if (previous[item] !== undefined) next[item] = previous[item];
  for (const item of symbols) {
    if (next[item] !== undefined) continue;
    const used = new Set(Object.values(next));
    let slot = 0;
    while (used.has(slot)) slot += 1;
    next[item] = slot;
  }
  return next;
}
export function StockPeers({ symbol }: { symbol: string }) {
  const t = useTheme();
  const text = useText();
  const { locale } = usePreferences();
  const f = financialFormat(locale);
  const params = useLocalSearchParams<{ peers?: string }>();
  const [peers, setPeers] = useState(() =>
    parsePeers(typeof params.peers === "string" ? params.peers : "", symbol),
  );
  const symbols = useMemo(() => [symbol, ...peers], [symbol, peers]);
  const [draft, setDraft] = useState("");
  const [inputError, setInputError] = useState<string>();
  const [range, setRange] = useState<Range>("1Y");
  const [attempt, setAttempt] = useState(0);
  const [overviews, setOverviews] = useState<Record<string, Loaded>>({});
  const [history, setHistory] = useState<
    Record<string, { date: string; value: number }[]>
  >({});
  const [historyKey, setHistoryKey] = useState("");
  const symbolsKey = symbols.join(",");
  // Color follows the company: removing one never repaints the others.
  const [slots, setSlots] = useState(() => assignSlots({}, symbols));
  const series = t.dark ? SERIES.dark : SERIES.light;
  const color = (item: string) =>
    item === BENCHMARK
      ? t.secondary
      : series[(slots[item] ?? 0) % series.length];
  const update = (next: string[]) => {
    setPeers(next);
    setSlots((old) => assignSlots(old, [symbol, ...next]));
    router.setParams({ peers: next.length ? next.join(",") : undefined });
  };
  const add = () => {
    const peer = draft.trim().toUpperCase();
    if (!peer) return;
    if (!isSymbol(peer)) return setInputError("请输入有效的股票代码");
    if (peer === symbol || peers.includes(peer))
      return setInputError("已在比较列表中");
    setInputError(undefined);
    setDraft("");
    update([...peers, peer]);
  };
  useEffect(() => {
    const controller = new AbortController();
    const list = symbolsKey.split(",");
    for (const item of list) {
      overviewOf(item, controller.signal)
        .then((overview) => {
          if (controller.signal.aborted) return;
          const priced =
            finite(overview.quote?.current_price) &&
            overview.quote.current_price > 0;
          setOverviews((previous) => ({
            ...previous,
            [item]: priced
              ? { status: "ready", overview }
              : { status: "error" },
          }));
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setOverviews((previous) => ({
              ...previous,
              [item]: { status: "error" },
            }));
        });
    }
    return () => controller.abort();
  }, [symbolsKey, attempt]);
  useEffect(() => {
    const controller = new AbortController();
    const list = [...symbolsKey.split(","), BENCHMARK];
    void Promise.allSettled(
      list.map((item) => historyOf(item, range, controller.signal)),
    ).then((results) => {
      if (controller.signal.aborted) return;
      const next: Record<string, { date: string; value: number }[]> = {};
      results.forEach((result, index) => {
        if (result.status === "fulfilled") next[list[index]] = result.value;
      });
      setHistory(next);
      setHistoryKey(`${symbolsKey}:${range}:${attempt}`);
    });
    return () => controller.abort();
  }, [symbolsKey, range, attempt]);
  const historyLoading = historyKey !== `${symbolsKey}:${range}:${attempt}`;
  const chart = useMemo(() => rebasedReturns(history), [history]);
  const signed = (value: unknown) =>
    finite(value) ? `${value > 0 ? "+" : ""}${f.percent(value)}` : "—";
  const name = (item: string) => (item === BENCHMARK ? text("标普 500") : item);
  const lines = [
    ...symbols.filter((item) => chart.totals[item] !== undefined),
    ...(chart.totals[BENCHMARK] !== undefined ? [BENCHMARK] : []),
  ];
  const missingHistory = symbols.filter(
    (item) => !historyLoading && chart.totals[item] === undefined,
  );
  const unavailable = peers.filter(
    (peer) => overviews[peer]?.status === "error",
  );
  type Row = { label: string; read: (o: Overview) => string };
  const mixed = (o: Overview) =>
    mixesCurrencies(o.quote.currency, o.financials.financial_currency);
  const groups: { title: string; rows: Row[] }[] = [
    {
      title: "规模与估值",
      rows: [
        { label: "市值", read: (o) => f.number(o.quote.market_cap) },
        {
          label: "滚动市盈率",
          read: (o) => f.number(o.financials.pe_ratio, false),
        },
        {
          label: "预期市盈率",
          read: (o) => f.number(o.financials.forward_pe, false),
        },
        {
          label: "市销率",
          read: (o) =>
            mixed(o) ? "—" : f.number(o.financials.price_to_sales, false),
        },
        {
          label: "EV / EBITDA",
          read: (o) =>
            mixed(o) ? "—" : f.number(o.financials.ev_to_ebitda, false),
        },
      ],
    },
    {
      title: "增长",
      rows: [
        {
          label: "营业收入",
          read: (o) =>
            `${f.number(o.financials.total_revenue)}${o.financials.financial_currency ? ` ${o.financials.financial_currency}` : ""}`,
        },
        { label: "营收增长", read: (o) => signed(o.financials.revenue_growth) },
        {
          label: "盈利增长",
          read: (o) => signed(o.financials.earnings_growth),
        },
        {
          label: "滚动每股收益",
          read: (o) => f.number(o.financials.eps_trailing, false),
        },
      ],
    },
    {
      title: "盈利能力",
      rows: [
        { label: "毛利率", read: (o) => f.percent(o.financials.gross_margins) },
        {
          label: "营业利润率",
          read: (o) => f.percent(o.financials.operating_margins),
        },
        {
          label: "净利率",
          read: (o) => f.percent(o.financials.profit_margins),
        },
        {
          label: "净资产收益率",
          read: (o) => f.percent(o.financials.return_on_equity),
        },
      ],
    },
  ];
  return (
    <View style={{ gap: 16 }}>
      <Section
        title="同行比较"
        note={`同行由你选择，最多 ${MAX_PEERS} 家，分享链接会保留所选公司。`}
      />
      <Field
        label="添加同行股票代码"
        value={draft}
        editable={peers.length < MAX_PEERS}
        maxLength={12}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={add}
        onChangeText={(value) => {
          setDraft(value);
          setInputError(undefined);
        }}
      />
      {!!inputError && <Failure message={inputError} />}
      <Button
        disabled={peers.length >= MAX_PEERS || !draft.trim()}
        onPress={add}
      >
        添加
      </Button>
      {!peers.length && (
        <Copy size={14} muted>
          添加一家公司，比较估值、增长、利润率和收益走势。
        </Copy>
      )}
      {!!unavailable.length && (
        <Failure
          message={`没有 ${unavailable.join("、")} 的数据，请检查代码或重试。`}
          retry={() => setAttempt((value) => value + 1)}
        />
      )}
      <Glass style={{ padding: 16, gap: 12 }}>
        <Copy size={14} muted>
          价格收益
        </Copy>
        <Filters
          values={[
            ["6M", "6月"],
            ["1Y", "1年"],
            ["5Y", "5年"],
          ]}
          value={range}
          onChange={(value) => setRange(value as Range)}
        />
        <View style={{ gap: 4 }}>
          {lines.map((item) => (
            <View
              key={item}
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <View
                style={{
                  width: 16,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: color(item),
                }}
              />
              <Copy size={13} muted localize={false}>
                {name(item)}
              </Copy>
              <Copy size={13} bold localize={false}>
                {signed(chart.totals[item])}
              </Copy>
            </View>
          ))}
        </View>
        {historyLoading && !chart.rows.length ? (
          <LoadingStatus />
        ) : chart.rows.length ? (
          <ReturnChart
            rows={chart.rows}
            lines={lines}
            primary={symbol}
            benchmark={BENCHMARK}
            colorOf={color}
            name={name}
            signed={signed}
            date={f.date}
          />
        ) : (
          <Copy size={14} muted>
            暂无价格历史。
          </Copy>
        )}
        {!!chart.start && (
          <Copy size={12} muted>
            {`所有曲线从 ${f.date(chart.start)} 的 0% 起算，这是所有公司都有数据的最早日期。`}
            {missingHistory.length
              ? ` ${missingHistory.join("、")} 暂无价格历史。`
              : ""}
          </Copy>
        )}
      </Glass>
      <DataTable
        label="同行指标表，可横向滚动"
        corner="指标"
        columns={symbols.map((item) => ({
          key: item,
          label: item,
          note: overviews[item]?.overview?.company.name ?? "",
          onPress:
            item === symbol
              ? undefined
              : () => router.push(`/stock/${encodeURIComponent(item)}`),
        }))}
        rows={groups.flatMap((group) => [
          { group: group.title },
          ...group.rows.map((row) => ({
            key: row.label,
            label: row.label,
            cells: symbols.map((item) => {
              const loaded = overviews[item];
              if (!loaded || loaded.status === "loading") return "…";
              return loaded.overview ? row.read(loaded.overview) : "—";
            }),
          })),
        ])}
      />
      {!!peers.length && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {peers.map((peer) => (
            <Button
              key={peer}
              onPress={() => update(peers.filter((item) => item !== peer))}
            >
              {`移除 ${peer}`}
            </Button>
          ))}
        </View>
      )}
      <Copy size={12} muted>
        来源：Yahoo
        Finance，所有公司使用同一数据源和同一口径。数值按各公司的申报货币和财年。上市货币与申报货币不同时不显示市销率和
        EV/EBITDA，因为数据源的比率混用了两种货币。收益按收盘价计算，不含股息。缺失值以
        — 显示。
      </Copy>
    </View>
  );
}
type ChartRow = { date: string } & Record<string, number | string | null>;
function ReturnChart({
  rows,
  lines,
  primary,
  benchmark,
  colorOf,
  name,
  signed,
  date,
}: {
  rows: ChartRow[];
  lines: string[];
  primary: string;
  benchmark: string;
  colorOf: (item: string) => string;
  name: (item: string) => string;
  signed: (value: unknown) => string;
  date: (value: string) => string;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState<number>();
  const values = rows.flatMap((row) =>
    lines.flatMap((item) => (finite(row[item]) ? [row[item] as number] : [])),
  );
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const span = high - low || 1;
  const height = 240;
  const y = (value: number) => 12 + ((high - value) / span) * (height - 24);
  const x = (i: number) =>
    rows.length > 1 ? (i / (rows.length - 1)) * width : width / 2;
  const pick = (locationX: number) => {
    if (!width) return;
    setIndex(
      Math.max(
        0,
        Math.min(
          rows.length - 1,
          Math.round((locationX / width) * (rows.length - 1)),
        ),
      ),
    );
  };
  const selected = index === undefined ? undefined : rows[index];
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="image"
        accessibilityHint="按住图表查看某日收益"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        onPress={(event) => pick(event.nativeEvent.locationX)}
        style={{ height }}
      >
        {width > 0 && (
          <Svg width={width} height={height} accessible={false}>
            <Line
              x1={0}
              x2={width}
              y1={y(0)}
              y2={y(0)}
              stroke={t.secondary}
              strokeOpacity={0.5}
            />
            {lines.map((item) => (
              <Polyline
                key={item}
                fill="none"
                stroke={colorOf(item)}
                strokeWidth={item === primary ? 2.5 : 2}
                strokeDasharray={item === benchmark ? "4 4" : undefined}
                points={rows
                  .flatMap((row, i) =>
                    finite(row[item])
                      ? [`${x(i)},${y(row[item] as number)}`]
                      : [],
                  )
                  .join(" ")}
              />
            ))}
            {index !== undefined && (
              <Line
                x1={x(index)}
                x2={x(index)}
                y1={0}
                y2={height}
                stroke={t.secondary}
                strokeDasharray="4 4"
              />
            )}
          </Svg>
        )}
      </Pressable>
      {selected ? (
        <View style={{ gap: 2 }}>
          <Copy size={12} bold localize={false}>
            {date(selected.date)}
          </Copy>
          {lines.map((item) => (
            <Copy key={item} size={12} muted localize={false}>
              {name(item)} · {signed(selected[item])}
            </Copy>
          ))}
        </View>
      ) : (
        <Copy size={12} muted>
          轻点图表查看某一日的收益。
        </Copy>
      )}
    </View>
  );
}
