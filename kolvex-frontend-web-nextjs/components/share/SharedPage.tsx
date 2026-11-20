"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/decision/shared";
import { SHARE_KIND_LABELS, type ContentShare } from "@/lib/contentShare";
import { readShare } from "@/lib/contentShareApi";
import { SharedCard } from "./SharedCard";

/** The public page behind a share link. Signed-in-only shares unlock with the reader's session. */
export default function SharedPage({ share: initial }: { share: ContentShare }) {
  const c = useCopy();
  const [share, setShare] = useState(initial);
  const [checking, setChecking] = useState(initial.locked);

  useEffect(() => {
    if (!initial.locked) return;
    let cancelled = false;
    readShare(initial.id)
      .then((result) => !cancelled && setShare(result))
      .catch(() => undefined)
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [initial.id, initial.locked]);

  const ticker = share.card.tickers[0];
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      {share.locked ? (
        <section className="glass-card rounded-3xl border border-foreground/10 bg-card-glass p-6 text-center">
          <Lock className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <h1 className="mt-3 text-lg font-semibold">
            {c(...SHARE_KIND_LABELS[share.kind])}
            {share.card.title || ticker ? ` · ${share.card.title || ticker}` : ""}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {checking
              ? c("Checking your sign-in…", "正在确认登录状态…")
              : c("Options data is shown to signed-in users only.", "期权数据仅向登录用户展示。")}
          </p>
          {!checking && (
            <Button asChild className="mt-5">
              <Link href="/auth">{c("Sign in to read", "登录后查看")}</Link>
            </Button>
          )}
        </section>
      ) : (
        <SharedCard share={share} />
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{c("Shared from Kolvex", "来自 Kolvex 的分享")}</span>
        <Button asChild variant="outline" size="sm">
          <Link href={ticker ? `/stocks/${encodeURIComponent(ticker)}` : "/creators"}>
            {ticker
              ? c(`More on ${ticker}`, `查看 ${ticker} 的更多观点`)
              : c("Browse creator opinions", "浏览博主观点")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
