-- 13F simulated returns for the Superinvestors pages.
-- `institution_13f_quarters` keeps a compact snapshot of each past 13F-HR (the
-- largest long equity positions only), backfilled from SEC EDGAR.
-- `institution_13f_performance` caches the computed curve per manager; the
-- backend recomputes it about once a day. Only the backend service role may read/write.
create table public.institution_13f_quarters (
  accession text primary key,
  manager_id text not null,
  period date not null,
  filed date not null,
  -- Dollar value of every long equity row (shares, no options) in the filing.
  equity_value numeric not null check (equity_value >= 0),
  positions_count integer not null check (positions_count >= 0),
  -- Largest long equity positions, aggregated by CUSIP: [{cusip, issuer, value}].
  positions jsonb not null check (jsonb_typeof(positions) = 'array'),
  synced_at timestamptz not null default now()
);
create index institution_13f_quarters_manager on public.institution_13f_quarters(manager_id, period desc);

create table public.institution_13f_performance (
  manager_id text primary key,
  method_version integer not null,
  status text not null check (status in ('ready', 'insufficient')),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  latest_period date,
  computed_at timestamptz not null default now()
);

alter table public.institution_13f_quarters enable row level security;
alter table public.institution_13f_performance enable row level security;
revoke all on public.institution_13f_quarters from anon, authenticated;
revoke all on public.institution_13f_performance from anon, authenticated;
grant all on public.institution_13f_quarters to service_role;
grant all on public.institution_13f_performance to service_role;
