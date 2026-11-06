import { GanttChart, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

type Translate = (key: string, params?: Record<string, string>) => string;

export default function AiAnalysisEmptyState({ symbol, interval, disabled, modelReady, onAnalyze, t }: {
  symbol: string;
  interval: string;
  disabled: boolean;
  modelReady: boolean;
  onAnalyze: () => void;
  t: Translate;
}) {
  return (
    <section aria-label={t("youtubeOpinions.ai.title")} className="min-w-0 py-4 text-sm">
      <div className="flex min-w-0 flex-wrap items-center gap-4">
        <div className="flex min-w-0 flex-[1_1_24rem] items-start gap-4">
          <div className="min-w-0 max-w-2xl">
            <h3 className="text-balance text-lg font-semibold text-foreground">{t("youtubeOpinions.ai.empty.title")}</h3>
            <p className="mt-2 text-pretty leading-6 text-muted-foreground">{t("youtubeOpinions.ai.empty.description")}</p>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{symbol}</span>
              <span aria-hidden="true">·</span>
              <span>{t(`youtubeOpinions.intervals.${interval}`)}</span>
              <span aria-hidden="true">·</span>
              <span>{t("youtubeOpinions.ai.empty.visibleRange")}</span>
            </p>
          </div>
        </div>
        <Button type="button" disabled={disabled} onClick={onAnalyze}
          className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">
          <ScanSearch className="h-4 w-4" aria-hidden="true" />
          {t(modelReady ? "youtubeOpinions.ai.empty.start" : "youtubeOpinions.ai.empty.configure")}
        </Button>
      </div>
      <div className="mt-4 flex items-start gap-2 text-muted-foreground">
        <GanttChart className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="text-pretty text-xs leading-5">{t("youtubeOpinions.ai.empty.drawingHint")}</p>
      </div>
    </section>
  );
}
