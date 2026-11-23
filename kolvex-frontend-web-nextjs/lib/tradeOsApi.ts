import { invalidateClientCache } from "./clientCache";

export const TRADE_OS_API_PREFIX = "/api/trade-os";

export interface TradingAccount {
  id: string;
  user_id: string;
  broker: string;
  account_name: string;
  account_type: string;
  initial_equity: number | null;
  connection_status: string;
  execution_capability: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportBatch {
  id: string;
  account_id: string;
  source: string;
  file_name: string;
  record_count: number;
  imported_count: number;
  duplicate_count: number;
  error_count: number;
  status: "pending" | "processing" | "completed" | "failed";
  errors: any;
  created_at: string;
}

export interface ExecutionRecord {
  id: string;
  account_id: string;
  source_execution_id: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  amount: number;
  fees: number;
  executed_at: string;
  activity_type: string;
  instrument_type: string;
  description: string;
  source: string;
}

export interface TradeGroup {
  id: string;
  account_id: string;
  symbol: string;
  side: "long" | "short";
  status: "open" | "closed" | "partial";
  open_quantity: number;
  total_buy_quantity: number;
  total_sell_quantity: number;
  average_entry_price: number;
  realized_pnl: number;
  total_fees: number;
  first_entry_at: string;
  last_activity_at: string;
  closed_at: string | null;
}

export interface ReconciliationIssue {
  id: string;
  account_id: string;
  issue_type: string;
  symbol: string | null;
  description: string;
  raw_data: any;
  resolution: "pending" | "resolved" | "ignored";
  created_at: string;
}

export interface EquitySnapshot {
  id: string;
  account_id: string;
  snapshot_at: string;
  net_liquidation_value: number;
  cash_balance: number | null;
  securities_value: number | null;
  buying_power: number | null;
  source: string;
  quality_status: string;
}

export interface StrategyVersion {
  id: string;
  user_id: string;
  strategy_key: string;
  version: string;
  display_name: string;
  status: string;
  parameters: any;
  entry_rules: any[];
  exit_rules: any[];
  risk_rules: any;
  description: string | null;
  config_hash: string;
  created_at: string;
}

export interface TradePlan {
  id: string;
  user_id: string;
  account_id: string;
  strategy_version_id: string | null;
  symbol: string;
  side: "long" | "short";
  planned_entry: number;
  planned_stop: number;
  planned_target: number;
  planned_quantity: number;
  planned_risk_per_share: number;
  planned_risk_amount: number;
  planned_notional: number;
  reward_risk_ratio: number | null;
  setup_reason: string;
  invalidation_reason: string;
  status:
    | "draft"
    | "validating"
    | "approved"
    | "executed"
    | "open"
    | "closed"
    | "blocked"
    | "expired"
    | "cancelled"
    | "review_required";
  approved_at: string | null;
  expires_at: string | null;
  created_at: string;
  latest_assessment?: RiskAssessment | null;
}

export interface RiskCheckItem {
  rule: string;
  passed: boolean;
  current_value: string;
  threshold: string;
  message: string;
  severity: "error" | "warning";
}

export interface RiskAssessment {
  id: string;
  trade_plan_id: string;
  rule_version: string;
  account_snapshot: any;
  market_snapshot: any;
  decision: "approved" | "blocked" | "needs_review";
  checks: RiskCheckItem[];
  violations: RiskCheckItem[];
  warnings?: RiskCheckItem[];
  calculated_limits: {
    max_allowed_quantity: number;
    planned_quantity: number;
    risk_per_share: string;
    planned_risk_amount: string;
    planned_notional: string;
    allowed_risk_budget: string;
    current_portfolio_risk: string;
    total_portfolio_risk: string;
  };
  input_hash: string;
  created_at: string;
}

export interface PortfolioRiskSummary {
  account_equity: string;
  total_open_risk: string;
  portfolio_risk_pct: string;
  total_exposure: string;
  portfolio_exposure_pct: string;
  position_count: number;
  theme_exposure: Record<string, string>;
}

export interface RiskConfig {
  account_id: string;
  max_risk_per_trade_pct: number;
  max_risk_per_trade_neutral_pct: number;
  max_single_position_pct: number;
  max_portfolio_risk_pct: number;
  max_sector_risk_pct: number;
  max_sector_exposure_pct: number;
  drawdown_warning_pct: number;
  drawdown_freeze_pct: number;
  drawdown_critical_pct: number;
  daily_loss_limit_pct: number;
  weekly_loss_limit_pct: number;
  plan_expiry_hours: number;
}

export interface AccountRiskState {
  account_id: string;
  state: "normal" | "reduced_risk" | "new_entries_frozen" | "critical_review" | "data_lock";
  reason: string;
  is_active: boolean;
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isMultipart = options.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isMultipart) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${TRADE_OS_API_PREFIX}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw Object.assign(new Error(error.error || `Request failed: ${response.status}`), {
      status: response.status,
    });
  }

  if (options.method && options.method.toUpperCase() !== "GET") {
    invalidateClientCache(TRADE_OS_API_PREFIX);
  }

  return response.json();
}

export async function fetchAccounts(): Promise<TradingAccount[]> {
  return apiRequest<TradingAccount[]>("/accounts");
}

export async function createAccount(data: {
  broker: string;
  account_name: string;
  account_type: string;
  initial_equity?: number | null;
  execution_capability?: string;
}): Promise<TradingAccount> {
  return apiRequest<TradingAccount>("/accounts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateAccount(
  accountId: string,
  data: Partial<TradingAccount>,
): Promise<TradingAccount> {
  return apiRequest<TradingAccount>(`/accounts/${accountId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function uploadRobinhoodCsv(
  accountId: string,
  file: File,
): Promise<{
  batch_id: string;
  status: string;
  imported_executions_count: number;
  duplicate_executions_count: number;
  cash_flows_count: number;
  issues_count: number;
  trade_groups_count: number;
}> {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest(`/imports/robinhood-csv/${accountId}`, {
    method: "POST",
    body: formData,
  });
}

export async function fetchImportBatches(accountId: string): Promise<ImportBatch[]> {
  return apiRequest<ImportBatch[]>(`/imports/batches/${accountId}`);
}

export async function fetchReconciliationIssues(accountId: string): Promise<ReconciliationIssue[]> {
  return apiRequest<ReconciliationIssue[]>(`/imports/issues/${accountId}`);
}

export async function fetchExecutions(
  accountId: string,
  symbol?: string,
): Promise<ExecutionRecord[]> {
  const query = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
  return apiRequest<ExecutionRecord[]>(`/executions/${accountId}${query}`);
}

export async function recordManualExecution(
  accountId: string,
  data: {
    symbol: string;
    side: "buy" | "sell";
    quantity: number;
    price: number;
    fees?: number;
    executed_at?: string;
    description?: string;
  },
): Promise<ExecutionRecord> {
  return apiRequest<ExecutionRecord>(`/executions/${accountId}/manual`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchTradeGroups(accountId: string, status?: string): Promise<TradeGroup[]> {
  const query = status ? `?status_filter=${encodeURIComponent(status)}` : "";
  return apiRequest<TradeGroup[]>(`/executions/${accountId}/trade-groups${query}`);
}

export async function recordEquitySnapshot(
  accountId: string,
  data: {
    net_liquidation_value: number;
    cash_balance?: number;
    securities_value?: number;
    buying_power?: number;
  },
): Promise<EquitySnapshot> {
  return apiRequest<EquitySnapshot>(`/equity/${accountId}/snapshots`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchEquityHistory(accountId: string): Promise<EquitySnapshot[]> {
  return apiRequest<EquitySnapshot[]>(`/equity/${accountId}/history`);
}

export async function fetchStrategies(): Promise<StrategyVersion[]> {
  return apiRequest<StrategyVersion[]>("/strategies");
}

export async function createStrategy(data: Partial<StrategyVersion>): Promise<StrategyVersion> {
  return apiRequest<StrategyVersion>("/strategies", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function calculateSizing(data: {
  account_equity: number;
  entry_price: number;
  stop_price: number;
  allowed_risk_pct?: number;
  max_position_notional_pct?: number;
  side?: string;
}): Promise<{
  account_equity: string;
  entry_price: string;
  stop_price: string;
  risk_per_share: string;
  risk_budget: string;
  quantity_by_risk: string;
  quantity_by_notional: string;
  max_allowed_quantity: string;
  planned_risk_amount: string;
  planned_notional: string;
  notional_weight_pct: string;
  risk_weight_pct: string;
}> {
  return apiRequest("/plans/calculate-sizing", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchPlans(accountId?: string, statusFilter?: string): Promise<TradePlan[]> {
  const params = new URLSearchParams();
  if (accountId) params.set("account_id", accountId);
  if (statusFilter) params.set("status_filter", statusFilter);
  const q = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<TradePlan[]>(`/plans${q}`);
}

export async function createTradePlan(data: {
  account_id: string;
  symbol: string;
  side?: string;
  planned_entry: number;
  planned_stop: number;
  planned_target: number;
  planned_quantity: number;
  setup_reason: string;
  invalidation_reason: string;
  strategy_version_id?: string | null;
}): Promise<TradePlan> {
  return apiRequest<TradePlan>("/plans", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function approveTradePlan(
  planId: string,
  marketRegime: string = "risk_on",
): Promise<{
  plan_id: string;
  status: string;
  decision: string;
  assessment: RiskAssessment;
}> {
  return apiRequest(`/plans/${planId}/approve`, {
    method: "POST",
    body: JSON.stringify({ market_regime: marketRegime }),
  });
}

export async function cancelTradePlan(planId: string): Promise<TradePlan> {
  return apiRequest<TradePlan>(`/plans/${planId}/cancel`, {
    method: "POST",
  });
}

export async function fetchPortfolioRisk(accountId: string): Promise<PortfolioRiskSummary> {
  return apiRequest<PortfolioRiskSummary>(`/portfolio/risk-summary/${accountId}`);
}

export async function fetchDrawdown(accountId: string): Promise<{
  current_drawdown_pct: string;
  max_drawdown_pct: string;
  peak_unit_value: string;
  current_unit_value: string;
}> {
  return apiRequest(`/portfolio/drawdown/${accountId}`);
}

export async function fetchRiskConfig(accountId: string): Promise<RiskConfig> {
  return apiRequest<RiskConfig>(`/risk/config/${accountId}`);
}

export async function updateRiskConfig(
  accountId: string,
  data: Partial<RiskConfig>,
): Promise<RiskConfig> {
  return apiRequest<RiskConfig>(`/risk/config/${accountId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function fetchRiskState(accountId: string): Promise<AccountRiskState> {
  return apiRequest<AccountRiskState>(`/risk/state/${accountId}`);
}

// ----------------------------------------------------------------------------
// Phase 2: Market Regime & Scanner Types & Functions
// ----------------------------------------------------------------------------

export interface BenchmarkMetrics {
  symbol: string;
  valid: boolean;
  status: "bullish" | "neutral" | "bearish" | "stale_data";
  price?: string;
  sma50?: string;
  sma200?: string;
  sma200_slope_20d_pct?: string;
  distance_to_sma200_pct?: string;
  is_above_sma200?: boolean;
  is_above_sma50?: boolean;
  is_golden_cross?: boolean;
  last_bar_date?: string;
  message?: string;
}

export interface MarketRegimeResponse {
  regime: "risk_on" | "neutral" | "risk_off" | "stale_data";
  allow_new_entries: boolean;
  effective_risk_pct: string;
  summary: string;
  spy: BenchmarkMetrics;
  qqq: BenchmarkMetrics;
  evaluated_at: string;
}

export interface ScannerCandidate {
  symbol: string;
  strategy_code: string;
  current_price: string;
  current_high: string;
  breakout_level: string;
  sma50: string;
  sma200: string;
  distance_to_sma50_pct: string;
  atr14: string;
  suggested_entry: string;
  suggested_stop: string;
  suggested_target_2r: string;
  suggested_target_3r: string;
  risk_per_share: string;
  volume_surge_ratio: string;
  avg_volume_20d: number;
  rank_score: number;
  matched_criteria: string[];
}

export interface ScannerRunResponse {
  strategy_code: string;
  run_at: string;
  universe_type: string;
  total_scanned: number;
  candidates_count: number;
  candidates: ScannerCandidate[];
}

export async function fetchMarketRegime(): Promise<MarketRegimeResponse> {
  return apiRequest<MarketRegimeResponse>("/market/regime");
}

export async function evaluateMarketRegime(): Promise<MarketRegimeResponse> {
  return apiRequest<MarketRegimeResponse>("/market/evaluate", {
    method: "POST",
  });
}

export async function fetchLatestScannerRun(): Promise<ScannerRunResponse> {
  return apiRequest<ScannerRunResponse>("/scanner/latest");
}

export async function runOpportunityScanner(symbols?: string[]): Promise<ScannerRunResponse> {
  return apiRequest<ScannerRunResponse>("/scanner/run", {
    method: "POST",
    body: JSON.stringify({ symbols, save_to_db: true }),
  });
}

// ----------------------------------------------------------------------------
// Phase 3: Backtesting, Journal & Performance Analytics Types & Functions
// ----------------------------------------------------------------------------

export interface BacktestSummary {
  symbol: string;
  total_trades: number;
  winning_trades: number;
  losing_trades: number;
  win_rate_pct: number;
  profit_factor: number;
  expectancy_r: number;
  avg_win_pnl: string;
  avg_loss_pnl: string;
  gross_profit: string;
  gross_loss: string;
  net_pnl: string;
  total_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  initial_capital: string;
  ending_capital: string;
}

export interface BacktestTrade {
  symbol: string;
  entry_date: string;
  exit_date: string;
  entry_price: string;
  exit_price: string;
  shares: number;
  pnl: string;
  r_multiple: number;
  exit_reason: "stop_loss" | "take_profit" | "time_stop";
  holding_bars: number;
}

export interface BacktestResult {
  symbol: string;
  summary: BacktestSummary;
  trades: BacktestTrade[];
  equity_curve: {
    date: string;
    equity: string;
    drawdown_pct: string;
    in_position: boolean;
  }[];
  error?: string;
}

export interface JournalReview {
  execution_rating: "excellent" | "good" | "fair" | "poor" | "unreviewed";
  discipline_score: number;
  mistake_tags: string[];
  notes: string;
  ai_review: string;
}

export interface JournalEntry {
  trade_group_id: string;
  account_id: string;
  symbol: string;
  status: "open" | "closed";
  total_quantity: string;
  remaining_quantity: string;
  average_cost: string;
  average_exit_price: string;
  realized_pnl: string;
  planned: boolean;
  plan_id: string | null;
  planned_entry: string | null;
  planned_stop: string | null;
  planned_target: string | null;
  planned_risk: string | null;
  realized_r: number | null;
  compliance_status: "compliant" | "outside_plan";
  opened_at: string;
  closed_at: string | null;
  review: JournalReview | null;
}

export interface AccountAnalytics {
  total_closed_trades: number;
  win_rate_pct: number;
  profit_factor: number;
  expectancy_r: number;
  plan_coverage_pct: number;
  outside_plan_count: number;
  gross_profit: string;
  gross_loss: string;
  net_realized_pnl: string;
  average_win_pnl: string;
  average_loss_pnl: string;
  r_distribution: {
    loss_gt_2r: number;
    loss_1_to_2r: number;
    loss_0_to_1r: number;
    win_0_to_1r: number;
    win_1_to_2r: number;
    win_2_to_3r: number;
    win_gt_3r: number;
  };
  mistake_tag_counts: Record<string, number>;
}

export async function runBacktest(params: {
  symbol: string;
  initial_capital?: number;
  risk_per_trade_pct?: number;
  period?: string;
}): Promise<BacktestResult> {
  return apiRequest<BacktestResult>("/backtests/run", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function fetchJournal(accountId: string): Promise<JournalEntry[]> {
  return apiRequest<JournalEntry[]>(`/journal/${accountId}`);
}

export async function submitJournalReview(data: {
  trade_group_id: string;
  execution_rating: string;
  discipline_score: number;
  mistake_tags?: string[];
  notes?: string;
}): Promise<any> {
  return apiRequest("/journal/review", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchAnalytics(accountId: string): Promise<AccountAnalytics> {
  return apiRequest<AccountAnalytics>(`/analytics/${accountId}`);
}
