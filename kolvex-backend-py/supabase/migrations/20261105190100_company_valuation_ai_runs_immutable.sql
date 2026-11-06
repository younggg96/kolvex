-- Supabase default privileges give service_role full access to new tables. Saved runs
-- are immutable, so the server keeps only select and insert. Deleting a user still
-- removes their runs: the foreign-key cascade does not use these grants.
revoke update, delete, truncate on public.company_valuation_ai_runs from service_role;
