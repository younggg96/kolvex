// Types follow the Web's lib/paperTrading.ts. The transport differs: the app calls
// FastAPI directly with the account's session instead of the Next.js proxy.
import { ApiError, apiRequest } from "./http";
import messages from "./paperTradingErrors.json";

export type Side = "long" | "short";
export interface Quote {
  price: string;
  at: string;
  tradable: boolean;
  session?: "regular" | "post";
  currency: string;
  source: string;
}
export interface Position {
  id: string;
  symbol: string;
  side: Side;
  quantity: number;
  entry_price: string;
  collateral: string;
  entry_fee: string;
  stop_loss: string | null;
  take_profit: string | null;
  opened_at: string;
  note: string;
  source: string;
}
export interface Order {
  id: string;
  symbol: string;
  side: Side;
  effect: "open" | "close";
  quantity: number;
  kind: "market" | "limit" | "stop";
  price: string | null;
  reserved: string;
  stop_loss: string | null;
  take_profit: string | null;
  position_id: string | null;
  status: "pending" | "filled" | "cancelled" | "rejected";
  rejection?: string;
  created_at: string;
  fill_price?: string;
}
export interface Fill {
  id: string;
  order_id: string;
  position_id: string;
  symbol: string;
  side: Side;
  effect: "open" | "close";
  quantity: number;
  price: string;
  fee: string;
  realized_pnl: string;
  at: string;
  quote_at: string;
  reason: string;
  note: string;
  source: string;
}
export interface Account {
  version: number;
  state: {
    initial_cash: string;
    cash: string;
    positions: Position[];
    orders: Order[];
    fills: Fill[];
    marks: Record<string, Quote>;
    snapshots: { at: string; equity: string }[];
    quote_errors?: string[];
  };
  summary: {
    cash: string;
    reserved: string;
    available: string;
    equity: string;
    unrealized_pnl: string;
    realized_pnl: string;
    total_pnl: string;
    return_pct: string;
    fill_count: number;
    closed_count: number;
    win_rate: string | null;
  };
}
export interface Review {
  id: string;
  author: string;
  is_mine: boolean;
  note: string;
  published_at: string;
  snapshot: {
    symbol: string;
    side: Side;
    realized_pnl: string;
    fees: string;
    fills: Fill[];
  };
}
export type Command = {
  request_id: string;
  action: "order" | "cancel" | "sync" | "bracket";
  symbol?: string;
  side?: Side;
  effect?: "open" | "close";
  quantity?: number;
  kind?: "market" | "limit" | "stop";
  price?: number | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  position_id?: string;
  order_id?: string;
  note?: string;
  source?: "manual" | "ai_setup";
};
export const PAPER_SYMBOL = /^[A-Z][A-Z0-9.\-]{0,15}$/;

export class PaperApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
type Init = { signal?: AbortSignal; method?: string; body?: unknown };
async function paperRequest<T>(
  path: string,
  user: string,
  init: Init = {},
): Promise<T> {
  try {
    return await apiRequest<T>(`/paper-trading/${path}`, {
      ...init,
      authenticated: true,
      expectedUser: user,
      timeout: 55_000,
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    // Same codes the Web proxy derives from the upstream response.
    throw new PaperApiError(
      error.status === 401
        ? "unauthorized"
        : error.status === 404
          ? "paper_backend_outdated"
          : (error.detail ??
            (error.status === 422 ? "invalid_order" : "request_failed")),
      error.status,
    );
  }
}
export const paperAccount = (user: string, signal?: AbortSignal) =>
  paperRequest<Account>("account", user, { signal });
export const paperQuote = (
  symbol: string,
  user: string,
  signal?: AbortSignal,
) =>
  paperRequest<Quote>(`quote/${encodeURIComponent(symbol)}`, user, { signal });
/** The request id makes a retry of the same command safe to repeat. */
export const sendCommand = (command: Command, user: string) =>
  paperRequest<Account>("commands", user, { method: "POST", body: command });
export const paperReviews = (
  offset: number,
  user: string,
  signal?: AbortSignal,
) =>
  paperRequest<{ items: Review[]; has_more: boolean }>(
    `reviews?offset=${offset}`,
    user,
    { signal },
  );
export const publishReview = (position: string, note: string, user: string) =>
  paperRequest<unknown>("reviews", user, {
    method: "POST",
    body: { position_id: position, note },
  });
export const withdrawReview = (id: string, user: string) =>
  paperRequest<unknown>(`reviews/${encodeURIComponent(id)}`, user, {
    method: "DELETE",
  });

const errorMessages: Record<string, string[]> = messages;
/** Wording for a failed read or order, in the reader's language. */
export function paperErrorText(
  value: unknown,
  locale: "zh" | "en",
  context: "read" | "order" = "read",
): string {
  const code = value instanceof PaperApiError ? value.code : "";
  const pair =
    errorMessages[code] ??
    errorMessages[context === "order" ? "_order" : "_read"];
  return pair[locale === "en" ? 0 : 1];
}

export const money = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(value);
export const signedMoney = (value: number) =>
  `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;
