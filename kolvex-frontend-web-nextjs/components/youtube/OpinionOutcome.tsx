"use client";

import Link from "next/link";
import { InfoTip } from "@/components/ui/info-tip";
import { outcomeRows, type OpinionOutcome, type OutcomeTone } from "@/lib/opinionOutcome";

const toneClass: Record<OutcomeTone, string> = {
  positive: "text-positive",
  negative: "text-negative",
  flat: "text-foreground",
};

/** One quiet line under an opinion: how the stock moved after the video, next to the benchmark. */
export default function OpinionOutcomeLine({
  outcome,
  horizons,
  benchmark,
  t,
}: {
  /** "unavailable" when prices could not be loaded; undefined while loading (renders nothing). */
  outcome?: OpinionOutcome | "unavailable";
  horizons: number[];
  benchmark: string;
  t: (key: string, params?: Record<string, string>) => string;
}) {
  if (!outcome) return null;
  const rows = outcome === "unavailable" ? [] : outcomeRows(outcome, horizons);
  const note =
    outcome === "unavailable"
      ? t("youtubeOpinions.outcomeUnavailable")
      : outcome.status === "no_price_data"
        ? t("youtubeOpinions.outcomeNoPrices")
        : outcome.status === "no_publish_time"
          ? t("youtubeOpinions.outcomeNoPublishTime")
          : rows.length === 0
            ? t("youtubeOpinions.outcomeNotStarted")
            : null;
  if (note) {
    return <p className="mt-3 text-xs leading-5 text-muted-foreground">{note}</p>;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs leading-5 text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        {t("youtubeOpinions.outcomeLabel")}
        <InfoTip label={t("youtubeOpinions.outcomeHowLabel")}>
          {t("youtubeOpinions.outcomeHow", { benchmark })}
          <Link
            href="/dashboard/youtube-opinions/review"
            className="mt-2 block font-medium text-foreground underline underline-offset-4"
          >
            {t("youtubeOpinions.review.seeAll")}
          </Link>
        </InfoTip>
      </span>
      {rows.map((row) => (
        <span key={`${row.kind}:${row.days}`}>
          {t(
            row.kind === "toDate" ? "youtubeOpinions.outcomeToDate" : "youtubeOpinions.outcomeDays",
            { days: String(row.days) },
          )}{" "}
          <span className={`font-medium tabular-nums ${toneClass[row.tone]}`}>{row.stock}</span>
          {row.benchmark !== null && (
            <span className="tabular-nums">
              {" "}
              {t("youtubeOpinions.outcomeBenchmark", { benchmark, value: row.benchmark })}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
