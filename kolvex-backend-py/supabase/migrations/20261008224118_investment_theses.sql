-- Append-only snapshots preserve the reasoning that existed at each decision.
create table public.investment_thesis_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thesis_id uuid not null,
  version integer not null check (version > 0),
  ticker text not null check (ticker ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  direction text not null check (direction in ('bullish', 'neutral', 'bearish')),
  reasoning text not null check (length(trim(reasoning)) between 1 and 10000),
  entry_low numeric check (entry_low > 0 and entry_low <= 1000000000),
  entry_high numeric check (entry_high > 0 and entry_high <= 1000000000),
  invalidation numeric check (invalidation > 0 and invalidation <= 1000000000),
  target numeric check (target > 0 and target <= 1000000000),
  horizon text not null check (length(trim(horizon)) between 1 and 100),
  status text not null default 'active' check (status in ('active', 'closed')),
  review text not null default '' check (length(review) <= 10000),
  evidence jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, thesis_id, version),
  check (entry_high is null or (entry_low is not null and entry_high >= entry_low))
);
create index investment_thesis_user_ticker on public.investment_thesis_versions (user_id, ticker, created_at desc);
alter table public.investment_thesis_versions enable row level security;
revoke all on public.investment_thesis_versions from anon, authenticated;
grant select, insert on public.investment_thesis_versions to authenticated;
create policy thesis_read_own on public.investment_thesis_versions for select to authenticated
  using ((select auth.uid()) = user_id);
create policy thesis_append_own on public.investment_thesis_versions for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- security_invoker is essential: the view must obey the underlying ownership policy.
create view public.investment_thesis_current with (security_invoker = true) as
  select distinct on (user_id, thesis_id) *
  from public.investment_thesis_versions
  order by user_id, thesis_id, version desc;
revoke all on public.investment_thesis_current from anon, authenticated;
grant select on public.investment_thesis_current to authenticated;
