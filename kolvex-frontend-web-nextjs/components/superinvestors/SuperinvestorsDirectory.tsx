"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ContentLoading } from "@/components/ui/content-loading";
import { ListEmptyState, ListFooterLink } from "@/components/ui/list-card";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SourceNote } from "@/components/decision/SecData";
import { useFinancialFormat } from "@/components/decision/StockFinancialData";
import { useCopy } from "@/components/decision/shared";
import { useCachedResource } from "@/hooks/useCachedResource";
import {
  INSTITUTIONS_KEY,
  institutionSummaryKey,
  reportingQuarter,
  type InstitutionManager,
  type InstitutionSummary,
} from "@/lib/freeResearch";
import { loadFundamentals } from "@/lib/stockFundamentals";
import { cn } from "@/lib/utils";
import {
  ALLOCATION_SHADES,
  ActivityBadge,
  AllocationBar,
  ChangeBreakdown,
  HoldingName,
  InvestorAvatar,
  sumWeights,
  superinvestorHref,
  useInvestorByline,
  useQuarterLabel,
} from "./shared";

export { superinvestorHref };

type Entry = { manager: InstitutionManager; summary: InstitutionSummary | null };
type Loaded = Entry & { summary: InstitutionSummary & { filing: NonNullable<InstitutionSummary["filing"]> } };
type Sort = "latest" | "size" | "activity";

/**
 * Every summary is a separate request, so one slow SEC read can fail alone
 * without hiding the rest of the directory.
 */
async function loadDirectory(signal: AbortSignal): Promise<Entry[]> {
  const { managers } = await loadFundamentals<{ managers: InstitutionManager[] }>(INSTITUTIONS_KEY, signal);
  const results = await Promise.allSettled(
    managers.map((manager) => loadFundamentals<InstitutionSummary>(institutionSummaryKey(manager.id), signal)),
  );
  return managers.map((manager, index) => {
    const result = results[index];
    return { manager, summary: result.status === "fulfilled" ? result.value : null };
  });
}

const changeTotal = (summary: InstitutionSummary) =>
  summary.changes ? summary.changes.new + summary.changes.increased + summary.changes.reduced + summary.changes.exited : -1;
const bySize = (a: Loaded, b: Loaded) => b.summary.value - a.summary.value;

export default function SuperinvestorsDirectory() {
  const c = useCopy();
  const f = useFinancialFormat();
  const quarterLabel = useQuarterLabel();
  const [sort, setSort] = useState<Sort>("latest");
  const { data, loading, refreshing, error, refresh } = useCachedResource(
    "superinvestors:directory",
    loadDirectory,
    { ttl: 600_000, timeout: 90_000 },
  );
  const entries = data ?? [];
  const loaded = entries.filter((entry): entry is Loaded => Boolean(entry.summary?.filing));
  const failed = entries.filter((entry) => !entry.summary);
  const lead = [...loaded].sort(bySize)[0];
  const totalValue = loaded.reduce((sum, entry) => sum + entry.summary.value, 0);
  const latestFiled = loaded.reduce<string | null>(
    (latest, entry) => (!latest || entry.summary.filing.filed > latest ? entry.summary.filing.filed : latest),
    null,
  );

  const groups = (() => {
    if (sort === "size") return [{ key: "all", label: null as string | null, items: [...loaded].sort(bySize) }];
    if (sort === "activity")
      return [{ key: "all", label: null, items: [...loaded].sort((a, b) => changeTotal(b.summary) - changeTotal(a.summary)) }];
    const byQuarter = new Map<string, Loaded[]>();
    for (const entry of [...loaded].sort((a, b) => b.summary.filing.filed.localeCompare(a.summary.filing.filed))) {
      const q = reportingQuarter(entry.summary.filing.period);
      const key = q ? `${q.year}-${q.quarter}` : "other";
      byQuarter.set(key, [...(byQuarter.get(key) ?? []), entry]);
    }
    return [...byQuarter.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) => ({
        key,
        label: key === "other" ? c("Other periods", "其他期间") : quarterLabel(items[0].summary.filing.period),
        items,
      }));
  })();

  return (
    <div className="space-y-8 md:space-y-10">
      {loading && !data ? (
        <div className="space-y-2">
          <ContentLoading
            className="min-h-48"
            label={c("Reading the latest 13F filings from the SEC…", "正在从 SEC 读取最新 13F 申报…")}
          />
          <p className="text-center text-xs text-muted-foreground">
            {c(
              "The first load reads each investor's filings from the SEC and can take a little while.",
              "首次加载需要从 SEC 逐一读取申报，可能稍慢。",
            )}
          </p>
        </div>
      ) : error && !data ? (
        <Card className="px-5 py-2">
          <ListEmptyState
            alert
            title={c("Investor filings could not be loaded", "投资者申报加载失败")}
            description={c("The SEC may be slow to respond. Try again in a moment.", "SEC 响应可能较慢，请稍后重试。")}
            action={
              <Button variant="outline" size="sm" onClick={refresh}>
                {c("Retry", "重试")}
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {lead && <LeadCard entry={lead} />}

          <section aria-labelledby="superinvestors-list-title" className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 id="superinvestors-list-title" className="text-lg font-semibold md:text-xl">
                  {c(`${entries.length} investors`, `${entries.length} 位投资者`)}
                </h2>
                {loaded.length > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c("Combined reported value", "合计申报市值")}{" "}
                    <span className="figure font-medium text-foreground">${f.number(totalValue)}</span>
                    {latestFiled && (
                      <>
                        {" · "}
                        {c("Latest filing", "最新申报")} {f.date(latestFiled)}
                      </>
                    )}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <SegmentedControl
                  size="sm"
                  label={c("Sort investors", "投资者排序")}
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: "latest", label: c("Latest filing", "最新申报") },
                    { value: "size", label: c("Size", "规模") },
                    { value: "activity", label: c("Most active", "调仓最多") },
                  ]}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0"
                  onClick={refresh}
                  disabled={refreshing}
                  aria-label={c("Refresh filings", "刷新申报")}
                  title={c("Refresh filings", "刷新申报")}
                >
                  <RefreshCw
                    className={cn("h-4 w-4", refreshing && "animate-spin motion-reduce:animate-none")}
                    aria-hidden="true"
                  />
                </Button>
              </div>
            </div>

            {groups.map((group) => (
              <div key={group.key} className="space-y-3">
                {group.label && (
                  <h3 className="flex items-baseline justify-between gap-3 border-b border-border pb-2 text-sm font-medium text-muted-foreground">
                    <span>{group.label}</span>
                    <span className="figure text-xs font-normal">
                      {c(`${group.items.length} filed`, `${group.items.length} 份申报`)}
                    </span>
                  </h3>
                )}
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.items.map((entry) => (
                    <li key={entry.manager.id} className="min-w-0">
                      <InvestorCard entry={entry} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {failed.length > 0 && (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted px-4 py-3 text-sm"
              >
                <p className="text-muted-foreground">
                  {c(
                    `Filings for ${failed.map((entry) => entry.manager.name).join(", ")} could not be read from the SEC right now.`,
                    `暂时无法从 SEC 读取 ${failed.map((entry) => entry.manager.name).join("、")} 的申报。`,
                  )}
                </p>
                <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
                  {c("Retry", "重试")}
                </Button>
              </div>
            )}
          </section>
        </>
      )}

      <SourceNote>
        {c(
          "Source: SEC Form 13F-HR, latest original filing per investor. 13F is a quarter-end snapshot filed up to 45 days later. It is not live positions and excludes shorts and most non-US holdings. Investors are a curated list, not every institution.",
          "来源：SEC Form 13F-HR，每位投资者最近一份原始申报。13F 是季度末持仓快照，最晚在季末 45 天后披露，不代表当前持仓，也不含空头和大部分非美股持仓。投资者为精选名单，并非全部机构。",
        )}
      </SourceNote>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="figure mt-1 text-lg font-semibold">{children}</dd>
    </div>
  );
}

function LeadCard({ entry }: { entry: Loaded }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const quarterLabel = useQuarterLabel();
  const byline = useInvestorByline();
  const summary = entry.summary;
  const topShare = sumWeights(summary.top);
  const changes = changeTotal(summary);
  return (
    <section aria-labelledby="superinvestor-lead-title">
      <Card className="grid gap-6 p-5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-8 md:p-6">
        <div className="flex min-w-0 flex-col gap-6">
          <div className="flex min-w-0 items-start gap-3">
            <InvestorAvatar id={entry.manager.id} name={entry.manager.name} size="lg" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{c("Largest reported value", "申报市值最大")}</p>
              <h2 id="superinvestor-lead-title" className="mt-1 truncate text-xl font-semibold">
                <Link
                  href={superinvestorHref(entry.manager.id)}
                  className="underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                >
                  {entry.manager.name}
                </Link>
              </h2>
              {byline(entry.manager.id, true) && (
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{byline(entry.manager.id, true)}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {quarterLabel(summary.filing.period)}
                {" · "}
                {c("Filed", "申报于")} {f.date(summary.filing.filed)}
              </p>
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-4">
            <Stat label={c("Reported value", "申报市值")}>${f.number(summary.value)}</Stat>
            <Stat label={c("Positions", "持仓数")}>{f.number(summary.positions, false)}</Stat>
            <Stat label={c("Changes", "季度变动")}>{changes < 0 ? "—" : f.number(changes, false)}</Stat>
          </dl>

          {summary.top.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-muted-foreground">
                  {c(`Top ${summary.top.length} concentration`, `前 ${summary.top.length} 大持仓集中度`)}
                </span>
                <span className="figure font-semibold">{f.percent(topShare)}</span>
              </div>
              <AllocationBar
                weights={summary.top.map((row) => row.weight)}
                label={c(
                  `Top ${summary.top.length} holdings are ${f.percent(topShare)} of reported value`,
                  `前 ${summary.top.length} 大持仓占申报市值 ${f.percent(topShare)}`,
                )}
              />
            </div>
          )}

          <div className="mt-auto space-y-1.5 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">{c("Vs prior quarter", "较上季")}</p>
            <ChangeBreakdown changes={summary.changes} className="text-sm" />
          </div>
        </div>

        <div className="flex min-w-0 flex-col md:border-l md:border-border md:pl-8">
          <h3 className="text-xs font-medium text-muted-foreground">
            {c(`Top ${summary.top.length} holdings`, `前 ${summary.top.length} 大持仓`)}
          </h3>
          <ol className="mt-2 flex-1">
            {summary.top.map((row, index) => (
              <li
                key={`${row.cusip}-${row.class}-${row.put_call}`}
                className="grid min-h-12 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border py-2 text-sm last:border-0"
              >
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", ALLOCATION_SHADES[index])} />
                  <span className="figure text-xs text-muted-foreground">{index + 1}</span>
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <HoldingName row={row} className="min-w-0" />
                  <span className="hidden shrink-0 truncate text-xs text-muted-foreground sm:inline">
                    {row.ticker ? row.issuer : row.class}
                  </span>
                  <ActivityBadge kind={row.activity} />
                </span>
                <span className="text-right">
                  <span className="figure block font-medium">{f.percent(row.weight)}</span>
                  <span className="figure block text-xs text-muted-foreground">${f.number(row.value)}</span>
                </span>
              </li>
            ))}
          </ol>
          <ListFooterLink href={superinvestorHref(entry.manager.id)}>
            {c(`View all ${f.number(summary.positions, false)} holdings`, `查看全部 ${f.number(summary.positions, false)} 个持仓`)}
          </ListFooterLink>
        </div>
      </Card>
    </section>
  );
}

function InvestorCard({ entry }: { entry: Loaded }) {
  const c = useCopy();
  const f = useFinancialFormat();
  const byline = useInvestorByline();
  const summary = entry.summary;
  const first = summary.top[0];
  const topShare = sumWeights(summary.top);
  return (
    <Link
      href={superinvestorHref(entry.manager.id)}
      className="glass-card group flex h-full min-w-0 flex-col gap-4 rounded-3xl border border-foreground/10 bg-card-glass p-4 transition-colors hover:bg-foreground/[0.04] focus-visible:outline-none active:bg-foreground/[0.07] sm:p-5"
    >
      <div className="flex min-w-0 items-start gap-3">
        <InvestorAvatar id={entry.manager.id} name={entry.manager.name} />
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold">{entry.manager.name}</h4>
          {byline(entry.manager.id) && (
            <p className="mt-0.5 truncate text-xs text-foreground/75">{byline(entry.manager.id)}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {c("Filed", "申报于")} {f.date(summary.filing.filed)}
          </p>
        </div>
        <ChevronRight
          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="figure text-xl font-semibold tracking-tight">${f.number(summary.value)}</p>
          <p className="text-xs text-muted-foreground">{c("Reported value", "申报市值")}</p>
        </div>
        <div className="text-right">
          <p className="figure text-sm font-semibold">{f.number(summary.positions, false)}</p>
          <p className="text-xs text-muted-foreground">{c("Positions", "持仓")}</p>
        </div>
      </div>

      {first && (
        <div className="space-y-2">
          <AllocationBar
            className="h-1.5"
            weights={summary.top.map((row) => row.weight)}
            label={c(
              `Top ${summary.top.length} holdings are ${f.percent(topShare)} of reported value`,
              `前 ${summary.top.length} 大持仓占申报市值 ${f.percent(topShare)}`,
            )}
          />
          <p className="flex min-w-0 items-baseline gap-2 text-xs">
            <span className="shrink-0 text-muted-foreground">{c("Largest", "第一大")}</span>
            <HoldingName row={first} link={false} size="xs" className="flex-1" />
            <span className="figure shrink-0">{f.percent(first.weight)}</span>
          </p>
          <p className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
            <span>{c(`Top ${summary.top.length} share`, `前 ${summary.top.length} 大占比`)}</span>
            <span className="figure text-foreground">{f.percent(topShare)}</span>
          </p>
        </div>
      )}

      <ChangeBreakdown compact changes={summary.changes} className="mt-auto border-t border-border pt-3" />
    </Link>
  );
}
