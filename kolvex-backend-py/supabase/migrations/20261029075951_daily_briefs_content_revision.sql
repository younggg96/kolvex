ALTER TABLE public.daily_briefs ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0);
COMMENT ON COLUMN public.daily_briefs.revision IS 'Optimistic concurrency token for admin edits and deletes. Increment on every content update.';
