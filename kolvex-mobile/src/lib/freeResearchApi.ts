import { apiRequest, ApiError } from "./http";
import {
  freeResearchKey,
  institutionKey,
  institutionSummaryKey,
  INSTITUTIONS_KEY,
  type Institution,
  type InstitutionManager,
  type InstitutionSummary,
  type RevenueOutlook,
  type SecFilings,
  type SecFinancials,
  type SecInsiders,
} from "./freeResearch";
// SEC reads are rate limited and slow on first read. These are public filings with no
// account scope, so one short-lived process cache is safe across sign-ins.
const TTL = 600_000;
const LIMIT = 60;
const cache = new Map<string, { at: number; data: unknown }>();
async function read<T>(
  key: string,
  arrayKey: string,
  signal: AbortSignal,
  symbol?: string,
): Promise<T | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data as T;
  try {
    const data = await apiRequest<Record<string, unknown>>(
      key.replace(/^\/api/, ""),
      { signal, timeout: 50_000 },
    );
    if (
      !Array.isArray(data?.[arrayKey]) ||
      (symbol && data.symbol !== symbol.toUpperCase())
    )
      throw new Error("数据格式无效，请重试。");
    if (cache.size >= LIMIT) cache.delete(cache.keys().next().value as string);
    cache.set(key, { at: Date.now(), data });
    return data as T;
  } catch (error) {
    // The source has no such security: an empty state, not a failure.
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
export const secFinancials = (symbol: string, signal: AbortSignal) =>
  read<SecFinancials>(
    freeResearchKey(symbol, "financials"),
    "annual",
    signal,
    symbol,
  );
export const secFilings = (symbol: string, signal: AbortSignal) =>
  read<SecFilings>(
    freeResearchKey(symbol, "filings"),
    "filings",
    signal,
    symbol,
  );
export const secInsiders = (symbol: string, signal: AbortSignal) =>
  read<SecInsiders>(
    freeResearchKey(symbol, "insiders"),
    "transactions",
    signal,
    symbol,
  );
export const revenueOutlook = (symbol: string, signal: AbortSignal) =>
  read<RevenueOutlook>(
    freeResearchKey(symbol, "revenue-outlook"),
    "estimates",
    signal,
    symbol,
  );
export const managers = (signal: AbortSignal) =>
  read<{ managers: InstitutionManager[] }>(
    INSTITUTIONS_KEY,
    "managers",
    signal,
  );
export const institution = (manager: string, signal: AbortSignal) =>
  read<Institution>(institutionKey(manager), "holdings", signal);
export const institutionSummary = (manager: string, signal: AbortSignal) =>
  read<InstitutionSummary>(institutionSummaryKey(manager), "top", signal);
/** Drops cached 13F reads so an explicit refresh asks the SEC proxy again. */
export function forgetInstitutions() {
  for (const key of [...cache.keys()])
    if (key.startsWith(INSTITUTIONS_KEY)) cache.delete(key);
}
