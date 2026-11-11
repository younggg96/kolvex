// From the Web's lib/marketDiscovery.ts and lib/stockDiscovery.ts.
import { apiRequest } from "./http";

const validTicker = (ticker: string) => /^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker);

export interface DiscoveryStock {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  averageVolume: number | null;
  volumeMultiple: number | null;
  marketTime: number;
  sessionDate: string;
}
export interface DiscoveryBoard {
  items: DiscoveryStock[];
  sessionDate: string | null;
  fetchedAt: string | null;
  unavailable: boolean;
  partial: boolean;
  stale: boolean;
}
export interface MarketDiscovery {
  source: "Yahoo Finance";
  movers: DiscoveryBoard;
  active: DiscoveryBoard;
}

const date = (value: unknown) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value));
const positive = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
function isBoard(value: unknown): value is DiscoveryBoard {
  if (!value || typeof value !== "object") return false;
  const board = value as DiscoveryBoard;
  if (
    !Array.isArray(board.items) ||
    board.items.length > 100 ||
    ![board.unavailable, board.partial, board.stale].every(
      (flag) => typeof flag === "boolean",
    ) ||
    !(board.sessionDate === null || date(board.sessionDate)) ||
    !(
      board.fetchedAt === null ||
      (typeof board.fetchedAt === "string" &&
        Number.isFinite(Date.parse(board.fetchedAt)))
    )
  )
    return false;
  const seen = new Set<string>();
  return board.items.every((item) => {
    if (
      !item ||
      typeof item.symbol !== "string" ||
      !validTicker(item.symbol) ||
      seen.has(item.symbol) ||
      typeof item.name !== "string" ||
      !positive(item.price) ||
      !Number.isFinite(item.changePercent) ||
      !positive(item.volume) ||
      !positive(item.marketTime) ||
      !date(item.sessionDate) ||
      item.sessionDate !== board.sessionDate ||
      !(item.averageVolume === null || positive(item.averageVolume)) ||
      !(item.volumeMultiple === null || positive(item.volumeMultiple))
    )
      return false;
    seen.add(item.symbol);
    return true;
  });
}
export function isMarketDiscovery(value: unknown): value is MarketDiscovery {
  if (!value || typeof value !== "object") return false;
  const data = value as MarketDiscovery;
  return (
    data.source === "Yahoo Finance" &&
    isBoard(data.movers) &&
    isBoard(data.active)
  );
}

/** Resource hooks retain readable state on failures; rankings have a hard age cap. */
export function currentMarketDiscovery(
  data: MarketDiscovery | undefined,
  now = Date.now(),
): MarketDiscovery | undefined {
  if (!data) return undefined;
  const current = (board: DiscoveryBoard) => {
    const age = board.fetchedAt ? now - Date.parse(board.fetchedAt) : Infinity;
    return age <= 15 * 60_000
      ? board
      : {
          ...board,
          items: [],
          sessionDate: null,
          fetchedAt: null,
          unavailable: true,
          partial: true,
          stale: false,
        };
  };
  const movers = current(data.movers),
    active = current(data.active);
  return movers === data.movers && active === data.active
    ? data
    : { ...data, movers, active };
}

/** The app calls FastAPI directly; the Web reads the same data through /api/market/discovery. */
export async function fetchMarketDiscovery(
  signal: AbortSignal,
): Promise<MarketDiscovery> {
  const data: unknown = await apiRequest("/market/discovery", {
    signal,
    timeout: 28_000,
  });
  if (!isMarketDiscovery(data))
    throw new Error("Invalid stock discovery response");
  return data;
}

// From the Web's lib/stockDiscovery.ts: the curated list and its sectors.
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
] as const satisfies readonly {
  symbol: string;
  name: string;
  sector: StockSector;
}[];
