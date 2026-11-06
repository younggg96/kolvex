export type OptionSide = "call" | "put";

export interface OptionContract {
  symbol: string; name: string | null; root: string | null; type: OptionSide; style: string | null;
  strike: number; expiration: string; multiplier: number; tradable: boolean | null;
  bid: number | null; ask: number | null; mid: number | null; bid_size: number | null; ask_size: number | null;
  bid_exchange: string | null; ask_exchange: string | null; quote_condition: string | null; quote_time: string | null;
  last: number | null; last_size: number | null; last_exchange: string | null; trade_condition: string | null; trade_time: string | null;
  open: number | null; high: number | null; low: number | null; close: number | null; vwap: number | null;
  trade_count: number | null; bar_time: string | null;
  minute_close: number | null; minute_volume: number | null; minute_time: string | null;
  prev_close: number | null; prev_volume: number | null; change: number | null; change_pct: number | null;
  close_price: number | null; close_price_date: string | null;
  volume: number; open_interest: number; open_interest_date: string | null;
  iv: number | null; delta: number | null; gamma: number | null; theta: number | null; vega: number | null; rho: number | null;
}

export interface OptionsChain {
  symbol: string; expiration: string; expirations: string[]; underlying_price: number | null; as_of: string;
  source: { provider: string; feed: string; delayed: boolean };
  metrics: {
    call_volume: number; put_volume: number; call_oi: number; put_oi: number; total_volume: number; total_oi: number;
    volume_put_call_ratio: number | null; oi_put_call_ratio: number | null;
    max_pain: { strike: number; holder_value: number } | null; max_pain_vs_spot_pct: number | null;
    atm_iv: number | null;
    expected_move: { value: number; pct: number; method: "atm_straddle" | "iv"; strike: number | null } | null;
    days_to_expiration: number;
  };
  contracts: OptionContract[];
}

export const optionsChainKey = (symbol: string, expiration?: string | null) =>
  `/api/market/options-chain/${encodeURIComponent(symbol)}${expiration ? `?expiration=${expiration}` : ""}`;

export interface StrikeRow { strike: number; call?: OptionContract; put?: OptionContract }

/** Pairs calls and puts by strike, ascending. */
export function strikeRows(contracts: OptionContract[]): StrikeRow[] {
  const rows = new Map<number, StrikeRow>();
  for (const contract of contracts) {
    const row = rows.get(contract.strike) ?? { strike: contract.strike };
    row[contract.type] = contract;
    rows.set(contract.strike, row);
  }
  return [...rows.values()].sort((a, b) => a.strike - b.strike);
}

/** The `count` strikes nearest the underlying on each side; all rows when the price is unknown. */
export function nearStrikes(rows: StrikeRow[], spot: number | null, count: number): StrikeRow[] {
  if (!spot || rows.length <= count * 2) return rows;
  const above = rows.findIndex((row) => row.strike >= spot);
  const pivot = above === -1 ? rows.length : above;
  return rows.slice(Math.max(0, pivot - count), pivot + count);
}

export const inTheMoney = (side: OptionSide, strike: number, spot: number | null) =>
  spot !== null && (side === "call" ? strike < spot : strike > spot);

export const bidAskSpread = (contract: OptionContract) =>
  contract.bid !== null && contract.ask !== null && contract.ask >= contract.bid ? contract.ask - contract.bid : null;
