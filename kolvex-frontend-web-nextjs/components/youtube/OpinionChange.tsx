"use client";

import type { YouTubeDailyChange } from "@/lib/youtubeOpinionsApi";
import { formatOpinionDate } from "@/lib/opinionDates";
import { useTranslation } from "@/lib/i18n";
import OpinionStrength from "./OpinionStrength";

export default function OpinionChange({ value }: { value?: YouTubeDailyChange }) {
  const { t } = useTranslation();
  if (!value) return <span className="text-xs text-muted-foreground">{t("youtubeOpinions.directory.noChange")}</span>;
  const format = (day: string) => formatOpinionDate(day, t("common.intlLocale"));
  return <span className="flex min-w-0 flex-col items-start gap-1 text-xs">
    {value.change == null
      ? <span className="font-medium text-foreground">{t("youtubeOpinions.directory.firstCoverage")}</span>
      : <OpinionStrength value={value.change} change className="text-xs" />}
    <span className="text-muted-foreground">
      {value.previous_date
        ? t("youtubeOpinions.directory.comparison", { from: format(value.previous_date), to: format(value.current_date) })
        : format(value.current_date)}
    </span>
  </span>;
}
