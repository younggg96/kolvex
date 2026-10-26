-- Editorial calendar. Only the backend service role may read/write this table.
create table public.market_events (
  id text primary key,
  event_date date not null,
  status text not null check (status in ('draft', 'published', 'cancelled')),
  importance text not null check (importance in ('high', 'medium', 'low')),
  is_hot boolean not null default false,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index market_events_published_date on public.market_events(event_date, id)
  where status = 'published' and (importance = 'high' or is_hot);
alter table public.market_events enable row level security;
revoke all on public.market_events from anon, authenticated;
grant all on public.market_events to service_role;
