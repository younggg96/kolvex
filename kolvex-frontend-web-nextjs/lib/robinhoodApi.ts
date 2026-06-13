/**
 * Robinhood API Module
 * Client-side calls for direct Robinhood broker connection.
 */

const API_PREFIX = "/api/robinhood";

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_PREFIX}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

export interface RobinhoodConnectRequest {
  username: string;
  password: string;
  totp_secret?: string;
  challenge_code?: string;
}

export interface RobinhoodStatus {
  is_connected: boolean;
  last_synced_at?: string | null;
  profile?: Record<string, unknown> | null;
  positions_count: number;
  orders_count: number;
  setup_required?: boolean;
  message?: string | null;
  is_syncing?: boolean;
  sync_started_at?: string | null;
  last_sync_error?: string | null;
}

export interface RobinhoodConnectResponse extends RobinhoodStatus {
  success: boolean;
  positions_synced: number;
  approval_required?: boolean;
  message?: string | null;
}

export interface RobinhoodSyncResponse {
  success: boolean;
  is_syncing: boolean;
  already_running: boolean;
  sync_started_at?: string | null;
  message: string;
}

export interface RobinhoodOrder {
  id: string;
  order_id: string;
  ticker: string;
  side?: string | null;
  order_type?: string | null;
  quantity?: number | null;
  average_price?: number | null;
  total_amount?: number | null;
  state?: string | null;
  created_time?: string | null;
  executed_time?: string | null;
  fees?: number | null;
  raw_order?: Record<string, unknown> | null;
  cost_basis?: number | null;
  realized_pnl?: number | null;
  realized_pnl_percent?: number | null;
  wash_sale_flag?: boolean;
  wash_sale_reason?: string | null;
  broker?: "robinhood" | "ibkr";
}

export interface RobinhoodWashSaleRiskSymbol {
  ticker: string;
  last_loss_sale_at: string;
  risk_expires_at: string;
  days_remaining: number;
  loss_amount: number;
}

export interface RobinhoodOrdersResponse {
  orders: RobinhoodOrder[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  wash_sale_risk_symbols: RobinhoodWashSaleRiskSymbol[];
}

export interface RobinhoodOptionOrder {
  id: string;
  option_order_id: string;
  leg_id: string;
  chain_symbol?: string | null;
  underlying_symbol?: string | null;
  option_type?: string | null;
  expiration_date?: string | null;
  strike_price?: number | null;
  side?: string | null;
  direction?: string | null;
  opening_strategy?: string | null;
  closing_strategy?: string | null;
  order_type?: string | null;
  quantity?: number | null;
  processed_quantity?: number | null;
  price?: number | null;
  premium?: number | null;
  state?: string | null;
  created_time?: string | null;
  executed_time?: string | null;
  raw_order?: Record<string, unknown> | null;
  raw_leg?: Record<string, unknown> | null;
  cost_basis?: number | null;
  realized_pnl?: number | null;
  realized_pnl_percent?: number | null;
  broker?: "robinhood" | "ibkr";
}

export interface RobinhoodOptionOrdersResponse {
  orders: RobinhoodOptionOrder[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export interface RobinhoodOrdersAnalysisResponse {
  analysis: string;
  provider: string;
  model: string;
  orders_analyzed: number;
  generated_at: string;
}

export interface RobinhoodSellPerformanceItem {
  order_id: string;
  ticker: string;
  sell_time?: string | null;
  quantity: number;
  sell_price: number;
  current_price?: number | null;
  price_change?: number | null;
  price_change_percent?: number | null;
  opportunity_pnl?: number | null;
  realized_pnl?: number | null;
  realized_pnl_percent?: number | null;
  verdict: "sold_too_early" | "good_sale" | "flat" | "unknown";
  message: string;
}

export interface RobinhoodSellPerformanceResponse {
  items: RobinhoodSellPerformanceItem[];
  summary: {
    total_sells: number;
    sold_too_early_count: number;
    good_sale_count: number;
    unknown_count: number;
    missed_upside_amount: number;
    avoided_downside_amount: number;
  };
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
  generated_at: string;
}

export async function connectRobinhood(
  payload: RobinhoodConnectRequest
): Promise<RobinhoodConnectResponse> {
  return apiRequest<RobinhoodConnectResponse>("/connect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function syncRobinhood(): Promise<RobinhoodSyncResponse> {
  return apiRequest<RobinhoodSyncResponse>("/sync", {
    method: "POST",
  });
}

/**
 * Polls /status until the background sync finishes, then resolves with the
 * final status. Throws if the sync ends with `last_sync_error`.
 *
 * Used after `/connect` and `/sync` since both now schedule the heavy work
 * in the background to avoid Vercel's 60s edge-proxy timeout.
 */
export async function waitForRobinhoodSync(options?: {
  /** How long to keep polling before giving up (default: 5 min). */
  timeoutMs?: number;
  /** Delay between polls (default: 2.5s). */
  intervalMs?: number;
  /** Called on every successful poll so the UI can show progress. */
  onProgress?: (status: RobinhoodStatus) => void;
}): Promise<RobinhoodStatus> {
  const timeoutMs = options?.timeoutMs ?? 5 * 60 * 1000;
  const intervalMs = options?.intervalMs ?? 2500;
  const onProgress = options?.onProgress;
  const deadline = Date.now() + timeoutMs;

  // First read once immediately so we don't sleep before the first update.
  let status = await getRobinhoodStatus();
  onProgress?.(status);

  while (status.is_syncing && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    try {
      status = await getRobinhoodStatus();
      onProgress?.(status);
    } catch (error) {
      console.warn("Polling Robinhood status failed:", error);
    }
  }

  if (status.last_sync_error) {
    throw new Error(status.last_sync_error);
  }
  if (status.is_syncing) {
    throw new Error(
      "Robinhood sync is taking longer than expected. Check back in a minute."
    );
  }
  return status;
}

export async function resetRobinhoodAuth(): Promise<{
  message: string;
  success: boolean;
}> {
  return apiRequest<{ message: string; success: boolean }>("/reset-auth", {
    method: "POST",
  });
}

export async function getRobinhoodStatus(): Promise<RobinhoodStatus> {
  try {
    return await apiRequest<RobinhoodStatus>("/status");
  } catch (error) {
    console.warn("Robinhood status unavailable:", error);
    return {
      is_connected: false,
      last_synced_at: null,
      profile: null,
      positions_count: 0,
      orders_count: 0,
    };
  }
}

export async function getRobinhoodOrders(
  limit = 100,
  offset = 0,
  symbol?: string,
  status = "filled"
): Promise<RobinhoodOrdersResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    status,
  });
  if (symbol) params.set("symbol", symbol);
  return apiRequest<RobinhoodOrdersResponse>(
    `/orders?${params.toString()}`
  );
}

export async function getRobinhoodOptionOrders(
  limit = 100,
  offset = 0,
  symbol?: string,
  status = "filled"
): Promise<RobinhoodOptionOrdersResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    status,
  });
  if (symbol) params.set("symbol", symbol);
  return apiRequest<RobinhoodOptionOrdersResponse>(
    `/option-orders?${params.toString()}`
  );
}

export async function getRobinhoodWashSaleRisk(): Promise<{
  symbols: RobinhoodWashSaleRiskSymbol[];
  generated_at: string;
}> {
  return apiRequest<{ symbols: RobinhoodWashSaleRiskSymbol[]; generated_at: string }>(
    "/wash-sale-risk"
  );
}

export async function getRobinhoodSellPerformance(
  limit = 100,
  offset = 0,
  symbol?: string
): Promise<RobinhoodSellPerformanceResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (symbol) params.set("symbol", symbol);
  return apiRequest<RobinhoodSellPerformanceResponse>(
    `/sell-performance?${params.toString()}`
  );
}

export async function analyzeRobinhoodOrders(payload: {
  provider: string;
  model: string;
  limit?: number;
  order_ids?: string[];
  language?: "zh" | "en";
}): Promise<RobinhoodOrdersAnalysisResponse> {
  return apiRequest<RobinhoodOrdersAnalysisResponse>("/orders/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function disconnectRobinhood(): Promise<{
  message: string;
  success: boolean;
}> {
  return apiRequest<{ message: string; success: boolean }>("/disconnect", {
    method: "DELETE",
  });
}
