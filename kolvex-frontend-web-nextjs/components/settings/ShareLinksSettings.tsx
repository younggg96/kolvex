"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SettingsGroup } from "@/components/ui/settings-group";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";
import { useTranslation } from "@/lib/i18n";
import { SHARE_KIND_LABELS, sharePath, type ShareListItem } from "@/lib/contentShare";
import { listShares, revokeShare } from "@/lib/contentShareApi";

/** The user's active share links; stopping one makes it stop opening for everyone. */
export function ShareLinksSettings({ className }: { className?: string }) {
  const c = useCopy();
  const { locale } = useTranslation();
  const [items, setItems] = useState<ShareListItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setItems((await listShares()).items);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function stop(id: string) {
    setPending(id);
    try {
      await revokeShare(id);
      setItems((current) => current?.filter((item) => item.id !== id) ?? null);
    } catch {
      setFailed(true);
    } finally {
      setPending(null);
      setConfirm(null);
    }
  }

  const date = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <SettingsGroup className={className} label={c("Share links", "我的分享")}>
      {failed ? (
        <div role="alert" className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {c("Share links could not be loaded.", "分享链接加载失败。")}
          </span>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            {c("Retry", "重试")}
          </Button>
        </div>
      ) : items === null ? (
        <p
          role="status"
          className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          {c("Loading…", "加载中…")}
        </p>
      ) : items.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">
          {c("You have not shared anything yet.", "还没有分享过内容。")}
        </p>
      ) : (
        <ul>
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0"
            >
              <Link
                href={sharePath(item.id)}
                target="_blank"
                className="min-w-0 flex-1 hover:underline"
              >
                <p className="truncate text-sm font-medium">
                  {item.title ||
                    item.summary ||
                    item.tickers.join(" · ") ||
                    c(...SHARE_KIND_LABELS[item.kind])}
                </p>
                <p className="text-xs text-muted-foreground">
                  {c(...SHARE_KIND_LABELS[item.kind])} · {date.format(new Date(item.created_at))}
                </p>
              </Link>
              {confirm === item.id ? (
                <span className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="xs" onClick={() => setConfirm(null)}>
                    {c("Keep", "保留")}
                  </Button>
                  <Button
                    variant="destructive"
                    size="xs"
                    disabled={pending === item.id}
                    onClick={() => void stop(item.id)}
                  >
                    {c("Stop sharing", "停止分享")}
                  </Button>
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="xs"
                  className="shrink-0 text-muted-foreground"
                  onClick={() => setConfirm(item.id)}
                >
                  {c("Stop sharing", "停止分享")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </SettingsGroup>
  );
}
