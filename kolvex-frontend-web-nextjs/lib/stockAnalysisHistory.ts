import type { AiTechnicalAnalysis } from "./stockApi";
import type { PriceBar } from "./stockApi";
import type { TradingAnalysis, AnalysisAuthor } from "./tradingAnalysisApi";
export type AnalysisPayload = AiTechnicalAnalysis | TradingAnalysis;
export interface AnalysisVersion<T = AnalysisPayload> {
  id: string;
  user_id: string;
  is_owner: boolean;
  author?: AnalysisAuthor;
  ticker: string;
  kind: "technical" | "drawings" | "research";
  created_at: string;
  payload: T;
  request: Record<string, unknown>;
  bars?: PriceBar[];
}
export interface AnalysisHistory<T> {
  items: AnalysisVersion<T>[];
  total: number;
  current: AnalysisVersion<T> | null;
}
export class HistoryError extends Error {
  constructor(public status: number) { super("Analysis history unavailable"); }
}
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/market/analysis-history/${path}`, { cache: "no-store", ...options });
  if (!response.ok) throw new HistoryError(response.status);
  return response.json();
}
export function getStockAnalysisHistory<T>(ticker: string, kind: string, offset = 0, signal?: AbortSignal, scope: "all" | "mine" = "all") {
  return request<AnalysisHistory<T>>(`${encodeURIComponent(ticker)}?kind=${kind}&limit=10&offset=${offset}&scope=${scope}`, { signal });
}
export function activateStockAnalysis<T>(ticker: string, id: string, currentId: string | null) {
  return request<AnalysisVersion<T>>(`${encodeURIComponent(ticker)}/${encodeURIComponent(id)}/current`, {
    method: "PATCH", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expected_current_id: currentId }),
  });
}
export function getStockAnalysisVersion<T>(ticker: string, id: string, signal?: AbortSignal) {
  return request<AnalysisVersion<T>>(`${encodeURIComponent(ticker)}/${encodeURIComponent(id)}`, { signal });
}
export interface AnalysisIndexItem {
  id: string; ticker: string; created_at: string;
  bias: "bullish" | "bearish" | "neutral" | null;
  summary: string | null; signals: string[];
  setup: import("./stockApi").AiTechnicalAnalysis["setup"] | null;
}
export interface AnalysisIndex { technical: AnalysisIndexItem[]; planned: AnalysisIndexItem[] }
export function getStockAnalysisIndex(signal?: AbortSignal) {
  return request<AnalysisIndex>("_index", { signal });
}
