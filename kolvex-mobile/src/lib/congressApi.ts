// Same feed the Web reads through /api/congress/trades; the app calls FastAPI directly.
import { apiRequest } from "./http";

export type CongressTrade = {
  id: number;
  member_name: string;
  chamber: "house" | "senate" | null;
  ticker: string | null;
  asset_name: string | null;
  trade_date: string;
  filed_date: string;
  direction: "buy" | "sell" | "exchange" | "other";
  transaction_type: string;
  amount_range: string | null;
  source_url: string | null;
};
export type CongressTradePage = {
  trades: CongressTrade[];
  has_more: boolean;
  synced: boolean;
};
export const CONGRESS_TICKER = /^[A-Za-z0-9.^=-]{1,20}$/;

export const congressTrades = (
  filters: string,
  page: number,
  user: string,
  signal: AbortSignal,
) => {
  const params = new URLSearchParams(filters);
  params.set("page", String(page));
  params.set("limit", "25");
  return apiRequest<CongressTradePage>(`/congress/trades?${params}`, {
    signal,
    authenticated: true,
    expectedUser: user,
    timeout: 15_000,
  });
};
