import type { StockQuote } from "./stockApi";
import type { YouTubeStockSummary } from "./youtubeOpinionsApi";
import { opinionDay } from "./opinionDates";
import { validTicker } from "./decision";
import type { DiscoveryStock } from "./marketDiscovery";
import { STOCK_SOURCES, type SocialBuzz, type StockSource } from "./socialBuzz";
export type { StockSource } from "./socialBuzz";

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

export type StockScope = "core" | "movers" | "active" | "creators" | "holdings";
export type StockSort = "move" | "gainers" | "losers" | "default" | "heat" | "latest" | "volume";
export interface StockObservationState {
  scope: StockScope;
  sector: StockSector;
  sort: StockSort;
  /** Creator buzz only: which discussion sources feed the list. */
  source: StockSource;
  rows: number;
  search?: string;
}
export const STOCK_PAGE_SIZE = 10;
export const STOCK_PREFERENCE_KEY = "kolvex:stock-observation";

export function stockSorts(scope: StockScope, source: StockSource = "all"): StockSort[] {
  if (scope === "active") return ["volume", "move", "gainers", "losers"];
  if (scope === "movers") return ["move", "gainers", "losers"];
  // Reddit rankings carry no per-post dates, so there is no "latest" order for them.
  if (scope === "creators") return source === "reddit" ? ["heat", "move", "gainers", "losers"] : ["heat", "latest", "move", "gainers", "losers"];
  return ["move", "gainers", "losers", "default"];
}

export function readStockObservationState(params: URLSearchParams, holdingsEnabled = false): StockObservationState {
  const requested = params.get("stocks");
  const scope: StockScope = requested === "creators" || requested === "movers" || requested === "active" ? requested : requested === "holdings" && holdingsEnabled ? "holdings" : "core";
  const sector = scope === "core" ? STOCK_SECTORS.find(item => item.key === params.get("sector"))?.key ?? "all" : "all";
  const requestedSource = params.get("stockSource");
  const source: StockSource = scope === "creators" ? STOCK_SOURCES.find(item => item.key === requestedSource)?.key ?? "all" : "all";
  const sorts = stockSorts(scope, source);
  const requestedSort = params.get("stockSort") as StockSort;
  const requestedRows = Number(params.get("stockRows"));
  const search = (params.get("stockSearch") ?? "").trim().slice(0, 100);
  return { scope, sector, source, sort: sorts.includes(requestedSort) ? requestedSort : sorts[0],
    ...(search ? { search } : {}),
    rows: Number.isSafeInteger(requestedRows) && requestedRows >= STOCK_PAGE_SIZE ? Math.min(requestedRows, 1000) : STOCK_PAGE_SIZE };
}

export function writeStockObservationState(params: URLSearchParams, state: StockObservationState) {
  const next = new URLSearchParams(params);
  next.set("stocks", state.scope);
  next.set("stockSort", state.sort);
  if (state.scope === "core" && state.sector !== "all") next.set("sector", state.sector);
  else next.delete("sector");
  if (state.scope === "creators" && state.source !== "all") next.set("stockSource", state.source);
  else next.delete("stockSource");
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

/** Reciprocal-rank fusion constant: dampens the gap between a source's first few places. */
const FUSION_K = 10;

/** Per-source heat ranks for the creator-buzz list; 0 is the hottest. */
function creatorHeat(stocks: readonly YouTubeStockSummary[], social: SocialBuzz, now: number) {
  const youtube = stocks.filter(stock => validTicker(stock.ticker) && (recentStockOpinionCount(stock, now) ?? 0) > 0)
    .sort((a, b) => (recentStockOpinionCount(b, now) ?? 0) - (recentStockOpinionCount(a, now) ?? 0)
      || (latestStockOpinionDate(b, now) ?? "").localeCompare(latestStockOpinionDate(a, now) ?? "") || a.ticker.localeCompare(b.ticker))
    .map(stock => stock.ticker);
  const reddit = (social.reddit ?? []).filter(stock => stock.mentions > 0 && validTicker(stock.ticker))
    .sort((a, b) => b.mentions - a.mentions || a.rank - b.rank).map(stock => stock.ticker);
  const x = (social.x ?? []).filter(stock => validTicker(stock.ticker))
    .sort((a, b) => b.posts - a.posts || b.authors - a.authors || a.ticker.localeCompare(b.ticker)).map(stock => stock.ticker);
  const rank = (list: string[]) => new Map(list.map((ticker, index) => [ticker, index]));
  return { youtube: rank(youtube), reddit: rank(reddit), x: rank(x) };
}

export function selectObservationSymbols(
  state: StockObservationState,
  stocks: readonly YouTubeStockSummary[],
  holdings: readonly string[],
  quotes: Record<string, StockQuote>,
  now = Date.now(),
  discovered: readonly DiscoveryStock[] = [],
  social: SocialBuzz = {},
) {
  const coverage = new Map(stocks.map(stock => [stock.ticker, stock]));
  const marketScope = state.scope === "movers" || state.scope === "active";
  const discovery = new Map(discovered.map(stock => [stock.symbol, stock]));
  const source = state.scope === "creators" ? state.source ?? "all" : "all";
  const heat = state.scope === "creators" ? creatorHeat(stocks, social, now) : undefined;
  const sources = heat ? (source === "all" ? [heat.youtube, heat.reddit, heat.x] : [heat[source]]) : [];
  const xLatest = new Map((social.x ?? []).map(stock => [stock.ticker, stock.latest]));
  const redditNames = new Map((social.reddit ?? []).map(stock => [stock.ticker, stock.name]));
  // Latest dated evidence among the selected sources; Reddit rankings have no dates.
  const latest = (symbol: string) => {
    const dates = [source !== "x" ? latestStockOpinionDate(coverage.get(symbol), now) : null, source !== "youtube" ? xLatest.get(symbol) : null]
      .filter((value): value is string => Boolean(value) && Date.parse(value!) <= now);
    return dates.length ? Math.max(...dates.map(value => Date.parse(value.length === 10 ? `${value}T12:00:00Z` : value))) : null;
  };
  const fused = (symbol: string) => sources.reduce((score, ranks) => score + (ranks.has(symbol) ? 1 / (FUSION_K + ranks.get(symbol)!) : 0), 0);
  const symbols: string[] = marketScope ? [...discovery.keys()]
    : state.scope === "core" ? CORE_STOCKS.filter(stock => state.sector === "all" || stock.sector === state.sector).map(stock => stock.symbol)
    : state.scope === "holdings" ? [...new Set(holdings)]
    : state.sort === "latest" ? [...new Set([...stocks.map(stock => stock.ticker), ...xLatest.keys()])].filter(symbol => validTicker(symbol) && latest(symbol) !== null)
    : [...new Set(sources.flatMap(ranks => [...ranks.keys()]))];
  const search = (state.search ?? "").trim().replace(/^\$/, "").toLocaleLowerCase();
  const matching = search ? symbols.filter(symbol => [symbol, CORE_STOCKS.find(stock => stock.symbol === symbol)?.name, coverage.get(symbol)?.company_name, quotes[symbol]?.name, discovery.get(symbol)?.name, redditNames.get(symbol)]
    .some(value => value?.toLocaleLowerCase().includes(search))) : symbols;
  return matching.sort((a, b) => {
    if (state.sort === "default") return 0;
    if (state.sort === "volume") return (discovery.get(b)?.volumeMultiple ?? 0) - (discovery.get(a)?.volumeMultiple ?? 0) || a.localeCompare(b);
    if (state.sort === "heat") return fused(b) - fused(a) || a.localeCompare(b);
    if (state.sort === "latest") return latest(b)! - latest(a)! || a.localeCompare(b);
    const left = marketScope ? discovery.get(a)?.changePercent : quotes[a]?.changePercent;
    const right = marketScope ? discovery.get(b)?.changePercent : quotes[b]?.changePercent;
    if (typeof left !== "number" || !Number.isFinite(left) || typeof right !== "number" || !Number.isFinite(right)) return Number.isFinite(left) ? -1 : Number.isFinite(right) ? 1 : 0;
    return (state.sort === "move" ? Math.abs(right) - Math.abs(left) : state.sort === "gainers" ? right - left : left - right) || a.localeCompare(b);
  });
}

/** All entry reasons use dated evidence; a missing metric is never inferred. */
export function stockEntryReason(scope: StockScope, symbol: string, stock: YouTubeStockSummary | undefined, item: DiscoveryStock | undefined, now = Date.now(), social: SocialBuzz = {}, source: StockSource = "all"): [string, string] {
  if (scope === "movers" && item) {
    const move = `${item.changePercent >= 0 ? "+" : ""}${item.changePercent.toFixed(2)}%`;
    return [`${item.sessionDate} · Move ${move}`, `${item.sessionDate} · 涨跌 ${move}`];
  }
  if (scope === "active" && item?.volumeMultiple != null) {
    const multiple = item.volumeMultiple.toFixed(2);
    return [`${item.sessionDate} · Volume / 3M daily avg ${multiple}×`, `${item.sessionDate} · 成交量 / 3个月日均 ${multiple}倍`];
  }
  if (scope === "creators") {
    const parts: Record<"youtube" | "reddit" | "x", [string, string] | null> = { youtube: null, reddit: null, x: null };
    const count = recentStockOpinionCount(stock, now);
    if (count !== null && count > 0) {
      const previous = stock?.discussion_heat?.previous;
      const delta = typeof previous === "number" && Number.isSafeInteger(previous) && previous >= 0 ? count - previous : null;
      const en = delta !== null && delta > 0 ? ` · ${delta} more than prior 7d` : "";
      const zh = delta !== null && delta > 0 ? ` · 较前7天多${delta}条` : "";
      parts.youtube = [`${count} opinions in 7d${en}`, `近7天 ${count}条观点${zh}`];
    } else {
      const latest = latestStockOpinionDate(stock, now);
      if (latest) parts.youtube = [`Latest opinion · ${opinionDay(latest)}`, `最新观点 · ${opinionDay(latest)}`];
    }
    const reddit = social.reddit?.find(row => row.ticker === symbol);
    if (reddit && reddit.mentions > 0) {
      const mentions = reddit.mentions.toLocaleString("en-US");
      parts.reddit = [`Reddit ${mentions} mentions in 24h`, `Reddit 24小时 ${mentions}次提及`];
    }
    const x = social.x?.find(row => row.ticker === symbol);
    if (x) parts.x = [`X ${x.posts} posts · ${x.authors} accounts in 7d`, `X 近7天 ${x.posts}帖 · ${x.authors}位博主`];
    // The selected source leads; the others stay visible as corroborating evidence.
    const order = source === "all" ? ["youtube", "reddit", "x"] as const : [source, ...(["youtube", "reddit", "x"] as const).filter(key => key !== source)];
    const shown = order.map(key => parts[key]).filter((part): part is [string, string] => part !== null);
    if (shown.length) return [shown.map(part => part[0]).join("; "), shown.map(part => part[1]).join("；")];
  }
  if (scope === "holdings") return ["In your linked holdings", "来自已连接持仓"];
  const sector = STOCK_SECTORS.find(sector => sector.key === CORE_STOCKS.find(stock => stock.symbol === symbol)?.sector);
  return sector ? [`${sector.en} · Curated stock`, `${sector.zh} · 精选观察股`] : ["Curated stock", "精选观察股"];
}

/**
 * The one number from `stockEntryReason` worth keeping on a phone row, as a short tag. `null` when
 * the row already shows it (a mover's change sits in the price column) or the list name says it.
 */
export function stockEntryTag(scope: StockScope, symbol: string, stock: YouTubeStockSummary | undefined, item: DiscoveryStock | undefined, now = Date.now(), social: SocialBuzz = {}, source: StockSource = "all"): [string, string] | null {
  if (scope === "active") {
    if (item?.volumeMultiple == null) return null;
    const multiple = item.volumeMultiple.toFixed(2);
    return [`${multiple}× vol`, `${multiple}倍量`];
  }
  if (scope === "creators") {
    const count = recentStockOpinionCount(stock, now);
    const reddit = social.reddit?.find(row => row.ticker === symbol);
    const x = social.x?.find(row => row.ticker === symbol);
    const tags = {
      youtube: count !== null && count > 0 ? [`${count} opinions`, `${count}条观点`] as [string, string] : null,
      reddit: reddit && reddit.mentions > 0 ? [`Reddit ${reddit.mentions.toLocaleString("en-US")}`, `Reddit ${reddit.mentions.toLocaleString("en-US")}`] as [string, string] : null,
      x: x ? [`X ${x.posts} posts`, `X ${x.posts}帖`] as [string, string] : null,
    };
    const order = source === "all" ? ["youtube", "reddit", "x"] as const : [source, ...(["youtube", "reddit", "x"] as const).filter(key => key !== source)];
    return order.map(key => tags[key]).find((tag): tag is [string, string] => tag !== null) ?? null;
  }
  if (scope === "core") {
    const sector = STOCK_SECTORS.find(sector => sector.key === CORE_STOCKS.find(stock => stock.symbol === symbol)?.sector);
    return sector ? [sector.en, sector.zh] : null;
  }
  return null;
}

/** Stock details only accept a return to the owning market list. */
export function stockObservationReturnHref(value?: string | null) {
  if (!value || !/^\/dashboard(?:\/watchlist)?(?:\?|$)/.test(value) || value.includes("#") || /[\\\r\n]/.test(value)) return "/dashboard";
  return value;
}
