"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CompanyLogo from "@/components/ui/company-logo";
import { Skeleton } from "@/components/ui/skeleton";
import OpinionStrength from "@/components/youtube/OpinionStrength";
import { listTheses, type Thesis } from "@/lib/decision";
import { cn } from "@/lib/utils";
import { DirectionBadge, Empty, Panel, TextLink, useCopy, useCreatorCatalogue, useDayLabel } from "./shared";
import { useChangeLabels, useThesisSignals } from "./ThesisWatch";
import { useDecisionCommand } from "./CommandLayer";

/** What moved for the stocks you hold: theses crossing their plan and creator opinion shifts. */
export default function PortfolioChanges({ tickers }: { tickers: string[] }) {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const { setContext } = useDecisionCommand();
  const [theses, setTheses] = useState<Thesis[] | null>(null);
  const catalogue = useCreatorCatalogue();
  const changeLabels = useChangeLabels();
  const heldKey = tickers.join(",");

  useEffect(() => {
    let alive = true;
    listTheses()
      .then((data) => alive && setTheses(data.items))
      .catch(() => alive && setTheses([]));
    return () => {
      alive = false;
    };
  }, []);

  const heldTheses = useMemo(
    () => (theses ?? []).filter((thesis) => thesis.status === "active" && heldKey.split(",").includes(thesis.ticker)),
    [theses, heldKey],
  );
  const signals = useThesisSignals(heldTheses);
  const flagged = heldTheses.filter((thesis) => signals.changesFor(thesis).length);
  const shifts = (catalogue.data?.changes ?? [])
    .filter((change) => tickers.includes(change.ticker))
    .sort((a, b) => b.current_date.localeCompare(a.current_date))
    .slice(0, 6);
  const unplanned = tickers.filter((ticker) => !(theses ?? []).some((thesis) => thesis.ticker === ticker && thesis.status === "active"));

  const commandContext = JSON.stringify({
    workspace: "Portfolio",
    heldTickers: tickers,
    thesesNeedingReview: flagged.map((thesis) => ({ ticker: thesis.ticker, changes: signals.changesFor(thesis) })),
    creatorShiftsOnHoldings: shifts,
    holdingsWithoutThesis: unplanned,
  });
  useEffect(() => {
    setContext(commandContext);
    return () => setContext("");
  }, [commandContext, setContext]);

  if (!tickers.length) return null;
  const loading = theses === null || (catalogue.loading && !catalogue.data);
  const rowClass =
    "-mx-3 flex items-center justify-between gap-4 rounded-xl px-3 py-3.5 transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary";

  return (
    <Panel
      className="pb-2 pt-4"
      title={c("What changed in your holdings", "你的持仓有什么变化")}
      action={<TextLink href="/dashboard/journal">{c("Journal", "决策日志")}</TextLink>}
    >
      {loading ? (
        <div className="space-y-3 py-4">
          {[0, 1].map((row) => <Skeleton key={row} className="h-11 w-full" />)}
        </div>
      ) : !flagged.length && !shifts.length ? (
        <Empty>
          {heldTheses.length
            ? c("Your theses are within plan and no creator changed a view on what you hold.", "你的判断都在计划内，博主对你的持仓也没有新的变化。")
            : c("No creator changed a view on what you hold.", "博主对你的持仓没有新的变化。")}
        </Empty>
      ) : (
        <ul className="divide-y divide-border">
          {flagged.map((thesis) => (
            <li key={thesis.thesis_id}>
              <Link href={`/dashboard/research/${encodeURIComponent(thesis.ticker)}`} className={rowClass}>
                <span className="flex min-w-0 items-center gap-3">
                  <span aria-hidden><CompanyLogo symbol={thesis.ticker} size="md" /></span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[15px] font-semibold">
                      {thesis.ticker}
                      <DirectionBadge direction={thesis.direction} className="text-xs" />
                    </span>
                    <span className="block truncate text-[13px] text-muted-foreground">{thesis.reasoning}</span>
                  </span>
                </span>
                <span className="shrink-0 text-right text-[13px] font-semibold text-warning">
                  {signals.changesFor(thesis).map((key) => changeLabels[key]).join(c(", ", "，"))}
                </span>
              </Link>
            </li>
          ))}
          {shifts.map((shift) => (
            <li key={shift.ticker}>
              <Link href={`/dashboard/research/${encodeURIComponent(shift.ticker)}`} className={rowClass}>
                <span className="flex min-w-0 items-center gap-3">
                  <span aria-hidden><CompanyLogo symbol={shift.ticker} size="md" /></span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold">{shift.ticker}</span>
                    <span className="block text-[13px] text-muted-foreground">
                      {c("Creators", "博主观点")}
                      {c(", ", "，")}
                      {dayLabel(shift.current_date)}
                    </span>
                  </span>
                </span>
                <span className={cn("flex shrink-0 flex-col items-end gap-0.5")}>
                  {shift.change == null ? (
                    <>
                      <OpinionStrength value={shift.current_score} className="text-[13px]" />
                      <span className="text-xs text-muted-foreground">{c("New opinion", "新观点")}</span>
                    </>
                  ) : (
                    <OpinionStrength value={shift.change} change className="text-[13px]" />
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {!loading && unplanned.length > 0 && (
        <p className="border-t border-border pt-3 text-[13px] text-muted-foreground">
          {c(
            `${unplanned.length} of your holdings have no written thesis.`,
            `你有 ${unplanned.length} 只持仓还没有写下判断。`,
          )}{" "}
          <Link
            href={`/dashboard/research/${encodeURIComponent(unplanned[0])}`}
            className="font-semibold text-foreground underline-offset-4 hover:underline"
          >
            {c(`Start with ${unplanned[0]}`, `从 ${unplanned[0]} 开始`)}
          </Link>
        </p>
      )}
    </Panel>
  );
}
