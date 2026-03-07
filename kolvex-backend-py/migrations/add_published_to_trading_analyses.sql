-- Add publishing support to trading_analyses table
-- Run this migration on existing databases that already have the trading_analyses table

ALTER TABLE trading_analyses
    ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_trading_analyses_published
    ON trading_analyses(is_published) WHERE is_published = true;

DROP POLICY IF EXISTS "Anyone can view published trading analyses" ON trading_analyses;
CREATE POLICY "Anyone can view published trading analyses"
    ON trading_analyses FOR SELECT
    USING (is_published = true);
