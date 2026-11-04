import { validTicker } from "./decision";

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

const date = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));
const positive = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;
function isBoard(value: unknown): value is DiscoveryBoard {
  if (!value || typeof value !== "object") return false;
  const board = value as DiscoveryBoard;
  if (!Array.isArray(board.items) || board.items.length > 100 ||
    ![board.unavailable, board.partial, board.stale].every(flag => typeof flag === "boolean") ||
    !(board.sessionDate === null || date(board.sessionDate)) ||
    !(board.fetchedAt === null || typeof board.fetchedAt === "string" && Number.isFinite(Date.parse(board.fetchedAt)))) return false;
  const seen = new Set<string>();
  return board.items.every(item => {
    if (!item || typeof item.symbol !== "string" || !validTicker(item.symbol) || seen.has(item.symbol) ||
      typeof item.name !== "string" || !positive(item.price) || !Number.isFinite(item.changePercent) ||
      !positive(item.volume) || !positive(item.marketTime) || !date(item.sessionDate) || item.sessionDate !== board.sessionDate ||
      !(item.averageVolume === null || positive(item.averageVolume)) ||
      !(item.volumeMultiple === null || positive(item.volumeMultiple))) return false;
    seen.add(item.symbol);
    return true;
  });
}
export function isMarketDiscovery(value: unknown): value is MarketDiscovery {
  if (!value || typeof value !== "object") return false;
  const data = value as MarketDiscovery;
  return data.source === "Yahoo Finance" && isBoard(data.movers) && isBoard(data.active);
}

/** Resource hooks retain readable state on failures; rankings have a hard age cap. */
export function currentMarketDiscovery(data: MarketDiscovery | undefined, now = Date.now()): MarketDiscovery | undefined {
  if (!data) return undefined;
  const current = (board: DiscoveryBoard) => {
    const age = board.fetchedAt ? now - Date.parse(board.fetchedAt) : Infinity;
    return age <= 15 * 60_000 ? board : {
      ...board, items: [], sessionDate: null, fetchedAt: null,
      unavailable: true, partial: true, stale: false,
    };
  };
  const movers = current(data.movers), active = current(data.active);
  return movers === data.movers && active === data.active ? data : { ...data, movers, active };
}

export async function fetchMarketDiscovery(signal: AbortSignal): Promise<MarketDiscovery> {
  const response = await fetch("/api/market/discovery", { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Stock discovery unavailable");
  const data: unknown = await response.json();
  if (!isMarketDiscovery(data)) throw new Error("Invalid stock discovery response");
  return data;
}
