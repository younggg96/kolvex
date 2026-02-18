-- ============================================================
-- Create options_unusual_activity table
-- Stores detected unusual options activity (high vol/OI, large premium, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS options_unusual_activity (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Symbol & contract info
    symbol          TEXT NOT NULL,
    company_name    TEXT,
    contract_symbol TEXT NOT NULL,
    option_type     TEXT NOT NULL CHECK (option_type IN ('call', 'put')),
    strike          NUMERIC(12,2) NOT NULL,
    expiration      TEXT NOT NULL,
    
    -- Market data
    volume          INTEGER NOT NULL DEFAULT 0,
    open_interest   INTEGER NOT NULL DEFAULT 0,
    vol_oi_ratio    NUMERIC(10,2) NOT NULL DEFAULT 0,
    implied_volatility NUMERIC(10,4) DEFAULT 0,
    last_price      NUMERIC(12,4) DEFAULT 0,
    bid             NUMERIC(12,4) DEFAULT 0,
    ask             NUMERIC(12,4) DEFAULT 0,
    premium         NUMERIC(16,2) NOT NULL DEFAULT 0,
    stock_price     NUMERIC(12,4) DEFAULT 0,
    in_the_money    BOOLEAN DEFAULT FALSE,
    
    -- Signal classification
    signal_types    TEXT[] NOT NULL DEFAULT '{}',
    signal_strength INTEGER NOT NULL DEFAULT 1 CHECK (signal_strength BETWEEN 1 AND 5),
    
    -- Timestamps
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_options_unusual_symbol
    ON options_unusual_activity (symbol);

CREATE INDEX IF NOT EXISTS idx_options_unusual_detected_at
    ON options_unusual_activity (detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_options_unusual_option_type
    ON options_unusual_activity (option_type);

CREATE INDEX IF NOT EXISTS idx_options_unusual_premium
    ON options_unusual_activity (premium DESC);

CREATE INDEX IF NOT EXISTS idx_options_unusual_vol_oi
    ON options_unusual_activity (vol_oi_ratio DESC);

CREATE INDEX IF NOT EXISTS idx_options_unusual_signal_strength
    ON options_unusual_activity (signal_strength DESC);

-- Composite index for the upsert conflict target
CREATE UNIQUE INDEX IF NOT EXISTS idx_options_unusual_contract_detected
    ON options_unusual_activity (contract_symbol, detected_at);

-- RLS: Public read access (no auth required for market data)
ALTER TABLE options_unusual_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read options unusual activity"
    ON options_unusual_activity
    FOR SELECT
    USING (true);

CREATE POLICY "Service role can insert/update options unusual activity"
    ON options_unusual_activity
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Auto-cleanup: Delete records older than 7 days (run via pg_cron or manually)
-- SELECT cron.schedule('cleanup_old_options_activity', '0 4 * * *',
--     $$DELETE FROM options_unusual_activity WHERE detected_at < NOW() - INTERVAL '7 days'$$
-- );

COMMENT ON TABLE options_unusual_activity IS 'Stores unusual options activity detected by periodic scans';
COMMENT ON COLUMN options_unusual_activity.vol_oi_ratio IS 'Volume / Open Interest ratio - higher means more unusual';
COMMENT ON COLUMN options_unusual_activity.premium IS 'Total premium traded = volume * last_price * 100';
COMMENT ON COLUMN options_unusual_activity.signal_types IS 'Array of signal categories: high_vol_oi, large_premium, high_volume, extreme_vol_oi, whale_trade';
COMMENT ON COLUMN options_unusual_activity.signal_strength IS 'Overall signal strength score from 1 (mild) to 5 (extreme)';
