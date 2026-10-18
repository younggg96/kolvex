-- Imported briefs remain admin-only until a reader publishing workflow is defined.
create table public.daily_briefs (
  id text primary key,
  brief_date date not null,
  brief_type text not null check (brief_type in ('morning', 'evening')),
  title text not null,
  headline text not null,
  payload jsonb not null check (payload->>'schema_version' = 'kolvex-brief/1.0'),
  imported_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (id = brief_type || '-' || brief_date::text)
);
create index daily_briefs_date_idx on public.daily_briefs (brief_date desc, id);
alter table public.daily_briefs enable row level security;
revoke all on public.daily_briefs from anon, authenticated;
grant select, insert on public.daily_briefs to service_role;
