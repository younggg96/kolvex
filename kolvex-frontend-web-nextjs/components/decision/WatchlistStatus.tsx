"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/hooks/useWatchlist";
import { useCopy } from "./shared";

/** Shared account/sync feedback for Watchlist and Reddit follows. */
export default function WatchlistStatus() {
  const c = useCopy();
  const { ready, userId, pending, error, refresh } = useWatchlist();
  if (!ready) return <p role="status" className="text-xs text-muted-foreground">{c("Loading your account Watchlist…", "正在加载账号自选股…")}</p>;
  if (!userId || error === "auth") return <p role="status" className="text-sm text-muted-foreground"><Link href="/auth?redirectTo=%2Fdashboard%2Fwatchlist" className="underline underline-offset-4">{c("Sign in to save and sync your Watchlist", "登录后保存自选股并跨设备同步")}</Link></p>;
  if (error) return <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-negative"><p>{error === "save" ? c("Change could not be confirmed. Refresh your Watchlist and try again.", "暂时无法确认是否保存成功，请刷新自选股后重试。") : error === "migration" ? c("Your browser Watchlist could not be imported. It is retained; retry to sync.", "浏览器自选股暂未导入，原数据已保留，请重试同步。") : c("Watchlist sync is unavailable. Retry to load your saved stocks.", "自选股同步暂不可用，请重试加载已保存的股票。")}</p><Button variant="outline" size="sm" onClick={() => void refresh()} disabled={pending}>{c("Retry sync", "重试同步")}</Button></div>;
  return <p role="status" className="text-xs text-muted-foreground">{pending ? c("Saving to your account…", "正在保存到账号…") : c("Saved to your account. Available on your other devices.", "自选股保存在账号中，可在其他设备登录查看。")}</p>;
}
