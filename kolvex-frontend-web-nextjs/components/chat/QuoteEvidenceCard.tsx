"use client";

import { useId, useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { QuoteEvidence } from "@/lib/chatApi";
import { cn } from "@/lib/utils";

/**
 * 行情证据分组：默认收起成一行摘要（标题 · 数量 · 代码 价格），点击展开看完整卡片。
 */
export function QuoteEvidenceGroup({ quotes }: { quotes: QuoteEvidence[] }) {
  const { locale, t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const formatLocale = locale === "zh" ? "zh-CN" : "en-US";
  const priceFormat = new Intl.NumberFormat(formatLocale, { maximumFractionDigits: 20 });

  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/60"
      >
        <span className="shrink-0 font-medium">
          {t("chat.quoteEvidence.title")} · {quotes.length}
        </span>
        <span className="min-w-0 flex-1 truncate tabular-nums text-foreground/80">
          {quotes.map((quote) => `${quote.symbol} ${priceFormat.format(quote.price)}`).join(" · ")}
        </span>
        <span className="sr-only">
          {expanded ? t("chat.quoteEvidence.collapse") : t("chat.quoteEvidence.expandAll")}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3.5 shrink-0 transition-transform", expanded && "rotate-180")}
        />
      </button>
      {expanded && (
        <div id={panelId} className="grid gap-2">
          {quotes.map((quote) => (
            <QuoteEvidenceCard key={quote.symbol} quote={quote} />
          ))}
        </div>
      )}
    </div>
  );
}

export function QuoteEvidenceCard({ quote }: { quote: QuoteEvidence }) {
  const { locale, t } = useTranslation();
  const formatLocale = locale === "zh" ? "zh-CN" : "en-US";
  const price = new Intl.NumberFormat(formatLocale, { maximumFractionDigits: 20 }).format(
    quote.price,
  );
  const quotedAt = quote.quoted_at ? new Date(quote.quoted_at) : null;

  return (
    <figure className="rounded-2xl border border-border bg-card px-3.5 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <span className="break-all text-sm font-semibold text-foreground">{quote.symbol}</span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {price}{" "}
          <span className="text-xs font-medium text-muted-foreground">
            {quote.currency ?? t("chat.quoteEvidence.unknownCurrency")}
          </span>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
        {quotedAt ? (
          <time dateTime={quote.quoted_at ?? undefined}>
            {new Intl.DateTimeFormat(formatLocale, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZone: "UTC",
              timeZoneName: "short",
            }).format(quotedAt)}
          </time>
        ) : (
          <span>{t("chat.quoteEvidence.unknownTime")}</span>
        )}
        <a
          href={`https://finance.yahoo.com/quote/${encodeURIComponent(quote.symbol)}/`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-foreground/60"
          aria-label={t("chat.quoteEvidence.openSource", { symbol: quote.symbol })}
        >
          {quote.source}
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </a>
      </div>
    </figure>
  );
}
