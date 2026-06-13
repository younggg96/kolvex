import type {
  RobinhoodOptionOrder,
  RobinhoodOrder,
  RobinhoodOrdersAnalysisResponse,
} from "@/lib/robinhoodApi";

const API_PREFIX = "/api/ibkr";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || body.detail || `Request failed: ${response.status}`);
  }
  return response.json();
}

export interface IBKRStatus {
  is_connected: boolean;
  last_synced_at?: string | null;
  last_error?: string | null;
  accounts_count: number;
  positions_count: number;
  trades_count: number;
}

export function getIbkrStatus(): Promise<IBKRStatus> {
  return request<IBKRStatus>("/status");
}

export function connectIbkr(payload: {
  flex_token: string;
  flex_query_id: string;
}) {
  return request("/connect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function syncIbkr() {
  return request("/sync", { method: "POST" });
}

export function getIbkrHoldings() {
  return request<any>("/holdings");
}

export interface IBKROrdersResponse<T> {
  orders: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export function getIbkrOrders(
  assetType: "stocks" | "options",
  limit = 100,
  offset = 0,
  symbol?: string
): Promise<IBKROrdersResponse<RobinhoodOrder | RobinhoodOptionOrder>> {
  const params = new URLSearchParams({
    asset_type: assetType,
    limit: String(limit),
    offset: String(offset),
  });
  if (symbol) params.set("symbol", symbol);
  return request(`/orders?${params.toString()}`);
}

export function analyzeIbkrOrders(payload: {
  provider: string;
  model: string;
  limit?: number;
  trade_ids?: string[];
  language?: "zh" | "en";
}): Promise<RobinhoodOrdersAnalysisResponse> {
  return request("/orders/analyze", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function disconnectIbkr() {
  return request("/disconnect", { method: "DELETE" });
}
