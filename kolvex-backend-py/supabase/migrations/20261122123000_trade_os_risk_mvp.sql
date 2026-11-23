-- Trade OS Phase 1 Risk MVP Migration
-- Covers Strategy Versions, Trade Plans, Risk Assessments, Account Risk States, Risk Configs, Positions, Lots, and Theme Mappings

-- 1. Strategy Versions (Immutable configuration per released version)
CREATE TABLE IF NOT EXISTS public.strategy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy_key TEXT NOT NULL,         -- e.g. TREND_BREAKOUT_20D
  version TEXT NOT NULL,              -- e.g. 1.0.0
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | research | backtested | live_eligible | paused | retired
  parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
  entry_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  exit_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  config_hash TEXT NOT NULL,          -- SHA-256 of canonical JSON
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT strategy_versions_user_key_version_uniq UNIQUE(user_id, strategy_key, version)
);

CREATE INDEX IF NOT EXISTS strategy_versions_user_idx ON public.strategy_versions(user_id);
ALTER TABLE public.strategy_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.strategy_versions FROM anon, authenticated;
GRANT SELECT ON public.strategy_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.strategy_versions TO service_role;
CREATE POLICY strategy_versions_read_own ON public.strategy_versions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 2. Risk Configurations (Per-account risk parameters)
CREATE TABLE IF NOT EXISTS public.risk_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  max_risk_per_trade_pct NUMERIC(8,4) NOT NULL DEFAULT 0.0050,       -- 0.5%
  max_risk_per_trade_neutral_pct NUMERIC(8,4) NOT NULL DEFAULT 0.0025, -- 0.25%
  max_single_position_pct NUMERIC(8,4) NOT NULL DEFAULT 0.1000,      -- 10%
  max_portfolio_risk_pct NUMERIC(8,4) NOT NULL DEFAULT 0.0200,       -- 2%
  max_sector_risk_pct NUMERIC(8,4) NOT NULL DEFAULT 0.0100,          -- 1%
  max_sector_exposure_pct NUMERIC(8,4) NOT NULL DEFAULT 0.2000,      -- 20%
  drawdown_warning_pct NUMERIC(8,4) NOT NULL DEFAULT 0.0600,         -- 6%
  drawdown_freeze_pct NUMERIC(8,4) NOT NULL DEFAULT 0.0800,          -- 8%
  drawdown_critical_pct NUMERIC(8,4) NOT NULL DEFAULT 0.1000,        -- 10%
  daily_loss_limit_pct NUMERIC(8,4) NOT NULL DEFAULT 0.0150,         -- 1.5%
  weekly_loss_limit_pct NUMERIC(8,4) NOT NULL DEFAULT 0.0300,        -- 3.0%
  plan_expiry_hours INTEGER NOT NULL DEFAULT 24,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT risk_configs_account_uniq UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS risk_configs_account_idx ON public.risk_configs(account_id);
ALTER TABLE public.risk_configs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.risk_configs FROM anon, authenticated;
GRANT SELECT ON public.risk_configs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_configs TO service_role;
CREATE POLICY risk_configs_read_own ON public.risk_configs FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 3. Trade Plans
CREATE TABLE IF NOT EXISTS public.trade_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  strategy_version_id UUID REFERENCES public.strategy_versions(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL DEFAULT 'long',
  planned_entry NUMERIC(18,6) NOT NULL,
  planned_stop NUMERIC(18,6) NOT NULL,
  planned_target NUMERIC(18,6) NOT NULL,
  planned_quantity INTEGER NOT NULL,
  planned_risk_per_share NUMERIC(18,6) NOT NULL,
  planned_risk_amount NUMERIC(18,2) NOT NULL,
  planned_notional NUMERIC(18,2) NOT NULL,
  reward_risk_ratio NUMERIC(8,2),
  setup_reason TEXT NOT NULL,
  invalidation_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
    -- draft | validating | approved | executed | open | closed
    -- blocked | expired | cancelled | outside_plan | review_required
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trade_plans_account_status_idx ON public.trade_plans(account_id, status);
CREATE INDEX IF NOT EXISTS trade_plans_user_idx ON public.trade_plans(user_id);
ALTER TABLE public.trade_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trade_plans FROM anon, authenticated;
GRANT SELECT ON public.trade_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_plans TO service_role;
CREATE POLICY trade_plans_read_own ON public.trade_plans FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 4. Risk Assessments (Immutable evaluation audit record)
CREATE TABLE IF NOT EXISTS public.risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_plan_id UUID NOT NULL REFERENCES public.trade_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_version TEXT NOT NULL,
  account_snapshot JSONB NOT NULL,
  market_snapshot JSONB NOT NULL,
  decision TEXT NOT NULL,             -- approved | blocked | needs_review
  checks JSONB NOT NULL,              -- list of rule results
  violations JSONB,                   -- failed rule list
  calculated_limits JSONB NOT NULL,   -- calculated sizes and max risks
  input_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS risk_assessments_plan_idx ON public.risk_assessments(trade_plan_id);
CREATE INDEX IF NOT EXISTS risk_assessments_user_idx ON public.risk_assessments(user_id);
ALTER TABLE public.risk_assessments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.risk_assessments FROM anon, authenticated;
GRANT SELECT ON public.risk_assessments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risk_assessments TO service_role;
CREATE POLICY risk_assessments_read_own ON public.risk_assessments FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 5. Account Risk States (State machine audit & enforcement)
CREATE TABLE IF NOT EXISTS public.account_risk_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'normal', -- normal | reduced_risk | new_entries_frozen | critical_review | data_lock
  reason TEXT NOT NULL,
  triggered_by TEXT,                    -- drawdown | daily_loss | weekly_loss | data_stale | manual
  trigger_value NUMERIC(18,6),
  threshold_value NUMERIC(18,6),
  previous_state TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS account_risk_states_account_active_idx ON public.account_risk_states(account_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS account_risk_states_user_idx ON public.account_risk_states(user_id);
ALTER TABLE public.account_risk_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_risk_states FROM anon, authenticated;
GRANT SELECT ON public.account_risk_states TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_risk_states TO service_role;
CREATE POLICY account_risk_states_read_own ON public.account_risk_states FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 6. Managed Positions
CREATE TABLE IF NOT EXISTS public.trade_os_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_plan_id UUID REFERENCES public.trade_plans(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL DEFAULT 'long',
  quantity NUMERIC(18,6) NOT NULL,
  average_cost NUMERIC(18,6) NOT NULL,
  current_stop NUMERIC(18,6),
  current_target NUMERIC(18,6),
  strategy_version_id UUID REFERENCES public.strategy_versions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open',  -- open | closed | partial
  theme TEXT,                          -- semiconductor | ai_infrastructure | ...
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trade_os_positions_account_symbol_idx ON public.trade_os_positions(account_id, symbol, status);
CREATE INDEX IF NOT EXISTS trade_os_positions_user_idx ON public.trade_os_positions(user_id);
ALTER TABLE public.trade_os_positions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trade_os_positions FROM anon, authenticated;
GRANT SELECT ON public.trade_os_positions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_os_positions TO service_role;
CREATE POLICY trade_os_positions_read_own ON public.trade_os_positions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 7. Position Lots
CREATE TABLE IF NOT EXISTS public.position_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL REFERENCES public.trade_os_positions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_plan_id UUID REFERENCES public.trade_plans(id) ON DELETE SET NULL,
  execution_id UUID REFERENCES public.executions(id) ON DELETE SET NULL,
  quantity NUMERIC(18,6) NOT NULL,
  entry_price NUMERIC(18,6) NOT NULL,
  entry_date TIMESTAMPTZ NOT NULL,
  stop_price NUMERIC(18,6),
  target_price NUMERIC(18,6),
  initial_risk_per_share NUMERIC(18,6),
  initial_risk_amount NUMERIC(18,2),
  status TEXT NOT NULL DEFAULT 'open',
  close_price NUMERIC(18,6),
  closed_at TIMESTAMPTZ,
  realized_pnl NUMERIC(18,2),
  r_multiple NUMERIC(8,4),
  exit_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS position_lots_pos_idx ON public.position_lots(position_id);
CREATE INDEX IF NOT EXISTS position_lots_user_idx ON public.position_lots(user_id);
ALTER TABLE public.position_lots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.position_lots FROM anon, authenticated;
GRANT SELECT ON public.position_lots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.position_lots TO service_role;
CREATE POLICY position_lots_read_own ON public.position_lots FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 8. Symbol Theme Mappings
CREATE TABLE IF NOT EXISTS public.symbol_theme_mappings (
  symbol TEXT NOT NULL,
  theme TEXT NOT NULL,                 -- semiconductor | ai_infrastructure | cloud | cybersecurity | ev | biotech
  source TEXT DEFAULT 'manual',
  effective_date DATE DEFAULT CURRENT_DATE,
  PRIMARY KEY (symbol, theme)
);

ALTER TABLE public.symbol_theme_mappings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.symbol_theme_mappings FROM anon, authenticated;
GRANT SELECT ON public.symbol_theme_mappings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.symbol_theme_mappings TO service_role;
CREATE POLICY symbol_theme_mappings_read_all ON public.symbol_theme_mappings FOR SELECT TO authenticated
  USING (true);

-- Seed initial popular theme mappings
INSERT INTO public.symbol_theme_mappings (symbol, theme, source) VALUES
  ('NVDA', 'semiconductor', 'seed'),
  ('AMD', 'semiconductor', 'seed'),
  ('TSM', 'semiconductor', 'seed'),
  ('AVGO', 'semiconductor', 'seed'),
  ('QCOM', 'semiconductor', 'seed'),
  ('MSFT', 'ai_infrastructure', 'seed'),
  ('GOOGL', 'ai_infrastructure', 'seed'),
  ('AMZN', 'ai_infrastructure', 'seed'),
  ('META', 'ai_infrastructure', 'seed'),
  ('PLTR', 'ai_infrastructure', 'seed'),
  ('CRWD', 'cybersecurity', 'seed'),
  ('PANW', 'cybersecurity', 'seed'),
  ('TSLA', 'ev', 'seed')
ON CONFLICT DO NOTHING;
