/**
 * Dataroma 超级投资者 API
 * 获取机构投资者持仓数据
 */

// ============================================================
// 类型定义
// ============================================================

export interface SuperInvestor {
  id: string;
  name: string;
  code: string;
  description: string | null;
  website: string | null;
  portfolio_value: number | null;
  stock_count: number | null;
  portfolio_date: string | null;
  period: string | null;
  last_scraped_at: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface Holding {
  id: string;
  investor_id: string | null;
  investor_code: string;
  investor_name: string | null;
  ticker: string;
  company_name: string | null;
  sector: string | null;
  shares: number;
  market_value: number | null;
  portfolio_percent: number | null;
  change_percent: number | null;
  change_type: string | null;
  reported_price: number | null;
  current_price: number | null;
  price_change_percent: number | null;
  week_52_low: number | null;
  week_52_high: number | null;
  report_date: string | null;
  quarter: string | null;
  scraped_at: string | null;
}

export interface InvestorSummary {
  investor: SuperInvestor;
  summary: {
    total_positions: number;
    total_market_value: number;
    quarter: string | null;
    report_date: string | null;
  };
  top_holdings: Holding[];
  recent_changes: {
    ticker: string;
    company_name: string | null;
    change_type: string | null;
    change_percent: number | null;
    portfolio_percent: number | null;
  }[];
}

export interface StockHolders {
  ticker: string;
  company_name: string | null;
  quarter: string | null;
  holder_count: number;
  total_shares: number;
  total_market_value: number;
  holders: {
    investor_code: string;
    investor_name: string | null;
    shares: number;
    market_value: number | null;
    portfolio_percent: number | null;
    change_type: string | null;
    change_percent: number | null;
  }[];
}

export interface PopularStock {
  ticker: string;
  company_name: string | null;
  holder_count: number;
  total_market_value: number;
  holders: {
    investor_code: string;
    investor_name?: string;
    shares: number;
    market_value: number | null;
    portfolio_percent: number | null;
    change_type: string | null;
  }[];
}

export interface SyncStatus {
  all: {
    is_running: boolean;
    last_run_at: string | null;
    last_result: Record<string, unknown> | null;
    progress: {
      stage: string;
      current: number;
      total: number;
    } | null;
  };
  investors: {
    is_running: boolean;
    last_run_at: string | null;
    last_result: Record<string, unknown> | null;
  };
  holdings: {
    is_running: boolean;
    last_run_at: string | null;
    last_result: Record<string, unknown> | null;
    progress: Record<string, unknown> | null;
  };
  database: {
    investor_count: number;
    holding_count: number;
    latest_quarter: string | null;
    current_quarter: string | null;
  };
}

// ============================================================
// API 基础配置
// ============================================================

/**
 * 获取 API 基础 URL
 * 客户端使用相对路径通过 Next.js API 代理
 * 服务端需要完整 URL
 */
function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    // 客户端：使用相对路径
    return "";
  }
  // 服务端：需要完整 URL
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/dataroma${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      error.detail || error.error || `API error: ${response.status}`
    );
  }

  const data = await response.json();
  return data.data !== undefined ? data.data : data;
}

// ============================================================
// 投资者 API
// ============================================================

/**
 * 获取投资者列表
 */
export async function getInvestors(params: {
  limit?: number;
  offset?: number;
  search?: string;
  is_active?: boolean;
} = {}): Promise<{ data: SuperInvestor[]; pagination: { total: number; has_more: boolean } }> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));
  if (params.search) searchParams.set("search", params.search);
  if (params.is_active !== undefined) searchParams.set("is_active", String(params.is_active));

  const query = searchParams.toString();
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/api/dataroma/investors${query ? `?${query}` : ""}`,
    { headers: { "Content-Type": "application/json" } }
  );
  
  if (!response.ok) throw new Error("Failed to fetch investors");
  return response.json();
}

/**
 * 获取投资者详情
 */
export async function getInvestor(code: string): Promise<SuperInvestor> {
  return fetchAPI<SuperInvestor>(`/investors/${code}`);
}

/**
 * 获取投资者摘要
 */
export async function getInvestorSummary(code: string): Promise<InvestorSummary> {
  return fetchAPI<InvestorSummary>(`/investors/${code}/summary`);
}

// ============================================================
// 持仓 API
// ============================================================

/**
 * 获取投资者的持仓
 */
export async function getInvestorHoldings(
  code: string,
  quarter?: string
): Promise<{
  investor: { code: string; name: string };
  quarter: string;
  summary: { total_positions: number; total_market_value: number };
  holdings: Holding[];
}> {
  const query = quarter ? `?quarter=${quarter}` : "";
  return fetchAPI(`/holdings/by-investor/${code}${query}`);
}

/**
 * 获取股票的持有者
 */
export async function getStockHolders(
  ticker: string,
  quarter?: string
): Promise<StockHolders> {
  const query = quarter ? `?quarter=${quarter}` : "";
  return fetchAPI<StockHolders>(`/holdings/by-stock/${ticker}${query}`);
}

/**
 * 获取热门股票
 */
export async function getPopularStocks(params: {
  quarter?: string;
  min_holders?: number;
  limit?: number;
} = {}): Promise<PopularStock[]> {
  const searchParams = new URLSearchParams();
  if (params.quarter) searchParams.set("quarter", params.quarter);
  if (params.min_holders) searchParams.set("min_holders", String(params.min_holders));
  if (params.limit) searchParams.set("limit", String(params.limit));

  const query = searchParams.toString();
  return fetchAPI<PopularStock[]>(`/holdings/popular${query ? `?${query}` : ""}`);
}

/**
 * 获取持仓变动
 */
export async function getHoldingChanges(params: {
  quarter?: string;
  change_type?: string;
  limit?: number;
} = {}): Promise<Holding[]> {
  const searchParams = new URLSearchParams();
  if (params.quarter) searchParams.set("quarter", params.quarter);
  if (params.change_type) searchParams.set("change_type", params.change_type);
  if (params.limit) searchParams.set("limit", String(params.limit));

  const query = searchParams.toString();
  return fetchAPI<Holding[]>(`/holdings/changes${query ? `?${query}` : ""}`);
}

// ============================================================
// 同步 API
// ============================================================

/**
 * 获取同步状态
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  return fetchAPI<SyncStatus>("/sync/status");
}

/**
 * 触发全量同步
 */
export async function triggerSyncAll(): Promise<{ success: boolean; message: string }> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/dataroma/sync/all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  
  if (!response.ok) throw new Error("Failed to trigger sync");
  return response.json();
}

// ============================================================
// 辅助函数
// ============================================================

/**
 * 格式化美元金额
 */
export function formatMoney(value: number | null): string {
  if (value === null || value === undefined) return "-";
  
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`;
  }
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  }
  if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * 格式化百分比
 */
export function formatPercent(value: number | null, showSign = false): string {
  if (value === null || value === undefined) return "-";
  const sign = showSign && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/**
 * 格式化股数
 */
export function formatShares(value: number): string {
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

/**
 * 获取变动类型的颜色
 */
export function getChangeTypeColor(changeType: string | null): string {
  switch (changeType) {
    case "new":
    case "buy":
      return "text-emerald-500";
    case "add":
      return "text-green-500";
    case "reduce":
      return "text-orange-500";
    case "sold":
      return "text-red-500";
    default:
      return "text-muted-foreground";
  }
}

/**
 * 获取变动类型的标签
 */
export function getChangeTypeLabel(changeType: string | null): string {
  switch (changeType) {
    case "new":
      return "New";
    case "buy":
      return "Buy";
    case "add":
      return "Add";
    case "reduce":
      return "Reduce";
    case "sold":
      return "Sold";
    default:
      return "-";
  }
}

