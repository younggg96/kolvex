"use client";

import { cn } from "@/lib/utils";
import type { YouTubeOpinionSummary } from "@/lib/youtubeOpinionsApi";

export default function OpinionDistribution({
  summary,
  zh,
}: {
  summary: YouTubeOpinionSummary;
  zh: boolean;
}) {
  const total = summary.total_opinions;
  if (!total) return null;
  const mixed = Math.max(
    total - summary.bullish_count - summary.bearish_count - summary.neutral_count,
    0,
  );
  const rows = [
    { key: "bullish", label: zh ? "看涨" : "Bullish", count: summary.bullish_count, fill: "bg-positive-fill", text: "text-positive" },
    { key: "neutral", label: zh ? "中性" : "Neutral", count: summary.neutral_count, fill: "bg-foreground/40", text: "text-foreground" },
    ...(mixed ? [{ key: "mixed", label: zh ? "分歧" : "Mixed", count: mixed, fill: "bg-warning", text: "text-warning" }] : []),
    { key: "bearish", label: zh ? "看跌" : "Bearish", count: summary.bearish_count, fill: "bg-negative-fill", text: "text-negative" },
  ];
  const lead = rows.reduce((best, row) => (row.count > best.count ? row : best), rows[0]);
  const share = (count: number) => Math.round((count / total) * 100);

  return (
    <section className="grid gap-6 pt-6 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center">
      <div>
        <h2 className="text-lg font-semibold">{zh ? "博主观点分布" : "Creator opinions"}</h2>
        <p className={cn("figure mt-3 text-[32px] font-semibold leading-none", lead.text)}>
          {share(lead.count)}%
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {zh ? `${total} 条观点中为${lead.label}` : `of ${total} opinions are ${lead.label.toLowerCase()}`}
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
