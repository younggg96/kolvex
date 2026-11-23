-- Market Risk Monitor V1 foundation (docs/market-risk/technical-review.md).
-- Market-wide data only. Reads go through the FastAPI service with the service role,
-- so clients get no direct table access. Model versions and metric definitions live in
-- code (app/services/market_risk/metrics.py); rows store the version string.

create table public.market_risk_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  data_source text not null,
  job_type text not null check (job_type in ('backfill', 'daily', 'retry')),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'partial', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  records_fetched integer not null default 0 check (records_fetched >= 0),
  records_valid integer not null default 0 check (records_valid >= 0),
  records_rejected integer not null default 0 check (records_rejected >= 0),
  records_written integer not null default 0 check (records_written >= 0),
  issues_json jsonb not null default '{}'::jsonb,
  error_message text,
  retry_count integer not null default 0 check (retry_count >= 0)
);

create index market_risk_ingestion_runs_source_started_idx
  on public.market_risk_ingestion_runs (data_source, started_at desc);

-- One row per (metric, source, trading date, revision). A provider correction is a new
-- revision; earlier revisions stay so past snapshots remain reproducible.
create table public.market_risk_observations (
  id uuid primary key default gen_random_uuid(),
  market text not null default 'US',
  metric_key text not null,
  value numeric not null,
  trading_date date not null,
  observation_time timestamptz not null,
  retrieved_at timestamptz not null,
  source text not null,
  source_symbol text not null,
  source_revision text not null default 'initial',
  quality_status text not null check (quality_status in ('valid', 'suspect')),
  quality_flags text[] not null default '{}',
  is_estimated boolean not null default false,
  model_version text,
  ingestion_run_id uuid references public.market_risk_ingestion_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (market, metric_key, source, trading_date, source_revision)
);

create index market_risk_observations_metric_date_idx
  on public.market_risk_observations (market, metric_key, trading_date desc);
create index market_risk_observations_source_time_idx
  on public.market_risk_observations (source, observation_time desc);
create index market_risk_observations_run_idx
  on public.market_risk_observations (ingestion_run_id);

create table public.market_risk_snapshots (
  id uuid primary key default gen_random_uuid(),
  market text not null default 'US',
  trading_date date not null,
  snapshot_revision integer not null default 1 check (snapshot_revision >= 1),
  evaluated_at timestamptz not null default now(),
  model_version text not null,
  risk_score numeric check (risk_score between 0 and 100),
  risk_level text check (risk_level in ('low', 'moderate', 'elevated', 'high', 'extreme')),
  regime text check (
    regime in ('stable', 'stress_build_up', 'stress_acceleration', 'post_stress_normalization')
  ),
  score_components_json jsonb not null default '{}'::jsonb,
  data_coverage numeric not null check (data_coverage between 0 and 1),
  confidence_status text not null
    check (confidence_status in ('complete', 'partial', 'insufficient_coverage', 'insufficient_history')),
  quality_status text not null check (quality_status in ('fresh', 'delayed', 'stale', 'missing')),
  is_complete boolean not null default false,
  inputs_hash text not null,
  created_at timestamptz not null default now(),
  unique (market, trading_date, model_version, snapshot_revision)
);

create index market_risk_snapshots_latest_idx
  on public.market_risk_snapshots (market, model_version, trading_date desc);

create table public.market_risk_signals (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.market_risk_snapshots (id) on delete cascade,
  rule_key text not null,
  rule_version text not null,
  rule_type text not null check (rule_type in ('escalation', 'recovery')),
  status text not null check (
    status in ('triggered', 'not_triggered', 'pending_confirmation', 'insufficient_data', 'disabled')
  ),
  observed_values_json jsonb not null default '{}'::jsonb,
  threshold_json jsonb not null default '{}'::jsonb,
  triggered_at timestamptz,
  resolved_at timestamptz,
  explanation_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (snapshot_id, rule_key)
);

create table public.market_risk_regime_events (
  id uuid primary key default gen_random_uuid(),
  market text not null default 'US',
  previous_regime text,
  new_regime text not null check (
    new_regime in ('stable', 'stress_build_up', 'stress_acceleration', 'post_stress_normalization')
  ),
  effective_date date not null,
  effective_at timestamptz not null,
  risk_score numeric check (risk_score between 0 and 100),
  model_version text not null,
  snapshot_id uuid references public.market_risk_snapshots (id) on delete set null,
  triggered_rules_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index market_risk_regime_events_market_idx
  on public.market_risk_regime_events (market, model_version, effective_date desc);
create index market_risk_regime_events_snapshot_idx
  on public.market_risk_regime_events (snapshot_id);

alter table public.market_risk_ingestion_runs enable row level security;
alter table public.market_risk_observations enable row level security;
alter table public.market_risk_snapshots enable row level security;
alter table public.market_risk_signals enable row level security;
alter table public.market_risk_regime_events enable row level security;

revoke all on public.market_risk_ingestion_runs from public, anon, authenticated;
revoke all on public.market_risk_observations from public, anon, authenticated;
revoke all on public.market_risk_snapshots from public, anon, authenticated;
revoke all on public.market_risk_signals from public, anon, authenticated;
revoke all on public.market_risk_regime_events from public, anon, authenticated;

grant select, insert, update on public.market_risk_ingestion_runs to service_role;
grant select, insert on public.market_risk_observations to service_role;
grant select, insert on public.market_risk_snapshots to service_role;
grant select, insert, update on public.market_risk_signals to service_role;
grant select, insert on public.market_risk_regime_events to service_role;
