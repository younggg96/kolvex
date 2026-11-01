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
    // flex-col keeps the CTA intrinsic to its content; as a block child of a flex
    // column it would inherit align-self: stretch and span the whole panel.
    <section aria-label={t("youtubeOpinions.ai.title")} className="flex min-w-0 flex-col items-start py-8 text-sm">
      <ScanSearch className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
      <h3 className="mt-4 text-balance text-lg font-semibold text-foreground">{t("youtubeOpinions.ai.empty.title")}</h3>
      <p className="mt-2 self-stretch text-pretty leading-6 text-muted-foreground">{t("youtubeOpinions.ai.empty.description")}</p>
      <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{symbol}</span>
        <span aria-hidden="true">·</span>
        <span>{t(`youtubeOpinions.intervals.${interval}`)}</span>
        <span aria-hidden="true">·</span>
        <span>{t("youtubeOpinions.ai.empty.visibleRange")}</span>
      </p>
      <Button type="button" size="lg" disabled={disabled} onClick={onAnalyze}
        className="mt-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground">
        <ScanSearch className="h-4 w-4" aria-hidden="true" />
        {t(modelReady ? "youtubeOpinions.ai.empty.start" : "youtubeOpinions.ai.empty.configure")}
      </Button>
      <div className="mt-8 flex items-start gap-3 self-stretch text-muted-foreground">
        <GanttChart className="mt-1 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="text-pretty text-xs leading-5">{t("youtubeOpinions.ai.empty.drawingHint")}</p>
      </div>
    </section>
  );
}
