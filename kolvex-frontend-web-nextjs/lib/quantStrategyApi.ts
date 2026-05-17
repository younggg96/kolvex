const API_PREFIX = "/api/quant-strategies";

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_PREFIX}${endpoint}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export interface QuantStrategy {
  id: string;
  name: string;
  description?: string | null;
  dsl: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuantAssignment {
  id: string;
  symbol: string;
  strategy_id?: string | null;
  stop_loss_pct?: number | null;
  take_profit_pct?: number | null;
  trailing_stop_pct?: number | null;
}

export interface QuantPreview {
  symbol: string;
  evaluated_at: string;
  signal: string;
  indicators: Record<string, number | null>;
  rules: Array<{ condition: string; action: string; matched: boolean }>;
}

export interface QuantBacktest {
  strategy_id?: string | null;
  symbol: string;
  period: string;
  initial_capital: number;
  final_capital: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  trades_count: number;
  win_rate_pct: number;
  trades: Array<{ date: string; side: string; price: number; reason?: string; pnl?: number }>;
  equity_curve: Array<{ date: string; value: number }>;
}

export async function listQuantStrategies() {
  return apiRequest<{ strategies: QuantStrategy[] }>("");
}

export async function createQuantStrategy(payload: {
  name: string;
  description?: string;
  dsl: string;
  is_active?: boolean;
}) {
  return apiRequest<QuantStrategy>("", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateQuantStrategy(id: string, payload: Partial<QuantStrategy>) {
  return apiRequest<QuantStrategy>(`/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteQuantStrategy(id: string) {
  return apiRequest<void>(`/${id}`, { method: "DELETE" });
}

export async function listQuantAssignments() {
  return apiRequest<{ assignments: QuantAssignment[] }>("/assignments");
}

export async function upsertQuantAssignment(
  symbol: string,
  payload: Omit<QuantAssignment, "id" | "symbol">
) {
  return apiRequest<QuantAssignment>(`/assignments/${symbol}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function previewQuantStrategy(payload: {
  dsl: string;
  symbol: string;
  entry_price: number;
}) {
  return apiRequest<QuantPreview>("/preview", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function runQuantBacktest(payload: {
  strategy_id?: string;
  dsl: string;
  symbol: string;
  period: "6mo" | "1y" | "2y" | "5y";
  initial_capital: number;
}) {
  return apiRequest<QuantBacktest>("/backtest", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
