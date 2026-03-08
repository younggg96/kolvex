/**
 * Trading Analysis API Client
 * Multi-agent trading analysis (TradingAgents integration)
 */

// ==================== Types ====================

export interface AnalysisAuthor {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}

export interface TradingAnalysis {
  id: string;
  user_id?: string;
  ticker: string;
  trade_date: string;
  status: "pending" | "running" | "completed" | "failed";
  selected_analysts: string[];
  llm_provider: string | null;
  deep_think_model?: string | null;
  quick_think_model?: string | null;
  market_report?: string | null;
  sentiment_report?: string | null;
  news_report?: string | null;
  fundamentals_report?: string | null;
  investment_debate?: InvestmentDebate | null;
  investment_plan?: string | null;
  trader_plan?: string | null;
  risk_debate?: RiskDebate | null;
  final_decision?: string | null;
  full_signal?: string | null;
  error_message?: string | null;
  duration_seconds?: number | null;
  is_published?: boolean;
  published_at?: string | null;
  created_at: string;
  completed_at?: string | null;
  author?: AnalysisAuthor | null;
}

export interface InvestmentDebate {
  bull_history: string;
  bear_history: string;
  history: string;
  current_response: string;
  judge_decision: string;
}

export interface RiskDebate {
  aggressive_history: string;
  conservative_history: string;
  neutral_history: string;
  history: string;
  judge_decision: string;
}

export interface TradingAnalysisListResponse {
  items: TradingAnalysis[];
  total: number;
  limit: number;
  offset: number;
}

export interface StartAnalysisParams {
  ticker: string;
  trade_date: string;
  provider?: string;
  deep_think_model?: string;
  quick_think_model?: string;
  selected_analysts?: string[];
  max_debate_rounds?: number;
  max_risk_discuss_rounds?: number;
}

export interface ProgressEvent {
  stage: string;
  message?: string;
  node?: string;
  elapsed?: number;
  status?: string;
  decision?: string;
  final_decision?: string;
  error_message?: string;
  detail?: string;
  detail_type?: "tool_call" | "tool_result" | "thinking" | "report_preview";
}

// ==================== Helpers ====================

const API_PREFIX = "/api/trading-analysis";

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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || errorData.detail || `API error: ${response.status}`
    );
  }

  return response.json();
}

// ==================== API Functions ====================

export async function startAnalysis(
  params: StartAnalysisParams
): Promise<TradingAnalysis> {
  return apiRequest<TradingAnalysis>("/start", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getAnalysis(id: string): Promise<TradingAnalysis> {
  return apiRequest<TradingAnalysis>(`/${id}`);
}

export async function getAnalysisHistory(params?: {
  limit?: number;
  offset?: number;
  ticker?: string;
}): Promise<TradingAnalysisListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.append("limit", String(params.limit));
  if (params?.offset) searchParams.append("offset", String(params.offset));
  if (params?.ticker) searchParams.append("ticker", params.ticker);

  const qs = searchParams.toString();
  return apiRequest<TradingAnalysisListResponse>(
    `/history${qs ? `?${qs}` : ""}`
  );
}

export async function deleteAnalysis(
  id: string
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/${id}`, {
    method: "DELETE",
  });
}

export async function publishAnalysis(
  id: string
): Promise<TradingAnalysis> {
  return apiRequest<TradingAnalysis>(`/${id}/publish`, {
    method: "PATCH",
  });
}

export async function unpublishAnalysis(
  id: string
): Promise<TradingAnalysis> {
  return apiRequest<TradingAnalysis>(`/${id}/unpublish`, {
    method: "PATCH",
  });
}

export async function getPublishedAnalyses(params?: {
  limit?: number;
  offset?: number;
  ticker?: string;
}): Promise<TradingAnalysisListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.limit) searchParams.append("limit", String(params.limit));
  if (params?.offset) searchParams.append("offset", String(params.offset));
  if (params?.ticker) searchParams.append("ticker", params.ticker);

  const qs = searchParams.toString();
  return apiRequest<TradingAnalysisListResponse>(
    `/published/list${qs ? `?${qs}` : ""}`
  );
}

export async function getPublishedAnalysis(
  id: string
): Promise<TradingAnalysis> {
  return apiRequest<TradingAnalysis>(`/published/${id}`);
}

export function streamAnalysisProgress(
  id: string,
  onEvent: (event: ProgressEvent) => void,
  onError?: (error: Error) => void,
  onDone?: () => void
): () => void {
  const url = `${API_PREFIX}/${id}/stream`;
  const eventSource = new EventSource(url);
  let errorCount = 0;
  let receivedAnyData = false;
  let closed = false;

  const DATA_TIMEOUT_MS = 30_000;
  let dataTimer: ReturnType<typeof setTimeout> | null = null;

  const resetDataTimer = () => {
    if (dataTimer) clearTimeout(dataTimer);
    if (closed) return;
    dataTimer = setTimeout(() => {
      if (!closed && !receivedAnyData) {
        console.warn("SSE: no data events received within timeout, closing");
        cleanup();
        onError?.(new Error("SSE data timeout"));
      }
    }, DATA_TIMEOUT_MS);
  };

  const cleanup = () => {
    if (closed) return;
    closed = true;
    if (dataTimer) clearTimeout(dataTimer);
    eventSource.close();
  };

  resetDataTimer();

  eventSource.onmessage = (event) => {
    errorCount = 0;
    receivedAnyData = true;
    if (dataTimer) clearTimeout(dataTimer);
    dataTimer = null;
    try {
      const data: ProgressEvent = JSON.parse(event.data);
      onEvent(data);

      if (data.stage === "done") {
        cleanup();
        onDone?.();
      }
    } catch (e) {
      console.error("Failed to parse SSE event:", e);
    }
  };

  eventSource.onerror = () => {
    errorCount++;
    if (errorCount > 3 || (errorCount > 1 && !receivedAnyData)) {
      console.error(
        `SSE stream closed after ${errorCount} consecutive errors`
      );
      cleanup();
      onError?.(new Error("SSE connection lost"));
    }
  };

  return cleanup;
}
