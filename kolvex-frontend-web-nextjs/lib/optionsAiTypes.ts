import type { UnusualActivityItem } from "./optionsFlowApi";

// ==================== Helpers ====================

/** Filter out LLM schema placeholder descriptions (e.g. "string") from risk management text */
export function isPlaceholderDescription(text: string | undefined): boolean {
  if (!text || typeof text !== "string") return true;
  const t = text.trim().toLowerCase();
  if (t.length < 12) return true;
  const placeholders = ["string", "description", "...", "n/a", "tbd"];
  return placeholders.includes(t) || placeholders.some((p) => t === p);
}

// ==================== Risk Profiles ====================

export type RiskProfile = "conservative" | "aggressive" | "hedging";

// ==================== AI Response Models ====================

export interface AIContractRecommendation {
  contract_symbol: string;
  symbol: string;
  option_type: "call" | "put";
  strike: number;
  expiration: string;
  last_price: number;
  implied_volatility: number;
  signal_explanation: string;
  confidence: "high" | "medium" | "low";
}

export interface PriceBasedStopLoss {
  type: "price";
  trigger_price: number;
  description: string;
}

export interface PremiumBasedStopLoss {
  type: "premium";
  drawdown_percent: number;
  description: string;
}

export interface TimeBasedStopLoss {
  type: "time";
  days_to_expiry_warning: number;
  description: string;
}

export interface StopLossRules {
  price_based: PriceBasedStopLoss;
  premium_based: PremiumBasedStopLoss;
  time_based: TimeBasedStopLoss;
}

export interface TakeProfitTarget {
  target_percent: number;
  description: string;
}

export interface RiskManagement {
  stop_loss: StopLossRules;
  take_profit: TakeProfitTarget[];
  position_size_suggestion: string;
}

export interface MarketContext {
  overall_sentiment: "bullish" | "bearish" | "neutral";
  key_observations: string[];
}

export interface AITradingResponse {
  risk_profile: RiskProfile;
  market_context: MarketContext;
  recommendation: AIContractRecommendation;
  risk_management: RiskManagement;
  disclaimer: string;
}

// ==================== Persisted Analysis Record ====================

export interface OptionsAIAnalysisRecord {
  id: string;
  user_id: string;
  user_name?: string;
  user_avatar?: string;
  symbol: string | null;
  risk_profile: RiskProfile;
  model: string;
  locale: string;
  input_summary: {
    signal_count: number;
    top_symbols: string[];
    total_premium: number;
    call_count: number;
    put_count: number;
  };
  ai_response: AITradingResponse;
  created_at: string;
}

export interface OptionsAIHistoryResponse {
  data: OptionsAIAnalysisRecord[];
  total: number;
  limit: number;
  offset: number;
}

// ==================== Request/Response ====================

export interface OptionsAIRequest {
  options_data: UnusualActivityItem[];
  risk_profile: RiskProfile;
  locale: string;
  model?: string;
}

export interface OptionsAIErrorResponse {
  error: string;
  details?: string;
}
