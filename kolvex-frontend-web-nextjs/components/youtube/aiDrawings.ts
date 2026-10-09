import type { AiTechnicalAnalysis } from "@/lib/stockApi";
import type { Drawing } from "./chartDrawings";
/** Stable coordinates are derived from the immutable analysis, never from today's bars. */
export function analysisDrawings(result: AiTechnicalAnalysis, t: (key: string) => string): Drawing[] {
  const prefix = `ai-${result.version_id || result.generated_at}`;
  const plan = result.setup;
  const entry = plan ? (plan.entry_low + plan.entry_high) / 2 : 0;
  const planLines: Drawing[] = plan ? [
    { id: `${prefix}-entry`, type: "hline", points: [{ time: Date.parse(result.view.end), price: entry }],
      color: "rgb(var(--chart-level))", label: t("youtubeOpinions.ai.tradePlan.entryPoint"), source: "ai" },
    { id: `${prefix}-stop`, type: "hline", points: [{ time: Date.parse(result.view.end), price: plan.invalidation }],
      color: "rgb(var(--chart-down))", label: t("youtubeOpinions.ai.tradePlan.stop"), source: "ai" },
    ...plan.targets.map((price, index): Drawing => ({
      id: `${prefix}-target-${index}`, type: "hline", points: [{ time: Date.parse(result.view.end), price }],
      color: "rgb(var(--chart-up))",
      label: `${t("youtubeOpinions.ai.tradePlan.target")} ${index + 1}${index === 0 ? ` · ${t("youtubeOpinions.ai.tradePlan.ratio")} ${plan.risk_reward.toFixed(2)} : 1` : ""}`,
      source: "ai",
    })),
  ] : [];
  return [
    ...planLines,
    ...(result.overlays ?? []).filter(item => item.points.length >= 2).map((item, index) => ({
      id: `${prefix}-overlay-${index}`,
      type: item.shape === "area" ? "rect" as const : item.points.length > 2 ? "polyline" as const : "trend" as const,
      points: item.points.map(point => ({ time: Date.parse(point.date), price: point.price })),
      color: item.category === "moving_averages" ? (item.label === "EMA20" ? "rgb(168 85 247)" : item.label === "EMA50" ? "rgb(59 130 246)" : "rgb(125 175 205)")
        : item.direction === "bullish" ? "rgb(var(--chart-up))" : item.direction === "bearish" ? "rgb(var(--chart-down))" : "rgb(var(--chart-level))",
      label: item.label, source: "ai" as const,
    })),
    ...result.levels.map((level, index) => ({
      id: `${prefix}-level-${index}`, type: "hline" as const,
      points: [{ time: Date.parse(result.view.end), price: level.price }],
      color: level.kind === "support" ? "rgb(var(--chart-up))" : "rgb(var(--chart-down))",
      label: t(`youtubeOpinions.ai.${level.kind}`), source: "ai" as const,
    })),
    ...result.trendlines.map((line, index) => ({
      id: `${prefix}-line-${index}`, type: "ray" as const,
      points: [{ time: Date.parse(line.start.date), price: line.start.price }, { time: Date.parse(line.end.date), price: line.end.price }],
      color: line.kind === "support" ? "rgb(var(--chart-up))" : "rgb(var(--chart-down))",
      label: t(`youtubeOpinions.ai.${line.kind}Line`), source: "ai" as const,
    })),
    ...(result.fib ? [{ id: `${prefix}-fib`, type: "fib" as const,
      points: [{ time: Date.parse(result.fib.from.date), price: result.fib.from.price }, { time: Date.parse(result.fib.to.date), price: result.fib.to.price }],
      color: "rgb(var(--chart-level))", source: "ai" as const }] : []),
  ];
}
