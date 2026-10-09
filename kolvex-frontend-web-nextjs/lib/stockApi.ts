import type { TechnicalFocus, TechnicalCategory } from "./technicalFocus";
// Stock API types and utilities

export interface StockQuote {
  symbol: string;
  name?: string;
  price: number;
  change: number;
  changePercent: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  avgVolume?: number;
  previousClose?: number;
  marketCap?: number;
  week52High?: number;
  week52Low?: number;
  peRatio?: number;
  eps?: number;
  dividend?: number;
  dividendYield?: number;
  updatedAt?: string;
}

export async function getStockQuote(symbol: string): Promise<StockQuote> {
  const response = await fetch(`/api/stocks?action=quote&symbol=${encodeURIComponent(symbol)}`);
  const data = await response.json();
  if (!response.ok || !Number.isFinite(data.price) || data.price <= 0) throw new Error("Market price unavailable");
  return data as StockQuote;
}

export interface StockNewsItem {
  uuid: string;
  title: string;
  publisher: string | null;
  link: string;
  publish_time: number | null;
}

export async function getStockNews(symbol: string): Promise<StockNewsItem[]> {
  const response = await fetch(`/api/market/news/${encodeURIComponent(symbol)}`);
  if (!response.ok) throw new Error("Stock news unavailable");
  const data = await response.json();
  return Array.isArray(data.news) ? data.news : [];
}

export interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  updatedAt?: string;
}

export interface ChartData {
  time: string;
  value: number;
  volume?: number;
}

export interface ChartDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// New interfaces for Stock Overview API
export interface APIStockQuote {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  current_price: number;
  previous_close: number;
  open: number;
  day_high: number;
  day_low: number;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
  change: number;
  change_percent: number;
  volume: number;
  avg_volume: number;
  avg_volume_10day: number;
  market_cap: number;
  market_time: number;
  pre_market_price: number | null;
  post_market_price: number | null;
}

export interface APICompanyProfile {
  symbol: string;
  name: string;
  long_name: string;
  sector: string;
  industry: string;
  country: string;
  city: string;
  state: string;
  address: string;
  zip: string;
  phone: string;
  website: string;
  employees: number;
  business_summary: string;
  logo_url: string | null;
}

export interface APIFinancials {
  symbol: string;
  pe_ratio: number;
  forward_pe: number;
  peg_ratio: number | null;
  price_to_book: number;
  price_to_sales: number;
  enterprise_value: number;
  ev_to_revenue: number;
  ev_to_ebitda: number;
  profit_margins: number;
  operating_margins: number;
  gross_margins: number;
  ebitda_margins: number;
  return_on_assets: number;
  return_on_equity: number;
  total_revenue: number;
  revenue_per_share: number;
  revenue_growth: number;
  earnings_growth: number;
  quarterly_earnings_growth: number;
  quarterly_revenue_growth: number | null;
  gross_profits: number;
  ebitda: number;
  net_income: number;
  eps_trailing: number;
  eps_forward: number;
  book_value: number;
  total_cash: number;
  total_cash_per_share: number;
  total_debt: number;
  debt_to_equity: number;
  current_ratio: number;
  quick_ratio: number;
  free_cash_flow: number;
  operating_cash_flow: number;
}

export interface StockOverview {
  symbol: string;
  quote: APIStockQuote;
  company: APICompanyProfile;
  financials: APIFinancials;
}

export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
}

export interface PriceHistoryParams {
  period?: string;
  interval?: string;
  start?: string;
  end?: string;
}

/**
 * Daily (or weekly) OHLCV bars; the backend needs both start and end for a date window.
 */
export async function getStockHistory(
  symbol: string,
  params: PriceHistoryParams = {},
  signal?: AbortSignal
): Promise<PriceBar[]> {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) searchParams.set(key, value);
  }
  const qs = searchParams.toString();
  const response = await fetch(
    `/api/market/history/${encodeURIComponent(symbol)}${qs ? `?${qs}` : ""}`,
    { signal }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `API error: ${response.status}`);
  }
  return ((data.data || []) as Array<Partial<PriceBar>>).filter(
    (bar): bar is PriceBar =>
      typeof bar.date === "string" &&
      [bar.open, bar.high, bar.low, bar.close].every(
        (value) => typeof value === "number" && Number.isFinite(value)
      )
  );
}

export interface AiChartPoint {
  date: string;
  price: number;
}

export interface AiTechnicalAnalysis {
  operation?: "analysis" | "drawings";
  categories?: TechnicalCategory[];
  custom_scenarios?: string[];
  findings?: Array<{ id: string; status: "available" | "unavailable"; explanation: string }>;
  version_id?: string;
  saved_at?: string;
  symbol: string;
  interval: string;
  view: { start: string; end: string };
  generated_at: string;
  indicators: Record<string, number | null>;
  trend: "uptrend" | "downtrend" | "sideways";
  bias: "bullish" | "bearish" | "neutral";
  summary: string;
  levels: Array<{ kind: "support" | "resistance"; price: number; strength: "weak" | "medium" | "strong"; reason: string }>;
  trendlines: Array<{ kind: "support" | "resistance"; start: AiChartPoint; end: AiChartPoint; reason: string }>;
  fib: { from: AiChartPoint; to: AiChartPoint } | null;
  signals: string[];
  invalidation: string | null;
  setup?: {
    name: string;
    direction: "bullish" | "bearish";
    entry_low: number;
    entry_high: number;
    invalidation: number;
    targets: number[];
    reason: string;
    risk_reward: number;
    score: number | null;
    checks: Record<string, boolean | null>;
  } | null;
}

export class AiAnalysisError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function getAiTechnicalAnalysis(
  symbol: string,
  body: PriceHistoryParams & Partial<TechnicalFocus> & { view_start?: string; view_end?: string; locale?: string; operation?: "analysis" | "drawings" },
  signal?: AbortSignal
): Promise<AiTechnicalAnalysis> {
  const response = await fetch(`/api/market/ai-technical/${encodeURIComponent(symbol)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new AiAnalysisError(data.error || `API error: ${response.status}`, response.status);
  }
  return data as AiTechnicalAnalysis;
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * Format change percent for display
 */
export function formatChangePercent(percent: number): string {
  const sign = percent >= 0 ? "+" : "";
  return `${sign}${percent.toFixed(2)}%`;
}

/**
 * Get color class based on change
 */
export function getChangeColor(change: number): string {
  if (change > 0) return "text-green-500";
  if (change < 0) return "text-red-500";
  return "text-gray-500";
}

/**
 * Format volume for display
 */
export function formatVolume(volume: number): string {
  if (volume >= 1e9) {
    return (volume / 1e9).toFixed(2) + "B";
  }
  if (volume >= 1e6) {
    return (volume / 1e6).toFixed(2) + "M";
  }
  if (volume >= 1e3) {
    return (volume / 1e3).toFixed(2) + "K";
  }
  return volume.toString();
}

/**
 * Format market cap for display
 */
export function formatMarketCap(marketCap: number): string {
  if (marketCap >= 1e12) {
    return "$" + (marketCap / 1e12).toFixed(2) + "T";
  }
  if (marketCap >= 1e9) {
    return "$" + (marketCap / 1e9).toFixed(2) + "B";
  }
  if (marketCap >= 1e6) {
    return "$" + (marketCap / 1e6).toFixed(2) + "M";
  }
  return "$" + marketCap.toFixed(0);
}
