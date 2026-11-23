-- ============================================================================
-- Migration: 20261122133000_trade_os_phase3.sql
-- Description: Phase 3 tables for Backtest Runs and Trade Journal Reviews
-- ============================================================================

-- Backtest Runs
CREATE TABLE IF NOT EXISTS trade_os_backtest_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    strategy_code VARCHAR(64) NOT NULL DEFAULT 'TREND_BREAKOUT_20D',
    symbol VARCHAR(32) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    initial_capital NUMERIC(18, 2) NOT NULL DEFAULT 100000.00,
    parameters JSONB NOT NULL DEFAULT '{}'::jsonb,
    summary_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    equity_curve JSONB NOT NULL DEFAULT '[]'::jsonb,
    trades JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_trade_os_backtest_runs_sym
ON trade_os_backtest_runs(symbol, created_at DESC);

ALTER TABLE trade_os_backtest_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read backtest runs"
ON trade_os_backtest_runs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert backtest runs"
ON trade_os_backtest_runs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Trade Journal Reviews & Post-Trade Annotations
CREATE TABLE IF NOT EXISTS trade_os_journal_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trade_group_id UUID NOT NULL REFERENCES trade_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    execution_rating VARCHAR(16) DEFAULT 'good', -- 'excellent' | 'good' | 'fair' | 'poor'
    discipline_score INT DEFAULT 5, -- 1-5 scale
    mistake_tags TEXT[] DEFAULT '{}', -- 'chased_entry', 'early_exit', 'moved_stop', 'oversized', 'fomo'
    notes TEXT,
    ai_review TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_journal_trade_group UNIQUE (trade_group_id)
);

CREATE INDEX IF NOT EXISTS idx_trade_os_journal_reviews_tg
ON trade_os_journal_reviews(trade_group_id);

ALTER TABLE trade_os_journal_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to manage journal reviews"
ON trade_os_journal_reviews FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
