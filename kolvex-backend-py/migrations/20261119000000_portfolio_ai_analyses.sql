-- Saved AI portfolio analyses (Web portfolio「AI 洞察」history).
-- Private to their owner; only the server (service_role) writes. Rows are immutable.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.portfolio_ai_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Model ID from the shared model list (e.g. deepseek-flash); runs on the user's own key.
    model_id TEXT NOT NULL CHECK (length(model_id) BETWEEN 1 AND 64),
    locale TEXT NOT NULL DEFAULT 'zh' CHECK (locale IN ('zh', 'en')),
    -- Short overall summary for the history list; the full answer is in result.
    summary TEXT NOT NULL,
    risk_level TEXT,
    positions_analyzed INTEGER NOT NULL CHECK (positions_analyzed >= 0),
    -- Full analysis as returned to the client (overall, per-stock, suggestions).
    result JSONB NOT NULL CHECK (jsonb_typeof(result) = 'object')
);

CREATE INDEX IF NOT EXISTS portfolio_ai_analyses_history_idx
    ON public.portfolio_ai_analyses (user_id, created_at DESC, id DESC);

ALTER TABLE public.portfolio_ai_analyses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.portfolio_ai_analyses FROM anon, authenticated;
GRANT SELECT ON public.portfolio_ai_analyses TO authenticated;
GRANT SELECT, INSERT ON public.portfolio_ai_analyses TO service_role;

DROP POLICY IF EXISTS own_portfolio_ai_analyses ON public.portfolio_ai_analyses;
CREATE POLICY own_portfolio_ai_analyses
    ON public.portfolio_ai_analyses FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);
