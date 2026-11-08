import type { AiTechnicalAnalysis } from "@/lib/stockApi";
import type { Drawing, DrawingGroup } from "./chartDrawings";

/** Stable coordinates are derived from the immutable analysis, never from today's bars. */
function prefixFor(result: AiTechnicalAnalysis) {
  return `ai-${result.version_id || result.generated_at}`;
}

/**
 * The single execution plan comes from written technical analysis. Drawings only
 * annotate the chart, so a plan shown on the chart always matches the 条件计划 card.
 */
export function planDrawings(result: AiTechnicalAnalysis, t: (key: string) => string): Drawing[] {
  const plan = result.setup;
  if (!plan) return [];
  const prefix = `${prefixFor(result)}-plan`;
  const entry = (plan.entry_low + plan.entry_high) / 2;
  return [
    { id: `${prefix}-entry`, type: "hline", points: [{ time: Date.parse(result.view.end), price: entry }],
      color: "rgb(var(--chart-level))", label: t("youtubeOpinions.ai.tradePlan.entryPoint"), source: "ai", group: "plan", priority: 90 },
    { id: `${prefix}-stop`, type: "hline", points: [{ time: Date.parse(result.view.end), price: plan.invalidation }],
      color: "rgb(var(--chart-down))", label: t("youtubeOpinions.ai.tradePlan.stop"), source: "ai", group: "plan", priority: 95 },
    ...plan.targets.map((price, index): Drawing => ({
      id: `${prefix}-target-${index}`, type: "hline", points: [{ time: Date.parse(result.view.end), price }],
      color: "rgb(var(--chart-up))",
      label: `${t("youtubeOpinions.ai.tradePlan.target")} ${index + 1}`,
      source: "ai", group: "plan", priority: 85 - index,
    })),
  ];
}

type Overlay = NonNullable<AiTechnicalAnalysis["overlays"]>[number];

/** Computed overlays default to the pattern layer; these share a layer with what they behave like. */
const OVERLAY_GROUPS: Partial<Record<Overlay["category"], DrawingGroup>> = {
  supply_demand: "zones",
  gaps: "zones",
  volume_profile: "levels",
  anchored_vwap: "trend",
  channels: "trend",
  pitchfork: "trend",
};

function overlayType(shape: Overlay["shape"], count: number): Drawing["type"] {
  if (shape === "area") return "rect";
  if (shape === "channel" || shape === "pitchfork") return shape;
  return count > 2 ? "polyline" : "trend";
}

function overlayColor(item: Overlay) {
  if (item.category === "moving_averages") {
    return item.label === "EMA20" ? "rgb(168 85 247)" : item.label === "EMA50" ? "rgb(59 130 246)" : "rgb(125 175 205)";
  }
  if (item.category === "anchored_vwap") return "rgb(20 184 166)";
  if (item.category === "volume_profile") return "rgb(var(--chart-level))";
  return item.direction === "bullish" ? "rgb(var(--chart-up))" : item.direction === "bearish" ? "rgb(var(--chart-down))" : "rgb(var(--chart-level))";
}

/** Saved chart annotations: levels, trend lines, Fibonacci and computed overlays. */
export function analysisDrawings(result: AiTechnicalAnalysis, t: (key: string) => string): Drawing[] {
  const prefix = prefixFor(result);
  return [
    ...(result.overlays ?? []).filter(item => item.points.length >= ((item.shape === "channel" || item.shape === "pitchfork") ? 3 : 2)).map((item, index): Drawing => ({
      id: `${prefix}-overlay-${index}`,
      type: overlayType(item.shape, item.points.length),
      points: item.points.map(point => ({ time: Date.parse(point.date), price: point.price })),
      color: overlayColor(item),
      label: item.label, source: "ai", group: OVERLAY_GROUPS[item.category] ?? "pattern", priority: 30,
    })),
    ...result.levels.map((level, index) => ({
      id: `${prefix}-level-${index}`, type: "hline" as const,
      points: [{ time: Date.parse(result.view.end), price: level.price }],
      color: level.kind === "support" ? "rgb(var(--chart-up))" : "rgb(var(--chart-down))",
      label: t(`youtubeOpinions.ai.${level.kind}`), source: "ai" as const, group: "levels" as const, priority: 60,
    })),
    ...result.trendlines.map((line, index) => ({
      id: `${prefix}-line-${index}`, type: "ray" as const,
      points: [{ time: Date.parse(line.start.date), price: line.start.price }, { time: Date.parse(line.end.date), price: line.end.price }],
      color: line.kind === "support" ? "rgb(var(--chart-up))" : "rgb(var(--chart-down))",
      label: t(`youtubeOpinions.ai.${line.kind}Line`), source: "ai" as const, group: "trend" as const, priority: 50,
    })),
    ...(result.fib ? [{ id: `${prefix}-fib`, type: "fib" as const,
      points: [{ time: Date.parse(result.fib.from.date), price: result.fib.from.price }, { time: Date.parse(result.fib.to.date), price: result.fib.to.price }],
      color: "rgb(var(--chart-level))", source: "ai" as const, group: "fib" as const, priority: 40 }] : []),
  ];
}
