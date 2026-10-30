-- Account-owned watchlist. Each change affects one ticker, never a whole-list overwrite.
create table public.user_watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null check (ticker ~ '^[A-Z][A-Z0-9.-]{0,9}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, ticker)
);
create index user_watchlist_added_idx on public.user_watchlist(user_id, created_at, ticker);
alter table public.user_watchlist enable row level security;
revoke all on public.user_watchlist from anon, authenticated;
grant select, insert, delete on public.user_watchlist to authenticated;
grant all on public.user_watchlist to service_role;
create policy watchlist_select on public.user_watchlist for select to authenticated
  using ((select auth.uid()) = user_id);
create policy watchlist_insert on public.user_watchlist for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy watchlist_delete on public.user_watchlist for delete to authenticated
  using ((select auth.uid()) = user_id);

-- An atomic receipt prevents retries of the same source restoring removed stocks.
create table public.user_watchlist_imports (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null,
  imported_at timestamptz not null default now(),
  primary key (user_id, source_id)
);
alter table public.user_watchlist_imports enable row level security;
revoke all on public.user_watchlist_imports from anon, authenticated;
grant select, insert on public.user_watchlist_imports to authenticated;
grant all on public.user_watchlist_imports to service_role;
create policy watchlist_import_select on public.user_watchlist_imports for select to authenticated
  using ((select auth.uid()) = user_id);
create policy watchlist_import_insert on public.user_watchlist_imports for insert to authenticated
  with check ((select auth.uid()) = user_id);

create function public.import_user_watchlist(tickers text[], source_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if cardinality(tickers) > 1000 or exists (
    select 1 from unnest(tickers) as t where t is null or t !~ '^[A-Z][A-Z0-9.-]{0,9}$'
  ) then raise exception 'Invalid tickers'; end if;
  insert into public.user_watchlist_imports(user_id, source_id) values (auth.uid(), source_id) on conflict do nothing;
  if found then
    insert into public.user_watchlist(user_id, ticker, created_at)
      select auth.uid(), ticker, now() + ordinality * interval '1 microsecond'
      from unnest(tickers) with ordinality as t(ticker, ordinality)
      on conflict (user_id, ticker) do nothing;
  end if;
end;
$$;
revoke all on function public.import_user_watchlist(text[], uuid) from public, anon;
grant execute on function public.import_user_watchlist(text[], uuid) to authenticated;
