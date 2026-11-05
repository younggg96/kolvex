-- Immutable AI valuation runs. Private to their owner; only the server writes.
create table public.company_valuation_ai_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null check (ticker = upper(ticker) and length(ticker) between 1 and 12),
  created_at timestamptz not null default now(),
  model_id text not null,
  prompt_version text not null,
  snapshot_id text not null,
  -- AI output: assumptions, summary, rationale, risks.
  payload jsonb not null,
  -- Values the deterministic model computed from those assumptions at generation time.
  results jsonb not null,
  -- Financial inputs and quote used, so a run stays reproducible after data changes.
  financial_snapshot jsonb not null
);
create index company_valuation_ai_runs_history_idx
  on public.company_valuation_ai_runs(user_id, ticker, created_at desc, id desc);
alter table public.company_valuation_ai_runs enable row level security;
revoke all on public.company_valuation_ai_runs from anon, authenticated;
grant select on public.company_valuation_ai_runs to authenticated;
grant select, insert on public.company_valuation_ai_runs to service_role;
create policy own_company_valuation_ai_runs on public.company_valuation_ai_runs
  for select to authenticated using ((select auth.uid()) = user_id);
