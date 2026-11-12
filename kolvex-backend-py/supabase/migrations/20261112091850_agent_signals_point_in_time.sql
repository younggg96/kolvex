-- A signal is point-in-time only when its analysis ran on its trade_date (New York).
-- Backfilled analyses read today's fundamentals and statements, so their outcomes are
-- known in advance and must never be scored as model skill.
alter table public.agent_signals
  add column point_in_time boolean not null default false;

update public.agent_signals
set point_in_time = (trade_date = (created_at at time zone 'America/New_York')::date);

drop index if exists public.agent_signals_expires_idx;
create index agent_signals_expires_idx on public.agent_signals(expires_on)
  where extraction_status = 'structured' and point_in_time;

-- Method v2: hit is relative to SPY and stays null when the benchmark is missing;
-- direction_hit judges the raw return alone.
alter table public.agent_signal_evaluations
  add column direction_hit boolean;

alter table public.agent_signal_evaluations
  drop constraint if exists agent_signal_evaluations_check;
alter table public.agent_signal_evaluations
  add constraint agent_signal_evaluations_check
  check (status = 'unscoreable' or (entry_price is not null and exit_price is not null and direction_hit is not null) or method_version = 1);
