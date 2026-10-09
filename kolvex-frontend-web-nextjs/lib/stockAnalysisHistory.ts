import type { AiTechnicalAnalysis } from "./stockApi";
import type { PriceBar } from "./stockApi";
import type { TradingAnalysis } from "./tradingAnalysisApi";
export type AnalysisPayload = AiTechnicalAnalysis | TradingAnalysis;
export interface AnalysisVersion<T = AnalysisPayload> {
  id: string;
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
export function getStockAnalysisHistory<T>(ticker: string, kind: string, offset = 0, signal?: AbortSignal) {
  return request<AnalysisHistory<T>>(`${encodeURIComponent(ticker)}?kind=${kind}&limit=10&offset=${offset}`, { signal });
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
