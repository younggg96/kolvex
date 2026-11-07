-- Options-activity report runs (pre-market, intraday, after close). Shared by all
-- signed-in users through the backend; only the service role reads or writes.
create table public.options_activity_runs (
  id uuid primary key default gen_random_uuid(),
  trade_date date not null,
  session text not null check (session in ('pre', 'intraday', 'post')),
  status text not null check (status in ('ok', 'skipped')),
  run_at timestamptz not null default now(),
  -- ET date of the market session the option volumes belong to (pre-market runs report the prior session).
  data_date date,
  universe_size int not null default 0,
  failed_symbols text[] not null default '{}',
  -- market, contributors, contracts, tickers.
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  -- sentiment, points_zh, points_en, source.
  summary jsonb check (summary is null or jsonb_typeof(summary) = 'object'),
  model_id text,
  prompt_version text,
  unique (trade_date, session)
);
create index options_activity_runs_ok_idx
  on public.options_activity_runs(trade_date desc, run_at desc)
  where status = 'ok';
create index options_activity_runs_session_idx
  on public.options_activity_runs(session, trade_date desc)
  where status = 'ok';
alter table public.options_activity_runs enable row level security;
revoke all on public.options_activity_runs from anon, authenticated;
grant all on public.options_activity_runs to service_role;
