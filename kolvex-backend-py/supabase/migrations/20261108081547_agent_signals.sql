-- Structured trading signals extracted from each completed trading analysis. One row per
-- analysis; the row outlives nothing (cascades with the analysis). Later steps score each
-- signal once expires_on has passed. Only the service role reads or writes.
create table public.agent_signals (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null unique references public.trading_analyses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  trade_date date not null,
  rating text not null check (rating in ('BUY', 'SELL', 'HOLD')),
  conviction numeric(4, 3) not null check (conviction between 0 and 1),
  horizon_days int not null check (horizon_days between 1 and 365),
  -- trade_date + horizon_days: when the signal becomes scoreable.
  expires_on date not null,
  entry_plan text not null default '',
  invalidation text not null default '',
  -- Percent distances from entry (5 = 5%), same unit as quant_strategy_assignments.
  stop_loss_pct numeric(8, 4) check (stop_loss_pct is null or (stop_loss_pct > 0 and stop_loss_pct < 100)),
  take_profit_pct numeric(8, 4) check (take_profit_pct is null or take_profit_pct > 0),
  key_reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(key_reasons) = 'array'),
  key_risks jsonb not null default '[]'::jsonb check (jsonb_typeof(key_risks) = 'array'),
  -- Model's SELL sizing hint; the action below is what code allowed.
  sell_size text check (sell_size is null or sell_size in ('reduce', 'close')),
  -- Resolved against the paper account and risk budget; null when the trade date was not live.
  position_action text check (position_action is null or position_action in ('open_long', 'add', 'reduce', 'close', 'hold')),
  action_reason text not null default '',
  -- Holdings and budget the agent saw (agent_portfolio.build_portfolio_context), for replay.
  portfolio_context jsonb check (portfolio_context is null or jsonb_typeof(portfolio_context) = 'object'),
  -- structured = full LLM extraction; rating_only / fallback_hold = degraded, exclude from evaluation.
  extraction_status text not null check (extraction_status in ('structured', 'rating_only', 'fallback_hold')),
  extraction_error text,
  schema_version int not null,
  llm_provider text,
  model_id text,
  created_at timestamptz not null default now()
);
create index agent_signals_user_idx on public.agent_signals(user_id, trade_date desc);
create index agent_signals_ticker_idx on public.agent_signals(ticker, trade_date desc);
create index agent_signals_expires_idx on public.agent_signals(expires_on)
  where extraction_status = 'structured';
alter table public.agent_signals enable row level security;
revoke all on public.agent_signals from anon, authenticated;
grant all on public.agent_signals to service_role;
