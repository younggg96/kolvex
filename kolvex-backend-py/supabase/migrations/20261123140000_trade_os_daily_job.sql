-- ============================================================================
-- Migration: 20261123140000_trade_os_daily_job.sql
-- Swing V3.0 (PRD §6.5, §23): one stored market state and one scheduled scan per
-- NYSE trading day, with the rule version and conditions that produced them.
--
-- trading_date is set only by the after-close job. Manual "Recalculate" / "Run scan"
-- rows leave it NULL, and NULLs never collide in the unique indexes, so manual runs
-- are unaffected while the scheduled row for a day can be written exactly once.
-- No RLS policy changes.
-- ============================================================================

ALTER TABLE trade_os_market_regimes
    ADD COLUMN IF NOT EXISTS trading_date DATE,
    ADD COLUMN IF NOT EXISTS rule_version TEXT,
    ADD COLUMN IF NOT EXISTS conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS data_as_of DATE,
    ADD COLUMN IF NOT EXISTS max_positions INT,
    ADD COLUMN IF NOT EXISTS max_open_risk_pct NUMERIC(6, 4);

-- History is never overwritten: a new rule version gets its own row for the same day.
CREATE UNIQUE INDEX IF NOT EXISTS uq_trade_os_market_regimes_day_rule
ON trade_os_market_regimes(trading_date, rule_version);

ALTER TABLE trade_os_scanner_runs
    ADD COLUMN IF NOT EXISTS trading_date DATE,
    ADD COLUMN IF NOT EXISTS strategy_version TEXT,
    ADD COLUMN IF NOT EXISTS market_regime VARCHAR(32),
    ADD COLUMN IF NOT EXISTS failed_symbols JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_trade_os_scanner_runs_day
ON trade_os_scanner_runs(strategy_code, trading_date);

CREATE INDEX IF NOT EXISTS idx_trade_os_scanner_runs_code_time
ON trade_os_scanner_runs(strategy_code, run_at DESC);
