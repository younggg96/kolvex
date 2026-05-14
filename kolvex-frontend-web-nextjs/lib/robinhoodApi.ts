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
}

export interface RobinhoodConnectResponse extends RobinhoodStatus {
  success: boolean;
  positions_synced: number;
  approval_required?: boolean;
  message?: string | null;
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
}

export interface RobinhoodOrdersResponse {
  orders: RobinhoodOrder[];
  total: number;
  limit: number;
  offset: number;
}

export async function connectRobinhood(
  payload: RobinhoodConnectRequest
): Promise<RobinhoodConnectResponse> {
  return apiRequest<RobinhoodConnectResponse>("/connect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function syncRobinhood(): Promise<{
  message: string;
  success: boolean;
}> {
  return apiRequest<{ message: string; success: boolean }>("/sync", {
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
  offset = 0
): Promise<RobinhoodOrdersResponse> {
  return apiRequest<RobinhoodOrdersResponse>(
    `/orders?limit=${limit}&offset=${offset}`
  );
}

export async function disconnectRobinhood(): Promise<{
  message: string;
  success: boolean;
}> {
  return apiRequest<{ message: string; success: boolean }>("/disconnect", {
    method: "DELETE",
  });
}
