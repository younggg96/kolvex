-- One administrator-imported Xiaohongshu sentiment digest per Pacific date.
-- Reads go through the FastAPI service role, like fear_greed_observations.
create table public.xhs_daily_sentiment (
  date_pt date primary key,
  captured_at timestamptz not null,
  sample jsonb not null,
  sentiment jsonb not null,
  topics jsonb not null check (jsonb_typeof(topics) = 'array'),
  rumors jsonb not null default '[]'::jsonb check (jsonb_typeof(rumors) = 'array'),
  limitations jsonb not null default '[]'::jsonb check (jsonb_typeof(limitations) = 'array'),
  imported_by uuid references auth.users(id) on delete set null,
  imported_at timestamptz not null default now()
);

alter table public.xhs_daily_sentiment enable row level security;
revoke all on public.xhs_daily_sentiment from public, anon, authenticated;
grant select, insert, update on public.xhs_daily_sentiment to service_role;
