create table public.fear_greed_observations (
  date date primary key,
  score numeric not null check (score between 0 and 100),
  rating text check (rating in ('extreme fear', 'fear', 'neutral', 'greed', 'extreme greed')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.fear_greed_observations enable row level security;
revoke all on public.fear_greed_observations from public, anon, authenticated;
grant select, insert, update on public.fear_greed_observations to service_role;
