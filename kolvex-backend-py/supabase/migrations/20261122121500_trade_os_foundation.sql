-- Trade OS Phase 0 Foundation Tables
-- Covers Trading Accounts, Equity Snapshots, Cash Flows, Import Batches, Executions, Trade Groups, Reconciliation Issues, and Audit Logs

-- 1. Trading Accounts
CREATE TABLE IF NOT EXISTS public.trading_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker TEXT NOT NULL DEFAULT 'manual',          -- manual | robinhood | ...
  account_name TEXT NOT NULL DEFAULT 'Primary',
  account_type TEXT NOT NULL DEFAULT 'manual',  -- manual | imported | read_only | paper
  initial_equity NUMERIC(18,2),
  connection_status TEXT NOT NULL DEFAULT 'active', -- active | disconnected | archived
  execution_capability TEXT NOT NULL DEFAULT 'manual', -- manual | read_only | broker
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trading_accounts_user_idx ON public.trading_accounts(user_id);
ALTER TABLE public.trading_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trading_accounts FROM anon, authenticated;
GRANT SELECT ON public.trading_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_accounts TO service_role;
CREATE POLICY trading_accounts_read_own ON public.trading_accounts FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 2. Equity Snapshots
CREATE TABLE IF NOT EXISTS public.equity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_at TIMESTAMPTZ NOT NULL,
  net_liquidation_value NUMERIC(18,2) NOT NULL,
  cash_balance NUMERIC(18,2),
  securities_value NUMERIC(18,2),
  margin_debit NUMERIC(18,2) DEFAULT 0,
  buying_power NUMERIC(18,2),
  source TEXT NOT NULL DEFAULT 'manual',        -- manual | csv_import | broker_sync
  quality_status TEXT NOT NULL DEFAULT 'unverified', -- unverified | confirmed | stale
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT equity_snapshots_account_snapshot_source_uniq UNIQUE(account_id, snapshot_at, source)
);

CREATE INDEX IF NOT EXISTS equity_snapshots_account_idx ON public.equity_snapshots(account_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS equity_snapshots_user_idx ON public.equity_snapshots(user_id);
ALTER TABLE public.equity_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.equity_snapshots FROM anon, authenticated;
GRANT SELECT ON public.equity_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equity_snapshots TO service_role;
CREATE POLICY equity_snapshots_read_own ON public.equity_snapshots FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 3. Cash Flows
CREATE TABLE IF NOT EXISTS public.cash_flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flow_type TEXT NOT NULL,  -- deposit | withdrawal | dividend | interest | fee | transfer
  amount NUMERIC(18,2) NOT NULL,
  effective_date DATE NOT NULL,
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,           -- external deduplication ID
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cash_flows_account_idx ON public.cash_flows(account_id, effective_date DESC);
CREATE INDEX IF NOT EXISTS cash_flows_user_idx ON public.cash_flows(user_id);
ALTER TABLE public.cash_flows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cash_flows FROM anon, authenticated;
GRANT SELECT ON public.cash_flows TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_flows TO service_role;
CREATE POLICY cash_flows_read_own ON public.cash_flows FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 4. Import Batches
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,           -- robinhood_csv | manual
  file_name TEXT,
  file_hash TEXT,                 -- SHA256 of raw content
  record_count INTEGER DEFAULT 0,
  imported_count INTEGER DEFAULT 0,
  duplicate_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | processing | completed | failed
  errors JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS import_batches_account_idx ON public.import_batches(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS import_batches_user_idx ON public.import_batches(user_id);
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.import_batches FROM anon, authenticated;
GRANT SELECT ON public.import_batches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_batches TO service_role;
CREATE POLICY import_batches_read_own ON public.import_batches FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 5. Executions
CREATE TABLE IF NOT EXISTS public.executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  trade_plan_id UUID,             -- linked in Phase 1
  source_execution_id TEXT,       -- broker activity / execution ID
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,             -- buy | sell
  quantity NUMERIC(18,6) NOT NULL,
  price NUMERIC(18,6) NOT NULL,
  amount NUMERIC(18,2) NOT NULL,  -- quantity * price
  fees NUMERIC(18,4) DEFAULT 0,
  executed_at TIMESTAMPTZ NOT NULL,
  activity_type TEXT DEFAULT 'trade',    -- trade | option_expiry | option_exercise | split | dividend
  instrument_type TEXT DEFAULT 'equity', -- equity | option | etf
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual', -- robinhood_csv | manual | plaid
  quality_status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS executions_account_symbol_idx ON public.executions(account_id, symbol, executed_at DESC);
CREATE INDEX IF NOT EXISTS executions_user_idx ON public.executions(user_id);
ALTER TABLE public.executions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.executions FROM anon, authenticated;
GRANT SELECT ON public.executions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.executions TO service_role;
CREATE POLICY executions_read_own ON public.executions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 6. Trade Groups (Aggregates multiple executions into logical round-trip trades)
CREATE TABLE IF NOT EXISTS public.trade_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL DEFAULT 'long',    -- long | short
  status TEXT NOT NULL DEFAULT 'open',  -- open | closed | partial
  open_quantity NUMERIC(18,6) DEFAULT 0,
  total_buy_quantity NUMERIC(18,6) DEFAULT 0,
  total_sell_quantity NUMERIC(18,6) DEFAULT 0,
  average_entry_price NUMERIC(18,6),
  realized_pnl NUMERIC(18,2),
  total_fees NUMERIC(18,4) DEFAULT 0,
  first_entry_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trade_groups_account_status_idx ON public.trade_groups(account_id, status, symbol);
CREATE INDEX IF NOT EXISTS trade_groups_user_idx ON public.trade_groups(user_id);
ALTER TABLE public.trade_groups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trade_groups FROM anon, authenticated;
GRANT SELECT ON public.trade_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_groups TO service_role;
CREATE POLICY trade_groups_read_own ON public.trade_groups FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 7. Trade Group Executions Link
CREATE TABLE IF NOT EXISTS public.trade_group_executions (
  trade_group_id UUID NOT NULL REFERENCES public.trade_groups(id) ON DELETE CASCADE,
  execution_id UUID NOT NULL REFERENCES public.executions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (trade_group_id, execution_id)
);

ALTER TABLE public.trade_group_executions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trade_group_executions FROM anon, authenticated;
GRANT SELECT ON public.trade_group_executions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_group_executions TO service_role;
CREATE POLICY trade_group_executions_read_own ON public.trade_group_executions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 8. Reconciliation Issues
CREATE TABLE IF NOT EXISTS public.reconciliation_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.trading_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
  issue_type TEXT NOT NULL,  -- unmatched_execution | missing_cost_basis | quantity_mismatch | unparsed_row
  symbol TEXT,
  description TEXT NOT NULL,
  raw_data JSONB,
  resolution TEXT DEFAULT 'pending', -- pending | resolved | ignored | manual_fix
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reconciliation_issues_account_idx ON public.reconciliation_issues(account_id, resolution);
CREATE INDEX IF NOT EXISTS reconciliation_issues_user_idx ON public.reconciliation_issues(user_id);
ALTER TABLE public.reconciliation_issues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reconciliation_issues FROM anon, authenticated;
GRANT SELECT ON public.reconciliation_issues TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reconciliation_issues TO service_role;
CREATE POLICY reconciliation_issues_read_own ON public.reconciliation_issues FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 9. Trade OS Audit Logs
CREATE TABLE IF NOT EXISTS public.trade_os_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,     -- trade_plan | risk_assessment | execution | account
  entity_id UUID,
  action TEXT NOT NULL,          -- create | update | approve | block | cancel | import
  old_values JSONB,
  new_values JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS trade_os_audit_logs_user_idx ON public.trade_os_audit_logs(user_id, created_at DESC);
ALTER TABLE public.trade_os_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trade_os_audit_logs FROM anon, authenticated;
GRANT SELECT ON public.trade_os_audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_os_audit_logs TO service_role;
CREATE POLICY trade_os_audit_logs_read_own ON public.trade_os_audit_logs FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.trading_accounts IS 'Trade OS managed user trading accounts';
COMMENT ON TABLE public.executions IS 'Trade OS normalized execution ledger with idempotency support';
COMMENT ON TABLE public.trade_groups IS 'Aggregated round-trip trades matching entries and exits';
