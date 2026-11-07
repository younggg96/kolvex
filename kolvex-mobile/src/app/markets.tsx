import { useState } from "react";
import { CardsSkeleton } from "../components/Skeletons";
import { router } from "expo-router";
import { apiRequest } from "../lib/http";
import { useResource } from "../lib/useResource";
import { MARKET_GROUPS, type MarketInstrument } from "../lib/marketBenchmarks";
import {
  comparisonSnapshot,
  completedComparisonDate,
  COMPARISON_PERIODS,
  type ComparisonPeriod,
} from "../lib/marketComparison";
import {
  observationRange,
  type MarketObservation,
} from "../lib/marketObservations";
import { number } from "../lib/models";
import { useTheme } from "../lib/theme";
import { ListPage, Glass, Copy, Button, Search } from "../components/UI";
import { Filters, ResourceState, SourceLink } from "../components/Content";
import { Chart } from "../components/Chart";
type MarketRow = {
  instrument: MarketInstrument;
  history: MarketObservation[];
  snapshot: ReturnType<typeof comparisonSnapshot>;
  error?: string;
};
async function load(items: readonly MarketInstrument[], signal: AbortSignal) {
  const result: MarketRow[] = [];
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(3, items.length) }, async () => {
      while (index < items.length && !signal.aborted) {
        const instrument = items[index++];
        try {
          const history =
            instrument.source === "fred"
              ? (
                  await apiRequest<{ history: MarketObservation[] }>(
                    `/market/observations/${instrument.symbol}`,
                    { signal },
                  )
                ).history
              : (
                  await apiRequest<{
                    data: { date: string; close: number | null }[];
                  }>(
                    `/market/history/${encodeURIComponent(instrument.symbol)}?period=2y&interval=1d`,
                    { signal },
                  )
                ).data
                  .filter((b) => b.close !== null && Number.isFinite(b.close))
                  .map((b) => ({ date: b.date.slice(0, 10), value: b.close! }));
          const complete = history.filter(
            (p) => p.date <= completedComparisonDate(instrument),
          );
          result.push({
            instrument,
            history: complete,
            snapshot: comparisonSnapshot(complete, instrument),
          });
        } catch {
          result.push({
            instrument,
            history: [],
            snapshot: comparisonSnapshot([], instrument),
            error: "此数据源暂不可用，请刷新重试。",
          });
        }
      }
    }),
  );
  return result;
}
export default function MarketBoard() {
  const [group, setGroup] = useState("indices");
  const [range, setRange] = useState<ComparisonPeriod>("1M");
  const [sort, setSort] = useState("symbol");
  const [search, setSearch] = useState("");
  const selected = MARKET_GROUPS.find((g) => g.key === group)!;
  const r = useResource(`market-board:${group}`, (signal) =>
    load(selected.instruments, signal),
  );
  const rows = (r.data || [])
    .filter((x) =>
      `${x.instrument.symbol} ${x.instrument.zh} ${x.instrument.en}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "move"
        ? (b.snapshot.changes[range] ?? -Infinity) -
          (a.snapshot.changes[range] ?? -Infinity)
        : a.instrument.symbol.localeCompare(b.instrument.symbol),
    );
  return (
    <ListPage
      title="市场全景"
      subtitle="指数、板块、风格与跨资产的收盘数据对比。"
      items={rows}
      keyFor={(r) => r.instrument.symbol}
      onRefresh={r.refresh}
      refreshing={r.loading}
      renderItem={(row) => <MarketCard row={row} range={range} />}
      header={
        <>
          <Filters
            values={MARKET_GROUPS.map((g) => [g.key, g.zh] as const)}
            value={group}
            onChange={setGroup}
          />
          <Search
            value={search}
            onChange={setSearch}
            placeholder="搜索此组市场工具"
          />
          <Filters
            values={COMPARISON_PERIODS.map((p) => [p.key, p.zh] as const)}
            value={range}
            onChange={(v) => setRange(v as ComparisonPeriod)}
          />
          <Filters
            values={[
              ["symbol", "按代码"],
              ["move", "按区间变动"],
            ]}
            value={sort}
            onChange={setSort}
          />
          <Copy muted>
            日线仅含已完成的交易日。收益率与利差使用百分点变动；ETF
            是行业或风格的代表，不是指数点位。
          </Copy>
          <ResourceState skeleton={<CardsSkeleton count={4} lines={[{ size: 16 }, { size: 28, width: "40%" }, { size: 16, width: "50%" }]} />}
            resource={r}
            empty={!r.loading && !rows.length}
            message="无匹配市场工具"
          />
        </>
      }
      footer={
        <Copy size={12} muted>
          来源可能延迟或停更，区间前缺少有效基准时以 — 显示。FRED
          为每日观测数据，不提供盘中走势。
        </Copy>
      }
    />
  );
}
function MarketCard({
  row,
  range,
}: {
  row: MarketRow;
  range: ComparisonPeriod;
}) {
  const t = useTheme();
  const { instrument: i, snapshot: s } = row;
  const change = s.changes[range];
  return (
    <Glass style={{ padding: 20, gap: 12 }}>
      <Copy bold>
        {i.zh} · {i.symbol}
      </Copy>
      <Copy size={28} bold>
        {number(s.value)}
        {i.unit === "percent" ? "%" : i.unit === "points" ? " 点" : ""}
      </Copy>
      <Copy
        color={
          change == null ? t.secondary : change < 0 ? t.negative : t.accent
        }
      >
        {range} ·
        {change == null
          ? "—"
          : `${change > 0 ? "+" : ""}${number(change)}${s.unit === "percent" ? "%" : s.unit === "pp" ? " 个百分点" : " 点"}`}
      </Copy>
      <Copy muted>
        {s.date || "数据日期未提供"} · {i.note?.zh || i.en}
      </Copy>
      {row.error ? (
        <Copy muted>{row.error}</Copy>
      ) : (
        <Chart
          data={observationRange(row.history, range).map((p) => ({
            date: p.date,
            close: p.value,
          }))}
          currency={
            i.unit === "percent"
              ? "%"
              : i.unit === "points" || i.symbol.startsWith("^")
                ? "点"
                : undefined
          }
          label={i.source === "fred" ? "FRED 日度观测值" : "已完成交易日收盘值"}
        />
      )}
      {i.source !== "fred" && (
        <Button
          onPress={() => router.push(`/stock/${encodeURIComponent(i.symbol)}`)}
        >
          报价与技术图表
        </Button>
      )}
      {i.sourceUrl && <SourceLink url={i.sourceUrl}>查看数据来源</SourceLink>}
    </Glass>
  );
}
