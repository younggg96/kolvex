"use client";

import Link from "next/link";
import { useEffect } from "react";
import CompanyLogo from "@/components/ui/company-logo";
import { Skeleton } from "@/components/ui/skeleton";
import OpinionStrength from "@/components/youtube/OpinionStrength";
import { cn } from "@/lib/utils";
import { Empty, Panel, TextLink, useCopy, useCreatorCatalogue, useDayLabel } from "./shared";
import { useDecisionCommand } from "./CommandLayer";

/** Creator opinion updates matched automatically to linked equity holdings. */
export default function PortfolioChanges({ tickers }: { tickers: string[] }) {
  const c = useCopy();
  const dayLabel = useDayLabel();
  const { setContext } = useDecisionCommand();
  const catalogue = useCreatorCatalogue();
  const shifts = (catalogue.data?.changes ?? [])
    .filter((change) => tickers.includes(change.ticker))
    .sort((a, b) => b.current_date.localeCompare(a.current_date))
    .slice(0, 6);

  const commandContext = JSON.stringify({
    workspace: "Portfolio",
    heldTickers: tickers,
    creatorShiftsOnHoldings: shifts,
  });
  useEffect(() => {
    setContext(commandContext);
    return () => setContext("");
  }, [commandContext, setContext]);

  if (!tickers.length) return null;
  const loading = catalogue.loading && !catalogue.data;
  const rowClass =
    "-mx-3 flex items-center justify-between gap-4 rounded-xl px-3 py-3.5 transition-colors duration-150 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary";

  return (
    <Panel
      className="pb-2 pt-4"
      title={c("What changed in your holdings", "你的持仓有什么变化")}
      action={<TextLink href="/dashboard/journal">{c("Updates", "变化动态")}</TextLink>}
    >
      {loading ? (
        <div className="space-y-3 py-4">
          {[0, 1].map((row) => <Skeleton key={row} className="h-11 w-full" />)}
        </div>
      ) : catalogue.error ? (
        <p role="alert" className="py-4 text-sm text-muted-foreground">{c("Creator updates are temporarily unavailable.", "博主动态暂时无法加载。")}</p>
      ) : !shifts.length ? (
        <Empty>{c("No creator updates on your holdings in the available data.", "现有数据中暂无与你持仓相关的博主动态。")}</Empty>
      ) : (
        <ul className="divide-y divide-border">
          {shifts.map((shift) => (
            <li key={`${shift.current_date}-${shift.ticker}`}>
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
    </Panel>
  );
}
