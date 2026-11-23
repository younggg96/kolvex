-- ============================================================================
-- Migration: 20261122130000_trade_os_market_and_scanner.sql
-- Description: Phase 2 tables for Market Regime and Opportunity Scanner
-- ============================================================================

CREATE TABLE IF NOT EXISTS trade_os_market_regimes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    regime VARCHAR(32) NOT NULL, -- 'risk_on' | 'neutral' | 'risk_off' | 'stale_data'
    summary TEXT,
    spy_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    qqq_metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
    allow_new_entries BOOLEAN NOT NULL DEFAULT false,
    effective_risk_pct NUMERIC(6, 4) NOT NULL DEFAULT 0.0050,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_trade_os_market_regimes_eval 
ON trade_os_market_regimes(evaluated_at DESC);

ALTER TABLE trade_os_market_regimes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to trade_os_market_regimes"
ON trade_os_market_regimes FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow authenticated users to insert trade_os_market_regimes"
ON trade_os_market_regimes FOR INSERT
TO authenticated
WITH CHECK (true);

-- Scanner Runs and Candidates
CREATE TABLE IF NOT EXISTS trade_os_scanner_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    strategy_code VARCHAR(64) NOT NULL DEFAULT 'TREND_BREAKOUT_20D',
    run_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    universe_type VARCHAR(64) NOT NULL DEFAULT 'liquid_growth_top',
    total_scanned INT NOT NULL DEFAULT 0,
    candidates_count INT NOT NULL DEFAULT 0,
    candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_trade_os_scanner_runs_time
ON trade_os_scanner_runs(run_at DESC);

ALTER TABLE trade_os_scanner_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read scanner runs"
ON trade_os_scanner_runs FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to insert scanner runs"
ON trade_os_scanner_runs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
