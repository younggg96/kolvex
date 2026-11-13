-- Opt-in daily brief emails plus a per-recipient delivery log.
-- Opt-in is a new column that defaults to FALSE: email_notifications_enabled
-- defaulted to TRUE in an older migration, so it is not proof of consent.
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS brief_email_opt_in BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.email_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brief_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    provider_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- One email per user per brief, so a retried send never duplicates.
    UNIQUE (brief_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_email_deliveries_brief ON public.email_deliveries(brief_id);

-- Service role only: no policies means anon/authenticated users cannot read it.
ALTER TABLE public.email_deliveries ENABLE ROW LEVEL SECURITY;
