"use client";

import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/hooks/useWatchlist";
import { normalizeWatchlistTicker } from "@/lib/watchlist";
import { useCopy } from "./shared";

export default function WatchlistButton({ ticker, showLabel = false, onRemoved }: { ticker: string; showLabel?: boolean; onRemoved?: () => void }) {
  const c = useCopy();
  const { watchlist, ready, pending, userId, error, toggle, refresh } = useWatchlist();
  const symbol = normalizeWatchlistTicker(ticker);
  if (!symbol) return null;
  const saved = watchlist.includes(symbol);
  const label = !userId && ready ? c("Sign in to save your Watchlist", "请登录后保存自选股") : error ? c("Retry Watchlist sync", "重试同步自选股") : saved ? c(`Remove ${symbol} from Watchlist`, `将 ${symbol} 移出自选股`) : c(`Add ${symbol} to Watchlist`, `将 ${symbol} 加入自选股`);
  return <Button type="button" variant="ghost" size={showLabel ? "sm" : "icon"} className="min-h-11 min-w-11 shrink-0" disabled={!ready || pending} aria-label={label} title={label} aria-pressed={saved} onClick={async () => {
    if (!userId || error === "auth") { toast.error(c("Sign in to save your Watchlist", "请登录后保存自选股")); return; }
    if (error) { await refresh(); return; }
    const success = await toggle(symbol);
    if (!success) { toast.error(c("Could not confirm the change. Retry sync.", "暂时无法确认修改结果，请重试同步。")); return; }
    if (saved) onRemoved?.();
    toast(saved ? c(`${symbol} removed from Watchlist`, `已将 ${symbol} 移出自选股`) : c(`${symbol} added to Watchlist`, `已将 ${symbol} 加入自选股`));
  }}>
    <Star className={`h-4 w-4 ${saved ? "fill-current" : ""}`} aria-hidden="true" />
    {showLabel && <span className="hidden sm:inline">{saved ? c("Watching", "已加入自选") : c("Watch", "加入自选")}</span>}
  </Button>;
}
