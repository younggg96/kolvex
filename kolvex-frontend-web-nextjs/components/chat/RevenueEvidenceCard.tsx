"use client";

import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { RevenueEvidence } from "@/lib/chatApi";

export function RevenueEvidenceCard({ revenue }: { revenue: RevenueEvidence }) {
  const { locale, t } = useTranslation();
  const value = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    maximumFractionDigits: 20,
  }).format(revenue.value);

  return (
    <figure className="rounded-2xl border border-border bg-card px-3.5 py-3">
      <figcaption className="text-xs font-medium text-muted-foreground">
        {t("chat.revenueEvidence.title")} · {t(`chat.revenueEvidence.${revenue.period_kind}`)}
      </figcaption>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <span className="break-all text-sm font-semibold text-foreground">{revenue.symbol}</span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {value} <span className="text-xs font-medium text-muted-foreground">{revenue.currency}</span>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
        <dl className="space-y-1">
          <div className="flex flex-wrap gap-x-2">
            <dt>{t("chat.revenueEvidence.period")}</dt>
            <dd className="tabular-nums">{revenue.period_start} – {revenue.period_end}</dd>
          </div>
          {revenue.year_over_year_pct != null ? (
            <div className="flex flex-wrap gap-x-2">
              <dt>{t("chat.revenueEvidence.yoy")}</dt>
              <dd className="tabular-nums font-medium text-foreground">
                {revenue.year_over_year_pct > 0 ? "+" : ""}
                {revenue.year_over_year_pct}%
                {revenue.compared_period_end && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    {t("chat.revenueEvidence.comparedWith", { date: revenue.compared_period_end })}
                  </span>
                )}
              </dd>
            </div>
          ) : revenue.unavailable_reason ? (
            <div className="flex flex-wrap gap-x-2">
              <dt>{t("chat.revenueEvidence.yoy")}</dt>
              <dd>{t("chat.revenueEvidence.yoyUnavailable")}</dd>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-x-2">
            <dt>{t("chat.revenueEvidence.filed")}</dt>
            <dd className="tabular-nums"><time dateTime={revenue.filed_on}>{revenue.filed_on}</time></dd>
          </div>
        </dl>
        <a
          href={revenue.source_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-sm font-medium text-foreground underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-foreground/60"
          aria-label={t("chat.revenueEvidence.openSource", { symbol: revenue.symbol })}
        >
          SEC EDGAR
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </a>
      </div>
    </figure>
  );
}
