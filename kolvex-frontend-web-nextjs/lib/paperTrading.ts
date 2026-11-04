import type { AiTechnicalAnalysis } from "./stockApi";

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

export class PaperApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
export async function paperRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 55000);
  try {
    const response = await fetch(`/api/paper-trading/${path}`, {
      ...options,
      signal: controller.signal,
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...options.headers },
    });
    const body = await response.json();
    if (!response.ok)
      throw new PaperApiError(body.error || "request_failed", response.status);
    return body;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}
export const sendCommand = (command: Command) =>
  paperRequest<Account>("commands", {
    method: "POST",
    body: JSON.stringify(command),
  });

// Only carries an editable plan. Neither a quote nor an authorization to execute.
export function paperSetupHref(
  symbol: string,
  setup: NonNullable<AiTechnicalAnalysis["setup"]>,
) {
  const query = new URLSearchParams({
    symbol,
    side: setup.direction === "bullish" ? "long" : "short",
    entry: String(setup.entry_low),
    stop: String(setup.invalidation),
    target: String(setup.targets[0] ?? ""),
    note: `${setup.name}\n${setup.reason}`.slice(0, 2000),
    source: "ai_setup",
  });
  return `/dashboard/paper-trading?${query}`;
}
