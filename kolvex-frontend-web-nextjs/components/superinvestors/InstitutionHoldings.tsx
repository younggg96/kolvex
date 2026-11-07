"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpRight, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChipButton } from "@/components/ui/chip-button";
import { ContentLoading } from "@/components/ui/content-loading";
import { Input } from "@/components/ui/input";
import { ListCard, ListLoadMore } from "@/components/ui/list-card";
import { institutionKey, secSourceUrl, type HoldingActivity, type Institution } from "@/lib/freeResearch";
import { cn } from "@/lib/utils";
import { SecLink, SecState, SourceNote, useFreeResearch } from "@/components/decision/SecData";
import { useFinancialFormat } from "@/components/decision/StockFinancialData";
import { useCopy } from "@/components/decision/shared";
import {
  ALLOCATION_SHADES,
  ActivityBadge,
  AllocationBar,
  ChangeBreakdown,
  HoldingName,
  sumWeights,
  useActivityLabel,
  useQuarterLabel,
} from "./shared";

export { activityTone, useActivityLabel } from "./shared";

type Holding = Institution["holdings"][number];
type Filter = "all" | Exclude<HoldingActivity, "unknown">;
type SortKey = "value" | "shares" | "change";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const PAGE = 50;
const TOP = 10;
const BUYS: HoldingActivity[] = ["new", "increased"];
const SELLS: HoldingActivity[] = ["reduced", "exited"];

const rowKey = (row: Holding) => `${row.cusip}-${row.class}-${row.share_type}-${row.put_call}`;
const sortValue = (row: Holding, key: SortKey) =>
  key === "value" ? row.value : key === "shares" ? row.shares : row.change_percent;

/** One manager's latest 13F: overview, quarter activity, then a filterable holdings table. */
export default function InstitutionHoldings({ manager }: { manager: string }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const resource = useFreeResearch<Institution>(institutionKey(manager));
  const data = resource.data;
  const holdings = useMemo(() => data?.holdings ?? [], [data]);
  const held = holdings.filter((row) => row.activity !== "exited");
  const totalValue = held.reduce((sum, row) => sum + (row.value ?? 0), 0);

  if (resource.loading && !data)
    return <ContentLoading className="min-h-48" label={c("Reading this 13F filing from the SEC…", "正在从 SEC 读取这份 13F 申报…")} />;

  return (
    <div className="space-y-8 md:space-y-10">
      <SecState
        loading={false}
        error={resource.error}
        empty={!holdings.length}
        retry={resource.refresh}
        emptyText={c("This investor has no 13F holdings available.", "这家机构暂无可用的 13F 持仓。")}
        errorText={c("13F holdings could not be loaded. Try again.", "13F 持仓加载失败，请重试。")}
      />
      {!!holdings.length && data?.filing && (
        <>
          <Overview data={data} held={held} totalValue={totalValue} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Allocation held={held} />
            <QuarterActivity data={data} />
          </div>
          <HoldingsTable data={data} />
        </>
      )}
      <SourceNote>
        {c(
          "Source: SEC Form 13F-HR. A quarter-end snapshot filed up to 45 days later, not live positions, and it excludes shorts and most non-US holdings. Changes are unadjusted for splits and only compare adjacent quarters. Investors are a curated list.",
          "来源：SEC Form 13F-HR。这是季度末持仓快照，最晚在季末 45 天后才披露，不代表当前持仓，也不含空头和大部分非美股持仓。股数变化未按拆股调整，仅比较相邻两个季度。投资机构为精选名单。",
        )}
      </SourceNote>
    </div>
  );
}

function Overview({ data, held, totalValue }: { data: Institution; held: Holding[]; totalValue: number }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const quarterLabel = useQuarterLabel();
  const filing = data.filing!;
  const largest = [...held].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))[0];
  const items: [string, React.ReactNode, React.ReactNode?][] = [
    [c("Reported value", "申报市值"), `$${f.number(totalValue)}`],
    [c("Positions", "持仓数"), f.number(held.length, false)],
    [
      c("Largest position", "第一大持仓"),
      f.percent(largest?.weight),
      largest && <HoldingName row={largest} size="xs" className="text-sm" />,
    ],
    [c("Reporting period", "持仓截止日"), f.date(filing.period), quarterLabel(filing.period)],
    [
      c("Filed", "申报日"),
      <SecLink key="filing" href={filing.source_url}>
        {f.date(filing.filed)}
      </SecLink>,
      filing.form,
    ],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 border-b border-border pb-6 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(([label, value, hint]) => (
        <div key={label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="figure mt-1.5 break-words text-lg font-semibold md:text-xl">{value}</dd>
          {hint && <dd className="mt-0.5 min-w-0 text-xs text-muted-foreground">{hint}</dd>}
        </div>
      ))}
    </dl>
  );
}

function Allocation({ held }: { held: Holding[] }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const top = [...held].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, TOP);
  const share = sumWeights(top);
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold">{c("Portfolio concentration", "持仓集中度")}</h2>
        <p className="text-xs text-muted-foreground">
          {c(`Top ${top.length}`, `前 ${top.length} 大`)}{" "}
          <span className="figure text-sm font-semibold text-foreground">{f.percent(share)}</span>
        </p>
      </div>
      <AllocationBar
        className="h-2.5"
        weights={top.map((row) => row.weight)}
        label={c(
          `Top ${top.length} holdings are ${f.percent(share)} of reported value`,
          `前 ${top.length} 大持仓占申报市值 ${f.percent(share)}`,
        )}
      />
      <ol className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
        {top.map((row, index) => (
          <li key={rowKey(row)} className="flex min-h-9 min-w-0 items-center gap-2 text-xs">
            <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", ALLOCATION_SHADES[index])} />
            <span className="figure w-4 shrink-0 text-muted-foreground">{index + 1}</span>
            <HoldingName row={row} size="xs" className="flex-1" />
            <span className="figure shrink-0">{f.percent(row.weight)}</span>
          </li>
        ))}
      </ol>
      {held.length > top.length && (
        <p className="mt-auto text-xs text-muted-foreground">
          {c(
            `${f.number(held.length - top.length, false)} other positions make up ${f.percent(Math.max(0, 1 - share))}.`,
            `其余 ${f.number(held.length - top.length, false)} 个持仓合计 ${f.percent(Math.max(0, 1 - share))}。`,
          )}
        </p>
      )}
    </Card>
  );
}

function QuarterActivity({ data }: { data: Institution }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const holdings = data.holdings;
  const count = (kind: HoldingActivity) => holdings.filter((row) => row.activity === kind).length;
  const compared = holdings.some((row) => row.activity !== "unknown");
  const changes = compared
    ? { new: count("new"), increased: count("increased"), reduced: count("reduced"), exited: count("exited") }
    : null;
  // Exited rows hold nothing now; they fall back to last quarter's share count.
  const rank = (row: Holding) => row.value ?? 0;
  const buys = holdings.filter((row) => BUYS.includes(row.activity)).sort((a, b) => rank(b) - rank(a)).slice(0, 4);
  const sells = holdings
    .filter((row) => SELLS.includes(row.activity))
    .sort((a, b) => rank(b) - rank(a) || (b.previous_shares ?? 0) - (a.previous_shares ?? 0))
    .slice(0, 4);
  const previous = data.previous_filing;
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold">{c("Vs prior quarter", "较上季变动")}</h2>
        {previous && (
          <p className="text-xs text-muted-foreground">
            {c("Prior filing", "上季申报")}{" "}
            <SecLink href={previous.source_url}>{f.date(previous.filed)}</SecLink>
          </p>
        )}
      </div>
      <ChangeBreakdown changes={changes} className="text-sm" />
      {changes ? (
        <div className="grid flex-1 grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
          <MoveList title={c("Largest buys", "主要买入")} rows={buys} empty={c("No buys this quarter", "本季无买入")} />
          <MoveList title={c("Largest sells", "主要卖出")} rows={sells} empty={c("No sells this quarter", "本季无卖出")} />
        </div>
      ) : (
        <p className="text-xs leading-5 text-muted-foreground">
          {c(
            "The prior quarter could not be compared, so buys and sells are not listed.",
            "无法与上季比较，因此不列出买入和卖出。",
          )}
        </p>
      )}
    </Card>
  );
}

function MoveList({ title, rows, empty }: { title: string; rows: Holding[]; empty: string }) {
  const f = useFinancialFormat();
  return (
    <div className="min-w-0">
      <h3 className="border-b border-border pb-2 text-xs text-muted-foreground">{title}</h3>
      {rows.length ? (
        <ul>
          {rows.map((row) => (
            <li key={rowKey(row)} className="flex min-h-11 min-w-0 items-center gap-2 border-b border-border py-1.5 text-xs last:border-0">
              <HoldingName row={row} size="xs" className="flex-1" />
              <ActivityBadge kind={row.activity} />
              <span className="figure w-14 shrink-0 text-right text-muted-foreground">
                {row.activity === "new" || row.activity === "exited" ? `$${f.number(row.value ?? 0)}` : f.percent(row.change_percent)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-3 text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function HoldingsTable({ data }: { data: Institution }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const activity = useActivityLabel();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>({ key: "value", dir: "desc" });
  const [visible, setVisible] = useState(PAGE);
  const holdings = data.holdings;
  const reset = () => setVisible(PAGE);

  const filters: Filter[] = ["all", "new", "increased", "reduced", "exited", "unchanged"];
  const counts = Object.fromEntries(
    filters.map((kind) => [kind, kind === "all" ? holdings.length : holdings.filter((row) => row.activity === kind).length]),
  ) as Record<Filter, number>;

  const needle = query.trim().toUpperCase();
  const filtered = holdings
    .filter((row) => filter === "all" || row.activity === filter)
    .filter((row) => !needle || row.ticker?.toUpperCase().startsWith(needle) || row.issuer.toUpperCase().includes(needle) || row.cusip?.includes(needle))
    .sort((a, b) => {
      const x = sortValue(a, sort.key);
      const y = sortValue(b, sort.key);
      if (x === null && y === null) return 0;
      if (x === null) return 1;
      if (y === null) return -1;
      return sort.dir === "desc" ? y - x : x - y;
    });
  const rows = filtered.slice(0, visible);
  const maxWeight = Math.max(...holdings.map((row) => row.weight ?? 0), 0.0001);
  const ranks = new Map(
    [...holdings]
      .filter((row) => row.activity !== "exited")
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .map((row, index) => [rowKey(row), index + 1]),
  );

  const toggle = (key: SortKey) => {
    setSort((current) => ({ key, dir: current.key === key && current.dir === "desc" ? "asc" : "desc" }));
    reset();
  };
  const sortHead = (label: string, sortKey: SortKey) => {
    const active = sort.key === sortKey;
    const Icon = !active ? ChevronsUpDown : sort.dir === "desc" ? ArrowDown : ArrowUp;
    return (
      <th key={sortKey} scope="col" aria-sort={active ? (sort.dir === "desc" ? "descending" : "ascending") : "none"} className="px-3 py-3 text-right font-normal">
        <button
          type="button"
          onClick={() => toggle(sortKey)}
          className={cn(
            "-mr-1 inline-flex min-h-8 items-center gap-1 rounded-full px-1 transition-colors hover:text-foreground focus-visible:text-foreground",
            active && "text-foreground",
          )}
        >
          {label}
          <Icon className={cn("h-3.5 w-3.5", !active && "opacity-50")} aria-hidden="true" />
        </button>
      </th>
    );
  };

  return (
    <section aria-labelledby="holdings-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="holdings-title" className="text-lg font-semibold md:text-xl">
            {c("Holdings", "持仓明细")}
          </h2>
          <p role="status" className="figure mt-1 text-xs text-muted-foreground">
            {filtered.length === holdings.length
              ? c(`${f.number(holdings.length, false)} rows`, `共 ${f.number(holdings.length, false)} 行`)
              : c(
                  `${f.number(filtered.length, false)} of ${f.number(holdings.length, false)} rows`,
                  `${f.number(filtered.length, false)} / ${f.number(holdings.length, false)} 行`,
                )}
          </p>
        </div>
        {secSourceUrl(data.filing?.source_url) && (
          <a
            href={secSourceUrl(data.filing?.source_url)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground"
          >
            {c("Original filing on SEC", "在 SEC 查看原始申报")}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </div>

      <ListCard className="!p-0">
        <div className="flex flex-col gap-3 p-3 sm:p-4 md:flex-row md:items-center md:justify-between">
          <div
            role="group"
            aria-label={c("Filter by quarter change", "按季度变化筛选")}
            className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 md:pb-0"
          >
            {filters.map((kind) =>
              kind !== "all" && !counts[kind] ? null : (
                <ChipButton
                  key={kind}
                  type="button"
                  variant={filter === kind ? "primary" : "ghost"}
                  aria-pressed={filter === kind}
                  className={cn("min-h-9 shrink-0", filter === kind && "bg-foreground/[0.1]")}
                  onClick={() => {
                    setFilter(kind);
                    reset();
                  }}
                >
                  {kind === "all" ? c("All", "全部") : activity(kind)}
                  <span className="figure text-muted-foreground">{f.number(counts[kind], false)}</span>
                </ChipButton>
              ),
            )}
          </div>
          <Input
            type="search"
            className="h-10 w-full px-4 text-sm md:w-64"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              reset();
            }}
            placeholder={c("Filter by ticker, company or CUSIP", "按代码、公司或 CUSIP 筛选")}
            aria-label={c("Filter holdings by company", "按公司筛选持仓")}
          />
        </div>

        <div
          role="region"
          tabIndex={0}
          aria-label={c("13F holdings, horizontally scrollable", "13F 持仓表，可横向滚动")}
          className="max-h-[72vh] overflow-auto border-t border-border focus-visible:outline-none"
        >
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="sticky top-0 z-10 bg-card text-xs text-muted-foreground shadow-[inset_0_-1px_0_rgb(var(--border))]">
              <tr>
                <th scope="col" className="w-10 py-3 pl-4 pr-1 text-left font-normal">
                  #
                </th>
                <th scope="col" className="px-3 py-3 text-left font-normal">
                  {c("Company", "公司")}
                </th>
                {sortHead(c("Value", "市值"), "value")}
                <th scope="col" className="px-3 py-3 text-right font-normal">
                  {c("Weight", "权重")}
                </th>
                {sortHead(c("Shares", "股数"), "shares")}
                <th scope="col" className="px-3 py-3 text-left font-normal">
                  {c("Vs prior quarter", "较上季")}
                </th>
                {sortHead(c("Share change", "股数变化"), "change")}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className="border-b border-border transition-colors last:border-0 hover:bg-foreground/[0.04] motion-reduce:transition-none"
                >
                  <td className="figure py-3 pl-4 pr-1 text-xs text-muted-foreground">{ranks.get(rowKey(row)) ?? "—"}</td>
                  <th scope="row" className="max-w-[18rem] px-3 py-3 text-left font-normal">
                    <HoldingName row={row} detail />
                  </th>
                  <td className="figure px-3 py-3 text-right font-medium">{row.value === null ? "—" : `$${f.number(row.value)}`}</td>
                  <td className="px-3 py-3 text-right">
                    <span className="figure block">{f.percent(row.weight)}</span>
                    <span aria-hidden="true" className="ml-auto mt-1.5 block h-1 w-16 overflow-hidden rounded-full bg-foreground/[0.07]">
                      <span
                        className="block h-full rounded-full bg-foreground/50"
                        style={{ width: `${((row.weight ?? 0) / maxWeight) * 100}%` }}
                      />
                    </span>
                  </td>
                  <td className="figure px-3 py-3 text-right">
                    {f.number(row.shares)}
                    {row.previous_shares !== null && row.previous_shares !== row.shares && (
                      <span className="block text-xs text-muted-foreground">
                        {c("prev.", "上季")} {f.number(row.previous_shares)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <ActivityBadge kind={row.activity} />
                  </td>
                  <td className="figure py-3 pl-3 pr-4 text-right">
                    {row.change === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : row.change === 0 ? (
                      <span className="text-muted-foreground">0</span>
                    ) : (
                      <>
                        <span className={cn("block font-medium", row.change > 0 ? "text-positive" : "text-negative")}>
                          {row.change > 0 ? "+" : "−"}
                          {f.number(Math.abs(row.change))}
                        </span>
                        {row.change_percent !== null && (
                          <span className="block text-xs text-muted-foreground">
                            {row.change_percent > 0 ? "+" : ""}
                            {f.percent(row.change_percent)}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              <p>{c("No holdings match this filter.", "没有符合筛选条件的持仓。")}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                  reset();
                }}
              >
                {c("Reset filters", "重置筛选")}
              </Button>
            </div>
          )}
        </div>
        {filtered.length > visible && (
          <div className="border-t border-border">
            <ListLoadMore onClick={() => setVisible((count) => count + PAGE)}>
              {c("Show more", "显示更多")} ({f.number(filtered.length - visible, false)})
            </ListLoadMore>
          </div>
        )}
      </ListCard>

      {(data.partial || data.amendments.length > 0) && (
        <div role="status" className="space-y-1 rounded-2xl bg-muted px-4 py-3 text-xs leading-5 text-muted-foreground">
          {data.partial && (
            <p>
              {c(
                "This filing has an amendment or its prior quarter could not be read, so quarter-over-quarter changes are not compared.",
                "这份申报有修正，或上季申报无法读取，所以不比较季度变化。",
              )}
            </p>
          )}
          {data.amendments.length > 0 && (
            <p>
              {c("Amendments", "修正申报")}:{" "}
              {data.amendments.map((amendment, index) => (
                <span key={amendment.accession}>
                  {index > 0 && " · "}
                  <SecLink href={amendment.source_url}>
                    {amendment.form} {f.date(amendment.filed)}
                  </SecLink>
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
