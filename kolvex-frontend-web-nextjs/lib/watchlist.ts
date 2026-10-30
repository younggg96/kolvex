/** Legacy browser keys are read only to migrate into the signed-in account. */
export const WATCHLIST_KEY = "kolvex:watchlist";
export const LEGACY_WATCHLIST_KEY = "kolvex:reddit-watchlist";

export function normalizeWatchlistTicker(value: string): string | null {
  const ticker = value.trim().replace(/^\$/, "").toUpperCase();
  return /^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker) ? ticker : null;
}

export function parseWatchlist(raw: string | null): string[] {
  try {
    const values: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(values)) return [];
    return [...new Set(values.flatMap(value => {
      const ticker = typeof value === "string" ? normalizeWatchlistTicker(value) : null;
      return ticker ? [ticker] : [];
    }))];
  } catch { return []; }
}
