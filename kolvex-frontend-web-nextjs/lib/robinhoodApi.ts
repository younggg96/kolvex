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
}

export interface RobinhoodStatus {
  is_connected: boolean;
  last_synced_at?: string | null;
  profile?: Record<string, unknown> | null;
  positions_count: number;
  orders_count: number;
}

export interface RobinhoodConnectResponse extends RobinhoodStatus {
  success: boolean;
  positions_synced: number;
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
  return apiRequest<RobinhoodStatus>("/status");
}

export async function disconnectRobinhood(): Promise<{
  message: string;
  success: boolean;
}> {
  return apiRequest<{ message: string; success: boolean }>("/disconnect", {
    method: "DELETE",
  });
}
