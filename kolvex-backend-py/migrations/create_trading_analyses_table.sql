-- Trading Analyses table for TradingAgents integration
-- Stores multi-agent trading analysis results (BUY/SELL/HOLD decisions)

CREATE TABLE IF NOT EXISTS trading_analyses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    trade_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    selected_analysts TEXT[] DEFAULT ARRAY['market','social','news','fundamentals'],

    -- LLM configuration used for this analysis
    llm_provider TEXT,
    deep_think_model TEXT,
    quick_think_model TEXT,

    -- Analyst reports
    market_report TEXT,
    sentiment_report TEXT,
    news_report TEXT,
    fundamentals_report TEXT,

    -- Bull/Bear investment debate
    investment_debate JSONB,
    investment_plan TEXT,

    -- Trader output
    trader_plan TEXT,

    -- Risk management debate
    risk_debate JSONB,

    -- Final decision
    final_decision TEXT,
    full_signal TEXT,

    -- Publishing
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,

    -- Metadata
    error_message TEXT,
    duration_seconds FLOAT,
    created_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trading_analyses_user_id ON trading_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_analyses_status ON trading_analyses(status);
CREATE INDEX IF NOT EXISTS idx_trading_analyses_created_at ON trading_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trading_analyses_ticker ON trading_analyses(ticker);
CREATE INDEX IF NOT EXISTS idx_trading_analyses_published ON trading_analyses(is_published) WHERE is_published = true;

ALTER TABLE trading_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trading analyses"
    ON trading_analyses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trading analyses"
    ON trading_analyses FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trading analyses"
    ON trading_analyses FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trading analyses"
    ON trading_analyses FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view published trading analyses"
    ON trading_analyses FOR SELECT
    USING (is_published = true);

CREATE POLICY "Service role full access on trading_analyses"
    ON trading_analyses FOR ALL
    USING (auth.role() = 'service_role');
