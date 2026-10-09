import type { AiTechnicalAnalysis } from "@/lib/stockApi";
import type { Drawing } from "./chartDrawings";
/** Stable coordinates are derived from the immutable analysis, never from today's bars. */
export function analysisDrawings(result: AiTechnicalAnalysis, t: (key: string) => string): Drawing[] {
  const prefix = `ai-${result.version_id || result.generated_at}`;
  return [
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
