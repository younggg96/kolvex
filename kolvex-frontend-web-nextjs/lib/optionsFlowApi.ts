/**
 * Options Flow API Client
 * Endpoints for unusual options activity monitoring
 * Uses Next.js API proxy routes to avoid CSP issues
 */

// ==================== Types ====================

export interface UnusualActivityItem {
  id?: string;
  symbol: string;
  company_name?: string;
  contract_symbol: string;
  option_type: "call" | "put";
  strike: number;
  expiration: string;
  volume: number;
  open_interest: number;
  vol_oi_ratio: number;
  implied_volatility: number;
  last_price: number;
  bid: number;
  ask: number;
  premium: number;
  stock_price: number;
  in_the_money: boolean;
  signal_types: string[];
  signal_strength: number;
  detected_at: string;
}

export interface UnusualActivityResponse {
  data: UnusualActivityItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface LiveScanResponse {
  symbol: string;
  total: number;
  data: UnusualActivityItem[];
}

export interface ScanRequest {
  symbols?: string[];
  max_expirations?: number;
  save?: boolean;
}

export interface ScanResponse {
  total_scanned_symbols: number;
  total_unusual_found: number;
  saved_count: number;
  results: UnusualActivityItem[];
}

export interface OptionsFlowStats {
  period_hours: number;
  total_signals: number;
  total_premium: number;
  by_type: { call: number; put: number };
  top_symbols: {
    symbol: string;
    count: number;
    premium: number;
  }[];
  top_contracts: {
    contract_symbol: string;
    symbol: string;
    option_type: string;
    strike: number;
    expiration: string;
    premium: number;
    vol_oi_ratio: number;
  }[];
  avg_vol_oi_ratio: number;
  call_put_ratio: number;
}

export type OptionTypeFilter = "call" | "put";

// ==================== Options Chain Types ====================

export interface OptionContract {
  contract_symbol?: string;
  strike: number;
  last_price: number;
  bid: number;
  ask: number;
  change: number;
  percent_change: number;
  volume: number;
  open_interest: number;
  implied_volatility: number;
  in_the_money: boolean;
}

export interface OptionsChainData {
  symbol: string;
  expiration: string;
  calls: OptionContract[];
  puts: OptionContract[];
}

export interface OptionsOverview {
  symbol: string;
  expirations: string[];
  options_chain: {
    expiration: string;
    calls: OptionContract[];
    puts: OptionContract[];
  } | null;
  error?: string;
}

// ==================== Helpers ====================

async function fetchApi(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Use Next.js API proxy to avoid CSP issues
  // endpoint is like "/options-flow/unusual" → proxy at "/api/options-flow/unusual"
  const proxyPath = endpoint.replace(/^\/options-flow/, "/api/options-flow");

  return fetch(proxyPath, {
    ...options,
    headers,
  });
}

// ==================== API Functions ====================

/**
 * Get recent unusual options activity from database
 */
export async function getUnusualActivity(params?: {
  symbol?: string;
  option_type?: OptionTypeFilter;
  min_premium?: number;
  min_vol_oi?: number;
  limit?: number;
  offset?: number;
}): Promise<UnusualActivityResponse> {
  const searchParams = new URLSearchParams();

  if (params?.symbol) searchParams.append("symbol", params.symbol);
  if (params?.option_type)
    searchParams.append("option_type", params.option_type);
  if (params?.min_premium)
    searchParams.append("min_premium", String(params.min_premium));
  if (params?.min_vol_oi)
    searchParams.append("min_vol_oi", String(params.min_vol_oi));
  if (params?.limit) searchParams.append("limit", String(params.limit));
  if (params?.offset) searchParams.append("offset", String(params.offset));

  const response = await fetchApi(
    `/options-flow/unusual?${searchParams.toString()}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch unusual options activity");
  }

  return response.json();
}

/**
 * Perform a live scan of a single symbol
 */
export async function liveScanSymbol(
  symbol: string,
  maxExpirations?: number
): Promise<LiveScanResponse> {
  const params = new URLSearchParams();
  if (maxExpirations)
    params.append("max_expirations", String(maxExpirations));

  const response = await fetchApi(
    `/options-flow/live/${symbol.toUpperCase()}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(`Live scan failed for ${symbol}`);
  }

  return response.json();
}

/**
 * Trigger a batch scan of multiple symbols
 */
export async function scanOptionsFlow(
  data?: ScanRequest
): Promise<ScanResponse> {
  const response = await fetchApi("/options-flow/scan", {
    method: "POST",
    body: JSON.stringify(data || {}),
  });

  if (!response.ok) {
    throw new Error("Options flow scan failed");
  }

  return response.json();
}

/**
 * Get options flow statistics
 */
export async function getOptionsFlowStats(
  hours?: number
): Promise<OptionsFlowStats> {
  const params = hours ? `?hours=${hours}` : "";
  const response = await fetchApi(`/options-flow/stats${params}`);

  if (!response.ok) {
    throw new Error("Failed to fetch options flow stats");
  }

  return response.json();
}

// ==================== Options Chain API ====================

/**
 * Get options overview for a symbol (expirations + nearest chain)
 */
export async function getOptionsOverview(
  symbol: string
): Promise<OptionsOverview> {
  const response = await fetch(
    `/api/market/options/${symbol.toUpperCase()}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch options for ${symbol}`);
  }

  return response.json();
}

/**
 * Get options chain for a specific expiration date
 */
export async function getOptionsChain(
  symbol: string,
  expiration: string
): Promise<OptionsChainData> {
  const response = await fetch(
    `/api/market/options/${symbol.toUpperCase()}/${expiration}`
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch options chain for ${symbol} ${expiration}`);
  }

  return response.json();
}
