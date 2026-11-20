create table public.vix_daily_bars (
  date date primary key,
  open numeric not null check (open > 0 and open < 10000),
  high numeric not null check (high > 0 and high < 10000),
  low numeric not null check (low > 0 and low < 10000),
  close numeric not null check (close > 0 and close < 10000),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (high >= low)
);
alter table public.vix_daily_bars enable row level security;
revoke all on public.vix_daily_bars from public, anon, authenticated;
grant select, insert, update on public.vix_daily_bars to service_role;
