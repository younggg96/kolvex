-- Per-user price chart drawings, synced across devices (one row per user and ticker).
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE IF NOT EXISTS public.user_chart_drawings (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL CHECK (ticker = upper(ticker) AND length(ticker) BETWEEN 1 AND 20),
    drawings JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(drawings) = 'array'),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, ticker)
);

ALTER TABLE public.user_chart_drawings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own chart drawings" ON public.user_chart_drawings;
CREATE POLICY "Users manage own chart drawings"
    ON public.user_chart_drawings FOR ALL
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_chart_drawings TO authenticated, service_role;
REVOKE ALL ON public.user_chart_drawings FROM anon;
