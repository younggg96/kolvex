/**
 * Advanced K-line chart preferences (the chart's ⚙ settings dialog). Pure data + helpers so the
 * parsing, session classification and candle paint rules can be tested without a browser.
 * Colours are design tokens from `app/globals.css`, never raw hex.
 */

/** Tokens a candle part may be painted with; each maps to `rgb(var(--<token>))`. */
export const CHART_COLOR_TOKENS = [
  "chart-up",
  "chart-down",
  "compare-1",
  "compare-2",
  "compare-3",
  "compare-4",
  "compare-5",
  "compare-6",
  "foreground",
  "muted-foreground",
] as const;
export type ChartColorToken = (typeof CHART_COLOR_TOKENS)[number];

export type CandlePart = "body" | "border" | "wick";
export const CANDLE_PARTS: CandlePart[] = ["body", "border", "wick"];
export type CandlePaint = { enabled: boolean; up: ChartColorToken; down: ChartColorToken };

export type ZoomAnchor = "cursor" | "right";
export type CrosshairSnap = "off" | "close" | "ohlc";

export interface ChartSettings {
  zoomAnchor: ZoomAnchor;
  crosshairSnap: CrosshairSnap;
  /** Intraday intervals load pre-market and after-hours bars. */
  extendedHours: boolean;
  /** Shade the pre-market / after-hours bars so the regular session stands out. */
  highlightSession: boolean;
  candles: Record<CandlePart, CandlePaint>;
}

export const CHART_SETTINGS_KEY = "kolvex:chart-settings";

export const DEFAULT_CHART_SETTINGS: ChartSettings = {
  zoomAnchor: "cursor",
  crosshairSnap: "off",
  extendedHours: true,
  highlightSession: true,
  candles: {
    body: { enabled: true, up: "chart-up", down: "chart-down" },
    border: { enabled: true, up: "chart-up", down: "chart-down" },
    wick: { enabled: true, up: "chart-up", down: "chart-down" },
  },
};

const isToken = (value: unknown): value is ChartColorToken =>
  typeof value === "string" && (CHART_COLOR_TOKENS as readonly string[]).includes(value);

/** Accepts anything (stored JSON) and returns complete, valid settings; unknown values fall back. */
export function parseChartSettings(raw: unknown): ChartSettings {
  const base = DEFAULT_CHART_SETTINGS;
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Record<string, unknown>;
  const candlesRaw = (
    value.candles && typeof value.candles === "object" ? value.candles : {}
  ) as Record<string, unknown>;
  const candles = {} as Record<CandlePart, CandlePaint>;
  for (const part of CANDLE_PARTS) {
    const item = (
      candlesRaw[part] && typeof candlesRaw[part] === "object" ? candlesRaw[part] : {}
    ) as Record<string, unknown>;
    candles[part] = {
      enabled: typeof item.enabled === "boolean" ? item.enabled : base.candles[part].enabled,
      up: isToken(item.up) ? item.up : base.candles[part].up,
      down: isToken(item.down) ? item.down : base.candles[part].down,
    };
  }
  return {
    zoomAnchor:
      value.zoomAnchor === "cursor" || value.zoomAnchor === "right"
        ? value.zoomAnchor
        : base.zoomAnchor,
    crosshairSnap:
      value.crosshairSnap === "off" ||
      value.crosshairSnap === "close" ||
      value.crosshairSnap === "ohlc"
        ? value.crosshairSnap
        : base.crosshairSnap,
    extendedHours:
      typeof value.extendedHours === "boolean" ? value.extendedHours : base.extendedHours,
    highlightSession:
      typeof value.highlightSession === "boolean" ? value.highlightSession : base.highlightSession,
    candles,
  };
}

export function readChartSettings(): ChartSettings {
  try {
    return parseChartSettings(
      JSON.parse(window.localStorage.getItem(CHART_SETTINGS_KEY) || "null"),
    );
  } catch {
    return DEFAULT_CHART_SETTINGS;
  }
}

export function writeChartSettings(settings: ChartSettings) {
  try {
    window.localStorage.setItem(CHART_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* Session-only preference when storage is unavailable. */
  }
}

export const tokenColor = (token: ChartColorToken) => `rgb(var(--${token}))`;

/**
 * How one candle is painted. A part that is switched off falls back so the candle stays visible:
 * no body → hollow candle; no border → body edge only; no wick → neutral wick; body and border
 * both off → a neutral outline.
 */
export function candlePaint(settings: ChartSettings, up: boolean) {
  const { body, border, wick } = settings.candles;
  const side = up ? "up" : "down";
  const neutral = tokenColor("muted-foreground");
  return {
    fill: body.enabled ? tokenColor(body[side]) : "none",
    stroke: border.enabled ? tokenColor(border[side]) : body.enabled ? "none" : neutral,
    wick: wick.enabled ? tokenColor(wick[side]) : neutral,
  };
}

/** Minutes of a bar interval, or null for daily and longer bars. */
export function intervalMinutes(interval: string): number | null {
  const match = /^(\d+)(m|h)$/.exec(interval);
  if (!match) return null;
  return Number(match[1]) * (match[2] === "h" ? 60 : 1);
}

export type TradingSession = "pre" | "regular" | "post" | "overnight";
const REGULAR_OPEN = 9 * 60 + 30;
const REGULAR_CLOSE = 16 * 60;

/**
 * Session of an intraday bar from its exchange-local ISO time ("2026-11-18T07:15:00-05:00").
 * A bar that overlaps the regular session counts as regular.
 */
export function barSession(date: string, interval: string): TradingSession {
  const minutes = intervalMinutes(interval);
  const time = /T(\d{2}):(\d{2})/.exec(date);
  if (minutes === null || !time) return "regular";
  const start = Number(time[1]) * 60 + Number(time[2]);
  if (start + minutes <= REGULAR_OPEN) return "pre";
  if (start >= REGULAR_CLOSE) return "post";
  return "regular";
}

/** Contiguous runs of extended-hours bars in `[first, last]`, for the session shading. */
export function extendedRuns(
  dates: string[],
  interval: string,
  first: number,
  last: number,
  sessions?: Array<"overnight" | null | undefined>,
): Array<{ start: number; end: number; session: Exclude<TradingSession, "regular"> }> {
  const runs: Array<{ start: number; end: number; session: Exclude<TradingSession, "regular"> }> =
    [];
  for (let index = Math.max(first, 0); index <= Math.min(last, dates.length - 1); index++) {
    const session = sessions?.[index] ?? barSession(dates[index], interval);
    if (session === "regular") continue;
    const previous = runs[runs.length - 1];
    if (previous && previous.session === session && previous.end === index - 1)
      previous.end = index;
    else runs.push({ start: index, end: index, session });
  }
  return runs;
}

/** Price the crosshair sits on: the pointer's own price, the close, or the nearest of OHLC. */
export function snapCrosshair(
  snap: CrosshairSnap,
  bar: { open: number; high: number; low: number; close: number },
  pointerY: number,
  yOf: (price: number) => number,
): number | null {
  if (snap === "off") return null;
  if (snap === "close") return bar.close;
  return [bar.open, bar.high, bar.low, bar.close].reduce((best, value) =>
    Math.abs(yOf(value) - pointerY) < Math.abs(yOf(best) - pointerY) ? value : best,
  );
}
