-- Virtual ledger writes are exclusively performed by the authenticated backend.
-- No privileged functions, views, or triggers are introduced.
create table public.paper_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  version bigint not null default 0 check (version >= 0),
  active boolean not null default false,
  updated_at timestamptz not null default now()
);
create index paper_accounts_active_idx on public.paper_accounts(user_id) where active;
alter table public.paper_accounts enable row level security;
revoke all on public.paper_accounts from anon, authenticated;
grant select on public.paper_accounts to authenticated;
grant select, insert, update, delete on public.paper_accounts to service_role;
create policy paper_accounts_read_own on public.paper_accounts for select to authenticated
  using ((select auth.uid()) = user_id);

create table public.paper_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  position_id uuid not null,
  note text not null check (char_length(btrim(note)) between 10 and 4000),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  published_at timestamptz not null default now(),
  unique(user_id, position_id)
);
create index paper_reviews_feed_idx on public.paper_reviews(published_at desc, id);
alter table public.paper_reviews enable row level security;
revoke all on public.paper_reviews from anon, authenticated;
grant select on public.paper_reviews to authenticated;
grant select, insert, update, delete on public.paper_reviews to service_role;
create policy paper_reviews_read_published on public.paper_reviews for select to authenticated
  using (true);

comment on table public.paper_accounts is 'Simulated funds only. Backend uses user_id + version CAS for atomic ledger updates.';
comment on table public.paper_reviews is 'User-published completed virtual trade snapshots. No account balances.';
