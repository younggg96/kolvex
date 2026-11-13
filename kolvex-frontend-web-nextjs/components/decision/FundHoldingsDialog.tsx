"use client";

import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import CompanyLogo from "@/components/ui/company-logo";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketQuotes } from "@/hooks/useMarketQuotes";
import { loadFundHoldings, type FundHolding } from "@/lib/fundHoldings";
import type { MarketInstrument } from "@/lib/marketBenchmarks";
import { marketStockHref, marketStockUrl } from "@/lib/stockLinks";
import { cn } from "@/lib/utils";
import { MarketInfoButton } from "./MarketToolbar";
import { useCopy } from "./shared";

type State = { status: "loading" | "ready" | "error"; holdings: FundHolding[] };

const weightText = (weight: number) => `${(weight * 100).toFixed(2)}%`;

function HoldingRow({ holding, scale, changePercent }: { holding: FundHolding; scale: number; changePercent?: number }) {
  const c = useCopy();
  const href = holding.symbol ? marketStockUrl(holding.symbol) : null;
  const label = holding.symbol ?? holding.name ?? "—";
  const body = (
    <>
      <span className="shrink-0" aria-hidden>
        {holding.symbol ? <CompanyLogo symbol={holding.symbol} name={holding.name ?? undefined} size="sm" /> : <span className="block h-8 w-8" />}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>
        {holding.symbol && holding.name && <span className="block truncate text-xs text-muted-foreground">{holding.name}</span>}
      </span>
      <span className="flex w-28 shrink-0 flex-col items-end gap-1 max-sm:w-20">
        <span className="figure text-sm font-medium">{weightText(holding.weight)}</span>
        <span className="h-1 w-full overflow-hidden rounded-full bg-foreground/[0.08]" aria-hidden>
          <span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.max(4, (holding.weight / scale) * 100)}%` }} />
        </span>
      </span>
      <span className={cn("figure w-16 shrink-0 text-right text-xs font-medium", changePercent === undefined ? "text-muted-foreground" : changePercent >= 0 ? "text-positive" : "text-negative")}>
        {changePercent === undefined ? "—" : `${changePercent >= 0 ? "+" : "−"}${Math.abs(changePercent).toFixed(2)}%`}
      </span>
    </>
  );
  const rowClass = "grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-2xl px-2 py-1.5";
  return (
    <li>
      {href ? (
        <Link href={href} className={cn(rowClass, "transition-colors duration-150 hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")} aria-label={c(`${label}, ${weightText(holding.weight)} of fund`, `${label}，占基金 ${weightText(holding.weight)}`)}>
          {body}
        </Link>
      ) : <div className={rowClass}>{body}</div>}
    </li>
  );
}

export default function FundHoldingsDialog({ instrument, onClose }: { instrument: MarketInstrument; onClose: () => void }) {
  const c = useCopy();
  const [state, setState] = useState<State>({ status: "loading", holdings: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState(previous => ({ status: "loading", holdings: previous.holdings }));
    loadFundHoldings(instrument.symbol, { force: attempt > 0, signal: controller.signal })
      .then(holdings => { if (!controller.signal.aborted) setState({ status: "ready", holdings }); })
      .catch(() => { if (!controller.signal.aborted) setState(previous => ({ status: "error", holdings: previous.holdings })); });
    return () => controller.abort();
  }, [instrument.symbol, attempt]);

  const symbols = state.holdings.flatMap(item => item.symbol ? [item.symbol] : []);
  const { quotes } = useMarketQuotes(symbols, symbols.length > 0);
  const total = state.holdings.reduce((sum, item) => sum + item.weight, 0);
  const scale = state.holdings[0]?.weight ?? 1;
  const name = c(instrument.en, instrument.zh);

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent layout="sheet" showCloseButton={false} className="flex flex-col gap-4 sm:max-h-[85dvh]">
        <div className="flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="truncate text-lg">{name} · {c("Top holdings", "权重股")}</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
              {instrument.symbol}
              {state.status === "ready" && state.holdings.length > 0 && <> · <span className="figure">{c(`Top ${state.holdings.length} = ${weightText(total)} of fund`, `前 ${state.holdings.length} 大合计 ${weightText(total)}`)}</span></>}
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <MarketInfoButton label={c("About holdings data", "持仓数据说明")}>
              <p>{c("Weights come from the fund's latest disclosed holdings via Yahoo Finance and can lag the market by days or weeks. Change is today's move for each stock.", "权重来自 Yahoo Finance 汇总的基金最新披露持仓，可能比实际滞后数天到数周。涨跌为个股今日表现。")}</p>
            </MarketInfoButton>
            <DialogClose asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 rounded-full" aria-label={c("Close holdings", "关闭权重股")}><X className="h-4 w-4" aria-hidden /></Button>
            </DialogClose>
          </div>
        </div>

        <div className="-mx-2 min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-busy={state.status === "loading"}>
          {state.holdings.length > 0 ? (
            <ol aria-label={c(`${name} holdings by weight`, `${name}持仓权重`)} className={cn("space-y-0.5", state.status === "loading" && "opacity-60")}>
              {state.holdings.map(holding => (
                <HoldingRow key={`${holding.symbol}-${holding.name}`} holding={holding} scale={scale} changePercent={holding.symbol ? quotes[holding.symbol]?.changePercent : undefined} />
              ))}
            </ol>
          ) : state.status === "loading" ? (
            <div role="status" aria-label={c("Loading holdings", "正在加载权重股")} className="space-y-2 px-2">
              {Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-12 w-full rounded-2xl" />)}
            </div>
          ) : state.status === "error" ? (
            <div className="flex flex-col items-center gap-3 px-2 py-10 text-center">
              <p className="text-sm">{c("Holdings could not be loaded.", "暂时无法加载权重股。")}</p>
              <Button size="sm" variant="outline" onClick={() => setAttempt(value => value + 1)}>{c("Retry", "重试")}</Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-2 py-10 text-center">
              <p className="text-sm">{c("This fund has no stock holdings to show.", "该基金没有可展示的个股持仓。")}</p>
            </div>
          )}
        </div>

        <Button asChild variant="outline" className="shrink-0 gap-1.5 rounded-full">
          <Link href={marketStockHref(instrument.symbol)}>{c(`Open ${instrument.symbol} quote`, `查看 ${instrument.symbol} 行情`)}<ArrowUpRight className="h-4 w-4" aria-hidden /></Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
