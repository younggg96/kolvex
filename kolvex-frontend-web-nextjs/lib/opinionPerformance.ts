import type { PriceBar } from "./stockApi";

/** The New York daily-session baseline applies to US equities/ETFs, not foreign sessions or FX/crypto. */
export function supportsOpinionPerformance(symbol: string) {
  return /^[A-Z][A-Z0-9]*(?:[.-][A-Z])?$/.test(symbol);
}

/** Conservative daily-bar baseline: next session's open, never pre-publication prices. */
export function opinionPerformance(bars: PriceBar[], publicationDay: string, today: string) {
  const sessions = bars.filter(bar => bar.date.slice(0, 10) > publicationDay &&
    bar.date.slice(0, 10) < today)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!sessions.length) return null;
  const first = sessions[0], last = sessions[sessions.length - 1];
  if (!Number.isFinite(first.open) || first.open <= 0 || !Number.isFinite(last.close) || last.close <= 0) return null;
  return {
    from: first.date.slice(0, 10), to: last.date.slice(0, 10),
    percent: (last.close / first.open - 1) * 100, sessions: sessions.length,
  };
}
