// Ported from the Web's components/youtube/aiDrawings.ts: the same IDs, layers and priorities.
import type {
  AiTechnicalAnalysis,
  Drawing,
  DrawingGroup,
} from "./technicalTypes";

/** Theme colour tokens the chart resolves at paint time. */
export const LEVEL = "rgb(var(--chart-level))";
export const UP = "rgb(var(--chart-up))";
export const DOWN = "rgb(var(--chart-down))";

const prefixFor = (result: AiTechnicalAnalysis) =>
  `ai-${result.version_id || result.generated_at}`;

/** The single execution plan comes from the written analysis (入场 / 止损 / 目标). */
export function planDrawings(result: AiTechnicalAnalysis): Drawing[] {
  const plan = result.setup;
  if (!plan) return [];
  const prefix = `${prefixFor(result)}-plan`;
  const time = Date.parse(result.view.end);
  return [
    {
      id: `${prefix}-entry`,
      type: "hline",
      points: [{ time, price: (plan.entry_low + plan.entry_high) / 2 }],
      color: LEVEL,
      label: "入场",
      source: "ai",
      group: "plan",
      priority: 90,
    },
    {
      id: `${prefix}-stop`,
      type: "hline",
      points: [{ time, price: plan.invalidation }],
      color: DOWN,
      label: "止损",
      source: "ai",
      group: "plan",
      priority: 95,
    },
    ...plan.targets.map((price, index): Drawing => ({
      id: `${prefix}-target-${index}`,
      type: "hline",
      points: [{ time, price }],
      color: UP,
      label: `目标 ${index + 1}`,
      source: "ai",
      group: "plan",
      priority: 85 - index,
    })),
  ];
}

type Overlay = NonNullable<AiTechnicalAnalysis["overlays"]>[number];

const OVERLAY_GROUPS: Partial<Record<Overlay["category"], DrawingGroup>> = {
  supply_demand: "zones",
  gaps: "zones",
  volume_profile: "levels",
  anchored_vwap: "trend",
  channels: "trend",
  pitchfork: "trend",
} as Partial<Record<Overlay["category"], DrawingGroup>>;

function overlayType(shape: Overlay["shape"], count: number): Drawing["type"] {
  if (shape === "area") return "rect";
  if (shape === "channel" || shape === "pitchfork") return shape;
  return count > 2 ? "polyline" : "trend";
}

function overlayColor(item: Overlay) {
  if ((item.category as string) === "moving_averages")
    return item.label === "EMA20"
      ? "rgb(168 85 247)"
      : item.label === "EMA50"
        ? "rgb(59 130 246)"
        : "rgb(125 175 205)";
  if ((item.category as string) === "anchored_vwap") return "rgb(20 184 166)";
  if ((item.category as string) === "volume_profile") return LEVEL;
  return item.direction === "bullish"
    ? UP
    : item.direction === "bearish"
      ? DOWN
      : LEVEL;
}

/** Saved chart annotations: levels, trend lines, Fibonacci and computed overlays. */
export function analysisDrawings(result: AiTechnicalAnalysis): Drawing[] {
  const prefix = prefixFor(result);
  const end = Date.parse(result.view.end);
  return [
    ...(result.overlays ?? [])
      .filter(
        (item) =>
          item.points.length >=
          (item.shape === "channel" || item.shape === "pitchfork" ? 3 : 2),
      )
      .map((item, index): Drawing => ({
        id: `${prefix}-overlay-${index}`,
        type: overlayType(item.shape, item.points.length),
        points: item.points.map((p) => ({
          time: Date.parse(p.date),
          price: p.price,
        })),
        color: overlayColor(item),
        label: item.label,
        source: "ai",
        group: OVERLAY_GROUPS[item.category] ?? "pattern",
        priority: 30,
      })),
    ...result.levels.map((level, index): Drawing => ({
      id: `${prefix}-level-${index}`,
      type: "hline",
      points: [{ time: end, price: level.price }],
      color: level.kind === "support" ? UP : DOWN,
      label: level.kind === "support" ? "支撑" : "阻力",
      source: "ai",
      group: "levels",
      priority: 60,
    })),
    ...result.trendlines.map((line, index): Drawing => ({
      id: `${prefix}-line-${index}`,
      type: "ray",
      points: [
        { time: Date.parse(line.start.date), price: line.start.price },
        { time: Date.parse(line.end.date), price: line.end.price },
      ],
      color: line.kind === "support" ? UP : DOWN,
      label: line.kind === "support" ? "趋势支撑线" : "趋势阻力线",
      source: "ai",
      group: "trend",
      priority: 50,
    })),
    ...(result.fib
      ? [
          {
            id: `${prefix}-fib`,
            type: "fib" as const,
            points: [
              {
                time: Date.parse(result.fib.from.date),
                price: result.fib.from.price,
              },
              {
                time: Date.parse(result.fib.to.date),
                price: result.fib.to.price,
              },
            ],
            color: LEVEL,
            source: "ai" as const,
            group: "fib" as const,
            priority: 40,
          },
        ]
      : []),
  ];
}
