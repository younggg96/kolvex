import type { StockQuote } from "./stockApi";
import type { YouTubeStockSummary } from "./youtubeOpinionsApi";
import { opinionDay } from "./opinionDates";
import { validTicker } from "./decision";

export const STOCK_SECTORS = [
  { key: "all", en: "All sectors", zh: "全部行业" },
  { key: "technology", en: "Technology", zh: "科技" },
  { key: "communication", en: "Communication", zh: "通信服务" },
  { key: "consumer", en: "Consumer", zh: "消费" },
  { key: "financials", en: "Financials", zh: "金融" },
  { key: "healthcare", en: "Healthcare", zh: "医疗健康" },
  { key: "energy", en: "Energy", zh: "能源" },
  { key: "industrials", en: "Industrials", zh: "工业" },
  { key: "utilities", en: "Utilities", zh: "公用事业" },
] as const;
export type StockSector = (typeof STOCK_SECTORS)[number]["key"];

/** A maintained cross-sector reading list, not a popularity or market-wide ranking. */
export const CORE_STOCKS = [
  { symbol: "NVDA", name: "NVIDIA", sector: "technology" },
  { symbol: "AAPL", name: "Apple", sector: "technology" },
  { symbol: "MSFT", name: "Microsoft", sector: "technology" },
  { symbol: "AVGO", name: "Broadcom", sector: "technology" },
  { symbol: "AMD", name: "Advanced Micro Devices", sector: "technology" },
  { symbol: "GOOGL", name: "Alphabet", sector: "communication" },
  { symbol: "META", name: "Meta Platforms", sector: "communication" },
  { symbol: "NFLX", name: "Netflix", sector: "communication" },
  { symbol: "AMZN", name: "Amazon", sector: "consumer" },
  { symbol: "TSLA", name: "Tesla", sector: "consumer" },
  { symbol: "WMT", name: "Walmart", sector: "consumer" },
  { symbol: "COST", name: "Costco", sector: "consumer" },
  { symbol: "KO", name: "Coca-Cola", sector: "consumer" },
  { symbol: "JPM", name: "JPMorgan Chase", sector: "financials" },
  { symbol: "BAC", name: "Bank of America", sector: "financials" },
  { symbol: "BRK-B", name: "Berkshire Hathaway", sector: "financials" },
  { symbol: "V", name: "Visa", sector: "financials" },
  { symbol: "LLY", name: "Eli Lilly", sector: "healthcare" },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "healthcare" },
  { symbol: "ABBV", name: "AbbVie", sector: "healthcare" },
  { symbol: "XOM", name: "Exxon Mobil", sector: "energy" },
  { symbol: "CVX", name: "Chevron", sector: "energy" },
  { symbol: "CAT", name: "Caterpillar", sector: "industrials" },
  { symbol: "GE", name: "GE Aerospace", sector: "industrials" },
  { symbol: "NEE", name: "NextEra Energy", sector: "utilities" },
] as const satisfies readonly { symbol: string; name: string; sector: StockSector }[];

export type StockScope = "core" | "creators" | "holdings";
export type StockSort = "move" | "gainers" | "losers" | "default" | "heat" | "latest";
export interface StockObservationState {
  scope: StockScope;
  sector: StockSector;
  sort: StockSort;
  rows: number;
  search?: string;
}
export const STOCK_PAGE_SIZE = 10;
export const STOCK_PREFERENCE_KEY = "kolvex:stock-observation";

export function stockSorts(scope: StockScope): StockSort[] {
  return scope === "creators" ? ["heat", "latest", "move", "gainers", "losers"] : ["move", "gainers", "losers", "default"];
}

export function readStockObservationState(params: URLSearchParams, holdingsEnabled = false): StockObservationState {
  const requested = params.get("stocks");
  const scope: StockScope = requested === "creators" ? "creators" : requested === "holdings" && holdingsEnabled ? "holdings" : "core";
  const sector = scope === "core" ? STOCK_SECTORS.find(item => item.key === params.get("sector"))?.key ?? "all" : "all";
  const sorts = stockSorts(scope);
  const requestedSort = params.get("stockSort") as StockSort;
  const requestedRows = Number(params.get("stockRows"));
  const search = (params.get("stockSearch") ?? "").trim().slice(0, 100);
  return { scope, sector, sort: sorts.includes(requestedSort) ? requestedSort : sorts[0],
    ...(search ? { search } : {}),
    rows: Number.isSafeInteger(requestedRows) && requestedRows >= STOCK_PAGE_SIZE ? Math.min(requestedRows, 1000) : STOCK_PAGE_SIZE };
}

export function writeStockObservationState(params: URLSearchParams, state: StockObservationState) {
  const next = new URLSearchParams(params);
  next.set("stocks", state.scope);
  next.set("stockSort", state.sort);
  if (state.scope === "core" && state.sector !== "all") next.set("sector", state.sector);
  else next.delete("sector");
  if (state.rows > STOCK_PAGE_SIZE) next.set("stockRows", String(state.rows));
  else next.delete("stockRows");
  if (state.search?.trim()) next.set("stockSearch", state.search.trim().slice(0, 100));
  else next.delete("stockSearch");
  return next;
}

/** Use source publication dates, never import timestamps, for discovery recency. */
export function latestStockOpinionDate(stock?: YouTubeStockSummary, now = Date.now()) {
  const source = stock?.latest_evidence?.video_published_at || stock?.latest_evidence?.opinion_date;
  if (!source) return null;
  const day = opinionDay(source);
  const timestamp = Date.parse(source.length === 10 ? `${source}T12:00:00Z` : source);
  if (!day || !Number.isFinite(timestamp) || day > opinionDay(new Date(now).toISOString()) || (source.length > 10 && timestamp > now)) return null;
  return source;
}

export function recentStockOpinionCount(stock?: YouTubeStockSummary, now = Date.now()) {
  const heat = stock?.discussion_heat;
  // A cached seven-day aggregate must describe the current New York calendar day.
  if (!heat || heat.to !== opinionDay(new Date(now).toISOString()) || !Number.isSafeInteger(heat.recent) || heat.recent < 0) return null;
  return heat.recent;
}

export function selectObservationSymbols(
  state: StockObservationState,
  stocks: readonly YouTubeStockSummary[],
  holdings: readonly string[],
  quotes: Record<string, StockQuote>,
  now = Date.now(),
) {
  const coverage = new Map(stocks.map(stock => [stock.ticker, stock]));
  const symbols: string[] = state.scope === "core" ? CORE_STOCKS.filter(stock => state.sector === "all" || stock.sector === state.sector).map(stock => stock.symbol)
    : state.scope === "holdings" ? [...new Set(holdings)]
    : stocks.filter(stock => validTicker(stock.ticker) && (state.sort === "latest" ? latestStockOpinionDate(stock, now) !== null : (recentStockOpinionCount(stock, now) ?? 0) > 0)).map(stock => stock.ticker);
  const search = (state.search ?? "").trim().replace(/^\$/, "").toLocaleLowerCase();
  const matching = search ? symbols.filter(symbol => [symbol, CORE_STOCKS.find(stock => stock.symbol === symbol)?.name, coverage.get(symbol)?.company_name, quotes[symbol]?.name]
    .some(value => value?.toLocaleLowerCase().includes(search))) : symbols;
  return matching.sort((a, b) => {
    if (state.sort === "default") return 0;
    if (state.sort === "heat") return (recentStockOpinionCount(coverage.get(b), now) ?? 0) - (recentStockOpinionCount(coverage.get(a), now) ?? 0) || (latestStockOpinionDate(coverage.get(b), now) ?? "").localeCompare(latestStockOpinionDate(coverage.get(a), now) ?? "") || a.localeCompare(b);
    if (state.sort === "latest") return Date.parse(latestStockOpinionDate(coverage.get(b), now)!) - Date.parse(latestStockOpinionDate(coverage.get(a), now)!) || a.localeCompare(b);
    const left = quotes[a]?.changePercent, right = quotes[b]?.changePercent;
    if (!Number.isFinite(left) || !Number.isFinite(right)) return Number.isFinite(left) ? -1 : Number.isFinite(right) ? 1 : 0;
    return (state.sort === "move" ? Math.abs(right) - Math.abs(left) : state.sort === "gainers" ? right - left : left - right) || a.localeCompare(b);
  });
}

/** Stock details only accept a return to the owning market list. */
export function stockObservationReturnHref(value?: string | null) {
  if (!value || !/^\/dashboard(?:\?|$)/.test(value) || value.includes("#") || /[\\\r\n]/.test(value)) return "/dashboard";
  return value;
}
