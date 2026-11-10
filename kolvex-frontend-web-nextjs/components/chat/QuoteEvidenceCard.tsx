"use client";

import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { QuoteEvidence } from "@/lib/chatApi";

export function QuoteEvidenceCard({ quote }: { quote: QuoteEvidence }) {
  const { locale, t } = useTranslation();
  const formatLocale = locale === "zh" ? "zh-CN" : "en-US";
  const price = new Intl.NumberFormat(formatLocale, { maximumFractionDigits: 20 }).format(quote.price);
  const quotedAt = quote.quoted_at ? new Date(quote.quoted_at) : null;

  return (
    <figure className="rounded-2xl border border-border bg-card px-3.5 py-3">
      <figcaption className="text-xs font-medium text-muted-foreground">
        {t("chat.quoteEvidence.title")}
      </figcaption>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
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
