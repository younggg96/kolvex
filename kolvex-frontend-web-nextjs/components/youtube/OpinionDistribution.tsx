"use client";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n";
import type { YouTubeOpinionSummary } from "@/lib/youtubeOpinionsApi";

export default function OpinionDistribution({
  summary,
  compact = false,
}: {
  summary: YouTubeOpinionSummary;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const total = summary.total_opinions;
  if (!total) return null;
  const mixed = Math.max(
    total - summary.bullish_count - summary.bearish_count - summary.neutral_count,
    0,
  );
  const rows = [
    { key: "bullish", label: t("youtubeOpinions.bullish"), count: summary.bullish_count, fill: "bg-positive-fill", text: "text-positive" },
    { key: "neutral", label: t("youtubeOpinions.neutral"), count: summary.neutral_count, fill: "bg-foreground/40", text: "text-foreground" },
    ...(mixed ? [{ key: "mixed", label: t("youtubeOpinions.mixed"), count: mixed, fill: "bg-warning", text: "text-warning" }] : []),
    { key: "bearish", label: t("youtubeOpinions.bearish"), count: summary.bearish_count, fill: "bg-negative-fill", text: "text-negative" },
  ];
  const lead = rows.reduce((best, row) => (row.count > best.count ? row : best), rows[0]);
  const share = (count: number) => Math.round((count / total) * 100);

  if (compact) {
    const present = rows.filter((row) => row.count > 0);
    return (
      <section className="min-w-0">
        <h2 className="text-sm font-semibold">{t("youtubeOpinions.distributionTitle")}</h2>
        <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          {present.map((row) => (
            <div key={row.key} className={row.fill} style={{ width: `${share(row.count)}%` }} />
          ))}
        </div>
        <dl className="mt-3 grid gap-1.5 text-[13px]">
          {present.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", row.fill)} />
                {row.label}
              </dt>
              <dd className="figure tabular-nums">
                <span className={cn("font-semibold", row.text)}>{share(row.count)}%</span>
                <span className="ml-2 text-muted-foreground">{row.count}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    );
  }

  return (
    <section className="grid gap-6 pt-6 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
      <div>
        <h2 className="text-lg font-semibold">{t("youtubeOpinions.distributionTitle")}</h2>
        <p className={cn("figure mt-3 text-[32px] font-semibold leading-none", lead.text)}>
          {share(lead.count)}%
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {t(`youtubeOpinions.distributionLead.${lead.key}`, { total: String(total) })}
        </p>
      </div>
      <dl className="grid gap-3">
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-3 text-sm">
            <dt className="text-muted-foreground">{row.label}</dt>
            <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div
                className={cn("h-full rounded-full", row.fill)}
                style={{ width: `${share(row.count)}%` }}
              />
            </div>
            <dd className="figure text-right font-medium">{share(row.count)}%</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
