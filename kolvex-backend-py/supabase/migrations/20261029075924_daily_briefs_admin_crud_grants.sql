-- Admin CRUD uses the backend service role; browser roles remain denied.
GRANT UPDATE, DELETE ON TABLE public.daily_briefs TO service_role;
REVOKE ALL ON TABLE public.daily_briefs FROM anon, authenticated;
