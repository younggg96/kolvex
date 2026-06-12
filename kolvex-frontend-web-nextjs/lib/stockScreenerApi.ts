/**
 * Stock Screener API Client
 */

// ==================== Types ====================

export interface RangeFilter {
  min?: number;
  max?: number;
}

export interface ScreenRequest {
  strategy_id?: string;
  filters?: Record<string, RangeFilter>;
  sectors?: string[];
  sort_by?: string;
  sort_direction?: "asc" | "desc";
  page?: number;
  page_size?: number;
}

export interface StockSnapshot {
  symbol: string;
  name: string;
  sector?: string;
  industry?: string;
  current_price: number;
  previous_close: number;
  change_percent: number;
  change_percent_5d: number;
  volume: number;
  market_cap: number;
  fifty_two_week_high: number;
  fifty_two_week_low: number;
  pct_from_52w_high: number;
  pct_from_52w_low: number;
  pe_ratio: number;
  forward_pe: number;
  peg_ratio: number;
  price_to_book: number;
  price_to_sales: number;
  ev_to_revenue: number;
  ev_to_ebitda: number;
  profit_margins: number;
  operating_margins: number;
  gross_margins: number;
  return_on_assets: number;
  return_on_equity: number;
  revenue_growth: number;
  earnings_growth: number;
  quarterly_earnings_growth: number;
  quarterly_revenue_growth: number;
  eps_trailing: number;
  eps_forward: number;
  dividend_yield: number;
  debt_to_equity: number;
  current_ratio: number;
  free_cash_flow: number;
}

export interface ScreenResponse {
  results: StockSnapshot[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  cache_status?: "ready" | "warming";
  message?: string | null;
}

export interface Strategy {
  id: string;
  name: string;
  name_zh: string;
  description: string;
  description_zh: string;
  icon: string;
  filters: Record<string, RangeFilter>;
  sort_by: string;
  sort_direction: string;
}

export interface DimensionScores {
  fundamental: number;
  valuation: number;
  growth: number;
  risk: number;
}

export interface AIStockScore {
  symbol: string;
  ai_score: number;
  dimension_scores: DimensionScores;
  one_liner: string;
}

export interface AIAnalysisResult {
  stocks: AIStockScore[];
  summary: string;
}

export interface ScreenerPreset {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  filters: Record<string, any>;
  sectors?: string[];
  sort_by: string;
  sort_direction: string;
  created_at: string;
  updated_at: string;
}

// ==================== API Functions ====================

const BASE = "/api/stock-screener";

export async function getStrategies(): Promise<Strategy[]> {
  const res = await fetch(`${BASE}/strategies`);
  if (!res.ok) throw new Error("Failed to fetch strategies");
  return res.json();
}

export async function screenStocks(
  params: ScreenRequest
): Promise<ScreenResponse> {
  const res = await fetch(`${BASE}/screen`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Screening failed");
  }
  return res.json();
}

export async function aiAnalyze(
  symbols: string[]
): Promise<AIAnalysisResult> {
  const res = await fetch(`${BASE}/ai-analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbols }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "AI analysis failed");
  }
  return res.json();
}

export async function getPresets(): Promise<ScreenerPreset[]> {
  const res = await fetch(`${BASE}/presets`);
  if (!res.ok) throw new Error("Failed to fetch presets");
  return res.json();
}

export async function createPreset(preset: {
  name: string;
  description?: string;
  filters: Record<string, any>;
  sectors?: string[];
  sort_by?: string;
  sort_direction?: string;
}): Promise<ScreenerPreset> {
  const res = await fetch(`${BASE}/presets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preset),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save preset");
  }
  return res.json();
}

export async function deletePreset(id: string): Promise<void> {
  const res = await fetch(`${BASE}/presets/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete preset");
  }
}

// ==================== Constants ====================

export const SECTOR_OPTIONS = [
  "Technology",
  "Health Care",
  "Financials",
  "Consumer Discretionary",
  "Communication Services",
  "Industrials",
  "Consumer Staples",
  "Energy",
  "Utilities",
  "Real Estate",
  "Materials",
] as const;

export const FILTER_DEFINITIONS = [
  {
    group: "Valuation",
    group_zh: "估值",
    fields: [
      { key: "pe_ratio", label: "P/E Ratio", label_zh: "市盈率", step: 1 },
      { key: "forward_pe", label: "Forward P/E", label_zh: "远期市盈率", step: 1 },
      { key: "peg_ratio", label: "PEG Ratio", label_zh: "PEG", step: 0.1 },
      { key: "price_to_book", label: "P/B Ratio", label_zh: "市净率", step: 0.5 },
      { key: "ev_to_ebitda", label: "EV/EBITDA", label_zh: "EV/EBITDA", step: 1 },
    ],
  },
  {
    group: "Profitability",
    group_zh: "盈利能力",
    fields: [
      { key: "return_on_equity", label: "ROE", label_zh: "净资产收益率", step: 0.01, pct: true },
      { key: "return_on_assets", label: "ROA", label_zh: "总资产收益率", step: 0.01, pct: true },
      { key: "profit_margins", label: "Profit Margin", label_zh: "利润率", step: 0.01, pct: true },
      { key: "operating_margins", label: "Operating Margin", label_zh: "营业利润率", step: 0.01, pct: true },
    ],
  },
  {
    group: "Growth",
    group_zh: "增长",
    fields: [
      { key: "revenue_growth", label: "Revenue Growth", label_zh: "营收增长率", step: 0.01, pct: true },
      { key: "earnings_growth", label: "Earnings Growth", label_zh: "利润增长率", step: 0.01, pct: true },
    ],
  },
  {
    group: "Financial Health",
    group_zh: "财务健康",
    fields: [
      { key: "debt_to_equity", label: "Debt/Equity", label_zh: "资产负债率", step: 10 },
      { key: "current_ratio", label: "Current Ratio", label_zh: "流动比率", step: 0.5 },
    ],
  },
  {
    group: "Size & Dividend",
    group_zh: "规模与分红",
    fields: [
      { key: "market_cap", label: "Market Cap", label_zh: "市值", step: 1_000_000_000 },
      { key: "dividend_yield", label: "Dividend Yield", label_zh: "股息率", step: 0.005, pct: true },
    ],
  },
  {
    group: "Technical",
    group_zh: "技术面",
    fields: [
      { key: "change_percent", label: "Day Change %", label_zh: "日涨跌幅", step: 1 },
      { key: "change_percent_5d", label: "5D Change %", label_zh: "5日涨跌幅", step: 1 },
      { key: "pct_from_52w_high", label: "% from 52W High", label_zh: "距52周高点%", step: 5 },
      { key: "pct_from_52w_low", label: "% from 52W Low", label_zh: "距52周低点%", step: 5 },
    ],
  },
] as const;
