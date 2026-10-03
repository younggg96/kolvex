const API_PREFIX = "/api/plaid";

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
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
    throw new Error(error.error || error.detail || `Request failed: ${response.status}`);
  }

  return response.json();
}

export interface PlaidConnectionStatus {
  is_connected: boolean;
  last_synced_at?: string | null;
  accounts_count: number;
  holdings_count: number;
  transactions_count: number;
  institution_name?: string | null;
  item_id?: string | null;
}

export interface PlaidLinkTokenResponse {
  link_token: string;
  expiration?: string;
}

export interface PlaidExchangeTokenResponse {
  success: boolean;
  institution_name?: string | null;
  accounts_count?: number;
}

export interface PlaidSyncResponse {
  success: boolean;
  accounts_count?: number;
  holdings_count?: number;
  transactions_count?: number;
  last_synced_at?: string;
}

export interface PlaidInvestmentTransaction {
  id: string;
  investment_transaction_id?: string;
  account_id?: string;
  account_name?: string | null;
  security_id?: string | null;
  symbol?: string | null;
  name?: string | null;
  type?: string | null;
  subtype?: string | null;
  date?: string | null;
  quantity?: number | null;
  price?: number | null;
  amount?: number | null;
  fees?: number | null;
  currency?: string | null;
}

export interface PlaidTransactionsResponse {
  transactions: PlaidInvestmentTransaction[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export function getPlaidStatus(): Promise<PlaidConnectionStatus> {
  return apiRequest<PlaidConnectionStatus>("/status");
}

export function createPlaidLinkToken(): Promise<PlaidLinkTokenResponse> {
  return apiRequest<PlaidLinkTokenResponse>("/link-token", { method: "POST" });
}

export function exchangePlaidPublicToken(payload: {
  public_token: string;
  institution?: { name?: string | null; institution_id?: string | null };
  accounts?: Array<{ id: string; name?: string | null; mask?: string | null; type?: string | null; subtype?: string | null }>;
}): Promise<PlaidExchangeTokenResponse> {
  return apiRequest<PlaidExchangeTokenResponse>("/exchange-token", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function syncPlaidInvestments(): Promise<PlaidSyncResponse> {
  return apiRequest<PlaidSyncResponse>("/sync", { method: "POST" });
}

export function getPlaidInvestmentTransactions(
  limit = 100,
  offset = 0,
  symbol?: string,
): Promise<PlaidTransactionsResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (symbol) params.set("symbol", symbol);
  return apiRequest<PlaidTransactionsResponse>(`/transactions?${params.toString()}`);
}

export function disconnectPlaid(): Promise<{ success: boolean; message?: string }> {
  return apiRequest<{ success: boolean; message?: string }>("/disconnect", {
    method: "DELETE",
  });
}
