-- Outcome of each agent signal once its horizon has passed (see
-- app/services/agent_signal_evaluation.py for the method). One row per signal; signals
-- themselves stay immutable. Only the service role reads or writes.
create table public.agent_signal_evaluations (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null unique references public.agent_signals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('scored', 'unscoreable')),
  error text,
  method_version int not null,
  -- Entry = next session open after trade_date; exit = last close on or before expires_on.
  entry_date date,
  entry_price numeric(18, 6),
  exit_date date,
  exit_price numeric(18, 6),
  return_pct numeric(12, 4),
  benchmark_return_pct numeric(12, 4),
  excess_return_pct numeric(12, 4),
  -- Excess return in the signal's direction (BUY long, SELL short); null for HOLD.
  signed_excess_pct numeric(12, 4),
  hit boolean,
  max_adverse_pct numeric(12, 4),
  bracket_outcome text check (bracket_outcome is null or bracket_outcome in ('stop_loss', 'take_profit', 'expired')),
  bracket_return_pct numeric(12, 4),
  evaluated_at timestamptz not null default now(),
  check (status = 'unscoreable' or (entry_price is not null and exit_price is not null and hit is not null))
);
create index agent_signal_evaluations_user_idx on public.agent_signal_evaluations(user_id, evaluated_at desc);
alter table public.agent_signal_evaluations enable row level security;
revoke all on public.agent_signal_evaluations from anon, authenticated;
grant all on public.agent_signal_evaluations to service_role;
