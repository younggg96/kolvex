-- Same version as the applied remote migration. Legacy IDs and payloads are preserved.
ALTER TABLE public.daily_briefs DROP CONSTRAINT daily_briefs_brief_type_check;
ALTER TABLE public.daily_briefs ADD CONSTRAINT daily_briefs_brief_type_check
  CHECK (brief_type IN ('morning', 'intraday', 'evening'));
COMMENT ON COLUMN public.daily_briefs.brief_type IS 'morning: one hour before open; intraday: during regular session; evening: one hour after close. Legacy IDs retained.';
