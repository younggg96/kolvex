"use client";

import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/hooks/useWatchlist";
import { normalizeWatchlistTicker } from "@/lib/watchlist";
import { useCopy } from "./shared";

export default function WatchlistButton({ ticker, showLabel = false, onRemoved }: { ticker: string; showLabel?: boolean; onRemoved?: () => void }) {
  const c = useCopy();
  const { watchlist, ready, toggle, storageUnavailable } = useWatchlist();
  const symbol = normalizeWatchlistTicker(ticker);
  if (!symbol) return null;
  const saved = watchlist.includes(symbol);
  const label = saved ? c(`Remove ${symbol} from Watchlist`, `将 ${symbol} 移出自选股`) : c(`Add ${symbol} to Watchlist`, `将 ${symbol} 加入自选股`);
  return <Button type="button" variant="ghost" size={showLabel ? "sm" : "icon"} className="min-h-11 min-w-11 shrink-0" disabled={!ready} aria-label={label} title={label} aria-pressed={saved} onClick={() => {
    const result = toggle(symbol);
    if (saved) onRemoved?.();
    if (result?.storageUnavailable) {
      toast(c("Updated for this session only. Browser storage is unavailable.", "已更新，但浏览器存储不可用，仅在本次会话保留。"));
      return;
    }
    toast(saved ? c(`${symbol} removed from Watchlist`, `已将 ${symbol} 移出自选股`) : c(`${symbol} added to Watchlist`, `已将 ${symbol} 加入自选股`));
  }}>
    <Star className={`h-4 w-4 ${saved ? "fill-current" : ""}`} aria-hidden="true" />
    {showLabel && <span className="hidden sm:inline">{saved ? c("Watching", "已加入自选") : c("Watch", "加入自选")}</span>}
    {showLabel && storageUnavailable && <span className="sr-only">{c("Saved for this session only", "仅在本次会话保存")}</span>}
  </Button>;
}
