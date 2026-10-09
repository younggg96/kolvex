"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CompanyLogo from "@/components/ui/company-logo";
import { Button } from "@/components/ui/button";
import { getMyHoldings } from "@/lib/portfolioApi";
import { getYouTubeOpinionDashboard } from "@/lib/youtubeOpinionsApi";
import type { StockQuote } from "@/lib/stockApi";
import { Empty, TickerSearch, money, useCopy } from "./shared";
import { useDecisionCommand } from "./CommandLayer";
import styles from "./ResearchHome.module.css";

const DEFAULT_STOCKS = ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "AVGO"];
const BENCHMARKS = [
  { symbol: "SPY", en: "S&P 500 ETF", zh: "标普 500 ETF" },
  { symbol: "QQQ", en: "Nasdaq 100 ETF", zh: "纳斯达克 100 ETF" },
  { symbol: "DIA", en: "Dow Jones ETF", zh: "道琼斯 ETF" },
];
type Universe = "featured" | "holdings" | "creators";

function Change({ quote }: { quote?: StockQuote }) {
  const value = quote?.changePercent;
  if (value == null || !Number.isFinite(value)) return <span className="text-muted-foreground">—</span>;
  return <span className={`tabular-nums ${value > 0 ? "text-positive" : value < 0 ? "text-negative" : "text-muted-foreground"}`}>{value > 0 ? "+" : ""}{value.toFixed(2)}%</span>;
}

export default function Market() {
  const c = useCopy();
  const { setContext } = useDecisionCommand();
  const [universe, setUniverse] = useState<Universe>("featured");
  const [holdings, setHoldings] = useState<string[]>([]);
  const [coverage, setCoverage] = useState<string[]>([]);
  const [sourceLoading, setSourceLoading] = useState(true);
  const [sourceErrors, setSourceErrors] = useState<Universe[]>([]);
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sort, setSort] = useState("default");

  useEffect(() => {
    let alive = true;
    setSourceLoading(true);
    Promise.allSettled([getMyHoldings(), getYouTubeOpinionDashboard({ limit: 1 })]).then(([portfolio, creators]) => {
      if (!alive) return;
      setHoldings(portfolio.status === "fulfilled" ? [...new Set(portfolio.value.accounts.flatMap((account) => account.portfolio_positions || []).filter((position) => position.position_type !== "option").map((position) => position.symbol.trim().toUpperCase()))] : []);
      setCoverage(creators.status === "fulfilled" ? creators.value.stocks.map((stock) => stock.ticker) : []);
      setSourceErrors([...(portfolio.status === "rejected" ? ["holdings" as const] : []), ...(creators.status === "rejected" ? ["creators" as const] : [])]);
      setSourceLoading(false);
    });
    return () => { alive = false; };
  }, [attempt]);

  const symbols = universe === "holdings" ? holdings : universe === "creators" ? coverage : DEFAULT_STOCKS;
  const symbolsKey = symbols.join(",");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);
    setCheckedAt(null);
    setQuotes({});
    async function load() {
      const requested = [...new Set([...BENCHMARKS.map((item) => item.symbol), ...symbolsKey.split(",").filter(Boolean)])];
      const result: Record<string, StockQuote> = {};
      let unavailable = false;
      // Bound each request so large portfolios do not create an unbounded batch.
      for (let offset = 0; offset < requested.length; offset += 20) {
        const batch = requested.slice(offset, offset + 20);
        try {
          const response = await fetch(`/api/stocks?action=multiple&symbols=${encodeURIComponent(batch.join(","))}`, { signal: controller.signal });
          const data: unknown = await response.json();
          if (!response.ok || !Array.isArray(data)) throw new Error("Quotes unavailable");
          for (const quote of data as StockQuote[]) {
            if (batch.includes(quote.symbol) && Number.isFinite(quote.price) && quote.price > 0) result[quote.symbol] = quote;
          }
          if (batch.some((symbol) => !result[symbol])) unavailable = true;
        } catch {
          if (controller.signal.aborted) return;
          unavailable = true;
        }
      }
      if (!controller.signal.aborted) {
        setQuotes(result);
        setFailed(unavailable);
        setCheckedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [symbolsKey, attempt]);

  const context = JSON.stringify({ workspace: "Markets", universe, quotes, quotesUnavailable: failed });
  useEffect(() => { setContext(context); return () => setContext(""); }, [context, setContext]);
  const visible = [...symbols].sort((a, b) => {
    if (sort === "default") return 0;
    const left = quotes[a]?.changePercent;
    const right = quotes[b]?.changePercent;
    const leftValid = typeof left === "number" && Number.isFinite(left);
    const rightValid = typeof right === "number" && Number.isFinite(right);
    if (!leftValid || !rightValid) return leftValid ? -1 : rightValid ? 1 : 0;
    return sort === "gainers" ? right - left : left - right;
  });

  return (
    <DashboardLayout title={c("Markets", "行情")} headerActions={<Button size="sm" variant="ghost" disabled={loading || sourceLoading} onClick={() => setAttempt((n) => n + 1)}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "motion-safe:animate-spin" : ""}`} />{c("Refresh", "刷新")}</Button>}>
      <main className={`${styles.page} flex-1 overflow-y-auto`}>
        <div className={`${styles.content} mx-auto max-w-[1200px] space-y-8 px-4 py-8 md:px-8`}>
          <section className={`${styles.hero} space-y-4`}>
            <div className={styles.scan} aria-hidden="true" />
            <h1 className="text-3xl font-semibold tracking-tight">{c("Markets & stocks", "行情与股票")}</h1>
            <TickerSearch />
            <p className="text-xs text-muted-foreground">{c("Quotes may be delayed. Refresh to check the latest available data.", "报价可能延迟，刷新查看最新可用数据。")}{checkedAt && ` ${c("Last checked", "最近查询")}: ${checkedAt}`}</p>
          </section>
          <section aria-label={c("Market benchmark ETFs", "市场参考 ETF")} className="grid gap-3 sm:grid-cols-3">
            {BENCHMARKS.map((item) => <Link key={item.symbol} href={`/dashboard/research/${item.symbol}`} className={`${styles.opinionCard} flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-4`}>
              <div className="flex items-center gap-3"><span aria-hidden="true"><CompanyLogo symbol={item.symbol} size="sm" /></span><div><p className="font-semibold">{item.symbol}</p><p className="text-xs text-muted-foreground">{c(item.en, item.zh)}</p></div></div>
              <div className="text-right text-sm"><p className="font-medium tabular-nums">{money(quotes[item.symbol]?.price)}</p><Change quote={quotes[item.symbol]} /></div>
            </Link>)}
          </section>
          <section className="space-y-4" aria-busy={loading || sourceLoading}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2" role="group" aria-label={c("Stock lists", "股票列表")}>
                {([{ key: "featured", en: "Selected stocks", zh: "精选股票" }, { key: "holdings", en: "My holdings", zh: "我的持仓" }, { key: "creators", en: "Creator coverage", zh: "创作者覆盖" }] as const).map((item) => <Button key={item.key} size="sm" variant={universe === item.key ? "default" : "outline"} aria-pressed={universe === item.key} onClick={() => setUniverse(item.key)}>{c(item.en, item.zh)}</Button>)}
              </div>
              <select aria-label={c("Sort stocks", "股票排序")} value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="default">{c("Default order", "默认排序")}</option><option value="gainers">{c("Change: highest first", "涨幅优先")}</option><option value="losers">{c("Change: lowest first", "跌幅优先")}</option>
              </select>
            </div>
            {loading && <p role="status" className={styles.loading}><span className={styles.loadingDot} aria-hidden="true" /><span className="text-sm text-muted-foreground">{c("Loading quotes…", "正在加载报价…")}</span></p>}
            {failed && <p role="status" className="text-sm text-muted-foreground">{c("Some quotes are unavailable. Refresh to retry.", "部分报价暂不可用，请刷新重试。")}</p>}
            {sourceErrors.includes(universe) && <p role="alert" className="text-sm text-muted-foreground">{c("This stock list could not be loaded. Refresh to retry.", "暂时无法加载该股票列表，请刷新重试。")}</p>}
            <div className="divide-y divide-border rounded-xl border border-border bg-background px-4">
              <div className="grid grid-cols-[minmax(0,1fr)_90px_85px] gap-3 py-3 text-xs text-muted-foreground sm:grid-cols-[minmax(0,1fr)_120px_100px]"><span>{c("Stock", "股票")}</span><span className="text-right">{c("Price (USD)", "价格（美元）")}</span><span className="text-right">{c("Change", "涨跌幅")}</span></div>
              {visible.map((symbol) => <Link key={symbol} href={`/dashboard/research/${encodeURIComponent(symbol)}`} className={`${styles.stockRow} grid grid-cols-[minmax(0,1fr)_90px_85px] items-center gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_120px_100px]`}>
                <div className="flex min-w-0 items-center gap-3"><span aria-hidden="true"><CompanyLogo symbol={symbol} size="sm" /></span><div className="min-w-0"><p className="font-semibold">{symbol}</p><p className="truncate text-xs text-muted-foreground">{quotes[symbol]?.name || "—"}</p></div></div>
                <span className="text-right text-sm font-medium tabular-nums">{money(quotes[symbol]?.price)}</span><span className="text-right text-sm"><Change quote={quotes[symbol]} /></span>
              </Link>)}
              {!visible.length && !sourceLoading && !sourceErrors.includes(universe) && <Empty>{universe === "holdings" ? c("Connect an account in Portfolio to see your stocks here.", "在持仓页连接账户后，这里会显示你持有的股票。") : c("No creator coverage yet.", "暂时没有创作者覆盖的股票。")}</Empty>}
            </div>
            <p className="text-xs text-muted-foreground">{c("Sorting applies to the selected list, not the entire market.", "涨跌排序仅针对当前列表，并非全市场排行。")}</p>
          </section>
        </div>
      </main>
    </DashboardLayout>
  );
}
