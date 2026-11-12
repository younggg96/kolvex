"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CompanyLogo from "@/components/ui/company-logo";
import { marketStockHref } from "@/lib/stockLinks";
import WatchlistButton from "./WatchlistButton";
import { useCopy } from "./shared";

type Suggestion = { symbol: string; name: string };

/** Autocomplete over every listed company; each row opens the quote page or toggles the Watchlist. */
export default function StockSearchSuggestions({ query, onPick }: { query: string; onPick?: () => void }) {
  const c = useCopy();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const q = query.trim();

  useEffect(() => {
    if (!q) { setItems([]); setState("idle"); return; }
    const controller = new AbortController();
    setState("loading");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("search");
        const data = await response.json() as { results?: Suggestion[] };
        setItems(Array.isArray(data.results) ? data.results : []);
        setState("idle");
      } catch (error) {
        if ((error as Error).name !== "AbortError") { setItems([]); setState("error"); }
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q]);

  if (!q) return null;
  return <div role="listbox" onMouseDown={event => event.preventDefault()} aria-label={c("Matching companies", "匹配的公司")} className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-foreground/10 bg-card p-1 shadow-lg">
    {state === "loading" && !items.length && <p className="px-3 py-3 text-sm text-muted-foreground">{c("Searching…", "搜索中…")}</p>}
    {state === "error" && <p className="px-3 py-3 text-sm text-muted-foreground">{c("Search unavailable. Try again.", "搜索暂不可用，请重试。")}</p>}
    {state === "idle" && !items.length && <p className="px-3 py-3 text-sm text-muted-foreground">{c("No matching company", "没有匹配的公司")}</p>}
    {items.map(item => <div key={item.symbol} role="option" aria-selected={false} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted/60">
      <Link href={marketStockHref(item.symbol)} onClick={onPick} className="flex min-w-0 flex-1 items-center gap-3 py-1">
        <span aria-hidden><CompanyLogo symbol={item.symbol} name={item.name} customSize={32} /></span>
        <span className="min-w-0"><span className="block text-sm font-semibold">{item.symbol}</span><span className="block truncate text-xs text-muted-foreground">{item.name}</span></span>
      </Link>
      <WatchlistButton ticker={item.symbol} />
    </div>)}
  </div>;
}
