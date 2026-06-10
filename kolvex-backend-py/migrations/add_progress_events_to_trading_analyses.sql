-- Persist TradingAgents live progress events for environments where Redis/SSE
-- is unavailable or intermittent.

ALTER TABLE trading_analyses
    ADD COLUMN IF NOT EXISTS progress_stage TEXT,
    ADD COLUMN IF NOT EXISTS progress_message TEXT,
    ADD COLUMN IF NOT EXISTS progress_events JSONB NOT NULL DEFAULT '[]'::jsonb;

