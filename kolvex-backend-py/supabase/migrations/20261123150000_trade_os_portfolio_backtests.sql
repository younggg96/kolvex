-- ============================================================================
-- Migration: 20261123150000_trade_os_portfolio_backtests.sql
-- Swing V3.0 portfolio backtests run as background jobs (PRD §13, §22.2).
-- Adds job status and the extra result sections to the existing table.
-- No RLS policy changes.
-- ============================================================================

ALTER TABLE trade_os_backtest_runs
    ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'completed', -- queued | running | completed | failed
    ADD COLUMN IF NOT EXISTS error TEXT,
    ADD COLUMN IF NOT EXISTS config_hash TEXT,
    ADD COLUMN IF NOT EXISTS segments JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS gates JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS benchmark JSONB,
    ADD COLUMN IF NOT EXISTS skipped_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS excluded_symbols JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS assumptions JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_trade_os_backtest_runs_user
ON trade_os_backtest_runs(user_id, created_at DESC);
