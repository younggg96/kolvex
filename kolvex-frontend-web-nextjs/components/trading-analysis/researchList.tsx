import { ListColumnHeader, listRowTargetClass } from "@/components/ui/list-card";
import { cn } from "@/lib/utils";

export type ResearchListMode = "all" | "technical" | "planned";
type Translate = (key: string, params?: Record<string, string>) => string;

/** Header and rows share one template so every column lines up regardless of value width. */
export const researchGridClass = "grid items-center gap-x-4 grid-cols-[minmax(0,1fr)_auto_1rem] sm:grid-cols-[minmax(0,1fr)_6.5rem_7.5rem_1rem]";
export const planGridClass = "grid items-center gap-x-4 grid-cols-[minmax(0,1fr)_auto_1rem] sm:grid-cols-[minmax(0,1fr)_5.5rem_5.5rem_7.5rem_1rem] min-[1400px]:grid-cols-[minmax(0,1.2fr)_5.5rem_minmax(8.5rem,1fr)_4.5rem_minmax(8.5rem,1fr)_5.5rem_7.5rem_1rem]";

/** Summary of a stock disclosure: canonical row target with the neutral wash. */
export const researchSummaryClass = cn(
  listRowTargetClass,
  "cursor-pointer list-none transition-colors hover:bg-foreground/[0.06] active:bg-foreground/[0.1] motion-reduce:transition-none [&::-webkit-details-marker]:hidden",
);

export function ResearchColumnHeader({ mode, t }: { mode: ResearchListMode; t: Translate }) {
  const key = "tradingAnalysis.explore";
  const plan = "youtubeOpinions.ai.tradePlan";
  if (mode === "planned") {
    return (
      <ListColumnHeader className={cn(planGridClass, "whitespace-nowrap px-2 pb-2")}>
        <span>{t(`${key}.colStock`)}</span>
        <span className="hidden sm:block">{t(`${key}.colDirection`)}</span>
        <span className="hidden min-[1400px]:block">{t(`${plan}.entry`)}</span>
        <span className="hidden text-right min-[1400px]:block">{t(`${plan}.stop`)}</span>
        <span className="hidden text-right min-[1400px]:block">{t(`${plan}.target`)}</span>
        <span className="text-right">{t(`${plan}.ratio`)}</span>
        <span className="hidden text-right sm:block">{t(`${key}.colDate`)}</span>
        <span />
      </ListColumnHeader>
    );
  }
  return (
    <ListColumnHeader className={cn(researchGridClass, "whitespace-nowrap px-2 pb-2")}>
      <span>{t(`${key}.colStock`)}</span>
      <span className="text-right sm:text-left">{t(mode === "all" ? `${key}.latestDecision` : `${key}.colDirection`)}</span>
      <span className="hidden text-right sm:block">{t(`${key}.colDate`)}</span>
      <span />
    </ListColumnHeader>
  );
}
